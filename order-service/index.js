const Hemera = require('nats-hemera')
const HemeraJoi = require('hemera-joi')
const HemeraJaeger = require('hemera-jaeger')
const nats = require('nats').connect({
  url: process.env.NATS_URL,
  user: process.env.NATS_USER,
  pass: process.env.NATS_PW
})
const hemera = new Hemera(nats, {
  logLevel: process.env.HEMERA_LOG_LEVEL,
  childLogger: true,
  tag: 'hemera-order'
})

async function start() {
  hemera.use(HemeraJoi)
  hemera.use(HemeraJaeger, {
    serviceName: 'order',
    jaeger: {
      sampler: {
        type: 'Const',
        options: true
      },
      options: {
        tags: {
          'nodejs.version': process.versions.node
        }
      },
      reporter: {
        host: process.env.JAEGER_URL
      }
    }
  })

  hemera.ready(() => {

  let Joi = hemera.joi

  nats.subscribe('orders.new', function(request, replyTo) {
    var data = JSON.parder(request);
    // TODO: add jwt verification
    hemera.act({
      topic: 'mongo-store',
      cmd: 'create',
      collection: 'Orders',
      data: EJSON.serialize(data.order)
    }, async function(error, response) {
      if (error) {
        nats.publish(replyTo, JSON.stringify({error}))
      } else {
        nats.publish('matching', JSON.stringify({response}));
        nats.publish(replyTo, JSON.stringify({response}));
      }
    })
  });
}

start()
