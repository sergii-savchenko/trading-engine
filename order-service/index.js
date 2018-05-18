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

const matchingOrder = function(id, order, trx) {
  if (order.side == "buy") {
    var side = 'sell',
      priceCompare = '>',
      priceOrder = 'desc'
  } else {
    var side = 'buy',
      priceCompare = '<',
      priceOrder = 'asc'
  }
  knex('orders')
    .where({'side': side, market: order.market, status: 'wait'})
    .andWhere('createdAt', '<', order.createdAt)
    .andWhere('price', priceCompare, order.price)
    .orderBy('price', priceOrder)
    .then(function(resp) {
      //#TODO: create trade/update trading orders
    })
}

async function start() {
  nats.subscribe('orders.new', function(request, replyTo) {
    try {
      var order = JSON.parse(request);
    } catch(err) {
      nats.publish(replyTo, JSON.stringify({err}))
    }
    knex.transaction(function(trx) {
      knex.insert(order).into('orders')
        .returning(['id', 'createdAt', 'status'])
        .transacting(trx)
        .then(function(resp) {
          var data = resp[0];
          return matchingOrder(data, order, trx);
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
