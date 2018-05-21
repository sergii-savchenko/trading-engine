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

const createTrade(order, slave) {
  return order;
}

const comparePrice = function(order, side, priceCompare, priceOrder) {
  if (order.status !== "wait") {
    return order
  }
  knex.select("*")
    .from('orders')
    .where('price', priceCompare, order.price)
    .orWhere('price', '=', order.price)
    .andWhere({'side': side, market: order.market, status: 'wait'})
    .andWhere('createdAt', '<', order.creationTine)
    .orderBy('price', priceOrder)
    .limit(1)
    .then(function(resp) {
      if (resp.length != 0) {
        createTrade(order, resp[0], function(response) {
          order = response;
          if (order.status !== "wait") {
            return order
          }
          comparePrice(order, side, priceCompare, priceOrder, function(response) {
            order = response;
            if (order.status !== "wait") return order
          })
        })
      } else {
        return order
      }
    })
}

const matchingOrder = function(order, trx) {
  if (order.side == "buy") {
    var side = 'sell',
      priceCompare = '>',
      priceOrder = 'desc'
  } else {
    var side = 'buy',
      priceCompare = '<=',
      priceOrder = 'asc'
  }
  comparePrice(order, side, priceCompare, priceOrder, function(resp) {
    return resp;
  })
}

async function start() {
  nats.subscribe('orders.new', function(request, replyTo) {
    try {
      var order = JSON.parse(request);
      order.receivedTime = new Date().toUTCString();
      order.remainingAmount = order.volume;
    } catch(err) {
      nats.publish(replyTo, JSON.stringify({err}))
    }
    knex.transaction(function(trx) {
      knex.insert(order).into('orders')
        //.returning(['id', 'creationTime', 'status'])
        .transacting(trx)
        .then(function(resp) {
          var data = resp[0];
          return matchingOrder(data, trx);
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
