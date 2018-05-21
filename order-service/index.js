/* 
ORDERS data structure
id
market
side
creationTime
receivedTime
price
volume
remainingAmount
executedAmount
status
----------------
TRADES data structure
id
orderId
slaveOrderId
price
volume
*/

const Hemera = require('nats-hemera')
const HemeraJoi = require('hemera-joi')
const HemeraJaeger = require('hemera-jaeger')
const nats = require('nats').connect({
  url: process.env.NATS_URL,
  user: process.env.NATS_USER,
  pass: process.env.NATS_PW
})
const knex = require('knex')({
  client: 'mysql',
  connection: {
    host : process.env.DATABASE_HOST,
    user : process.env.DATABASE_USER,
    password : process.env.DATABASE_PW,
    database : process.env.DATABASE_NAME
  },
  pool: { min: 0, max: 7 }
});

var Promise = require('bluebird');

const createTrade(order, slave, trx, callback) {
  var volume = 0;
  if (order.remainingAmount <= slave.remainingAmount) {
    volume = order.remainingAmount;
    order.remainingAmount = 0;
    order.status = "executed";
    order.executedAmount += volume;
    slave.remainingAmount -= volume;
    slave.executedAmount += volume;
  } else {
    volume = slave.remainingAmount;
    order.remainingAmount -= volume;
    order.executedAmount += volume;
    slave.remainingAmount = 0;
    slave.status = "executed"
    slave.executedAmount += volume;
  }
  trx.insert({
    orderId: order.id,
    slaveOrderId: slave.id,
    volume: volume,
    price: slave.price
  })
  .into('trades')
  .returning(['id', 'orderId', 'slaveOrderId', 'volume', 'price'])
  .then(function(resp){
    if (Array.isArray(order.trades)) {
      order.trades.push(resp)
    } else {
      order.trades = [resp]
    }
    if (Array.isArray(slave.trades)) {
      slave.trades.push(resp)
    } else {
      slave.trades = [resp]
    }
    trx
    .where('id', '=', order.id).update({
      status: order.status,
      remainingAmount: order.remainingAmount,
      executedAmount: order.executedAmount,
      trades: order.trades
    })
    .into('orders')
    .then(function(resp) {
      trx.where('id', '=', slave.id)
      .into('orders')
      .update({
        status: slave.status,
        remainingAmount: slave.remainingAmount,
        executedAmount: slave.executedAmount,
        trades: slave.trades
      }).then(function(resp) {
        callback(null, order);
      }).catch(function(err) {
        callback(new Error("cannot update slave order after trade"), null)
      });
    }).catch(function(err) {
      callback(new Error("cannot update order after trade"), null)
    })
  })
  .catch(function(err) {
    callback(new Error("cannot create trade"), null)
  })
  callback(null, order);
}

const comparePrice = function(order, side, priceCompare, priceOrder, trx, callback) {
  if (order.status !== "wait") {
    callback(null, order);
  } else {
    trx.select("*")
      .from('orders')
      .where('price', priceCompare, order.price)
      .orWhere('price', '=', order.price)
      .andWhere({'side': side, market: order.market, status: 'wait'})
      .andWhere('createdAt', '<', order.creationTine)
      .orderBy('price', priceOrder)
      .limit(1)
      .then(function(resp) {
        if (resp.length != 0) {
          createTrade(order, resp[0], trx, function(err, response) {
            if (err) {
              callback(err, null)
            } else {
              order = response;
              if (order.status !== "wait") {
                callback(null, order);
              } else {
                comparePrice(order, side, priceCompare, priceOrder, trx, function(err, response) {
                  if (err) {
                    callback(err, null);
                  } else {
                    order = response;
                    callback(null, order);
                  }
                });
              }
            }
          });
        } else {
          callback(null, order);
        }
      }).catch(function(err) {
        callback(new Error("cannot select orders"), null);
      })
  }
}

const matchingOrders = function(order, trx, callback) {
  if (order.side == "buy") {
    var side = 'sell',
      priceCompare = '>',
      priceOrder = 'desc'
  } else {
    var side = 'buy',
      priceCompare = '<=',
      priceOrder = 'asc'
  }
  comparePrice(order, side, priceCompare, priceOrder, trx, function(err, resp) {
    callback(err, resp);
  })
}

async function start() {
  nats.subscribe('orders.new', function(request, replyTo) {
    try {
      var order = JSON.parse(request);
      order.receivedTime = new Date().toUTCString();
      order.remainingAmount = order.volume;
      order.executedAmount = 0;
    } catch(err) {
      nats.publish(replyTo, JSON.stringify({err}))
    }
    knex.transaction(function(trx) {
      knex.insert(order).into('orders')
        .returning(['id', 'creationTime', 'status', 'price', 'market', 'volume', 'executedAmount', 'remainingAmount', 'side'])
        .transacting(trx)
        .then(function(resp) {
          var data = resp[0];
          matchingOrders(data, trx, function(err, resp) {
            if (err) {
              throw err;
            } else {
              return resp;
            }
          });
        })
        .then(trx.commit)
        .catch(trx.rollback);
    })
    .then(function(resp) {

      nats.publish('order.created', resp)
    })
    .catch(function(err) {
      console.error(err);
    });
  });
}

start()
