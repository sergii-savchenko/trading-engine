# Microservice prototype and sizing demo for Exchange

## Low level recommendations

Main recommendation on architecture is move to microservice architecture for API calls on Peatio daemons. 

* To be able to isolate each microaction and measure efficiency
* Ability to scale any non-locking microservice to face needed load

## High level requirements 

Estimations on load cap: 1000 orders per second, 10000 concurrent users

It should be technological flexibility to be able to evaluate system and have a plan of technological 
transition. As a source of incoming orders RabitMQ and RESTful API must be supported

## Business logics on Orders

### Features

* Market order support
* Limit order support
* Partial filling support
* Order cancellation support
* Order update/amendment

### Data structures 

New order submission
* Order ID
* Order type = market | limit
* Instrument = currency pair
* Desired price/rate
* Limit order only
* Creation time (server)
* Received time (when daemon received it)
* Amount=Volume=Quantity
* Output message format

Order accepted
* Order ID

Order updated
* Order ID 
* Executed amount

Order closed
* Order ID

Order statuses
* New/Submitted
* Partially Filled
* Closed
* Cancelled
* Executed


### RESTful endpoints

#### Create order

POST `/api/v3/order` 

#### Delete order

DELETE `/api/v3/order/{id}` 

### Microservices

#### JWT Authentication
#### GUID generator
#### Redis cache
#### MySQL persistent order creation / deletion
#### Trading engine
#### Incoming order RabitMQ subscriber
#### Statistics generator invoker
#### Member accounts update service
#### Market and ticker pusher
#### Private orderbook pusher
#### Member Accounts pusher

# Prototype suggestions

You can scale your worker in seconds and because we use NATS as “nervous system" for our distributed system we do not have to worry about service-discovery or load-balancing of hemera-services. We use traefik to load-balancing the api-gateway.

This configuration will setup:

* [Hapi](https://github.com/hapijs/hapi) http server which act as api-gateway to the Hemera services.
* [Microservice](https://github.com/hemerajs/aither/blob/master/worker/index.js) which is responsible to add two numbers.
* [NATS](https://github.com/nats-io/gnatsd) server the underlying messaging system for Hemera.
* [Jaeger](https://github.com/jaegertracing/jaeger) CNCF Jaeger, a Distributed Tracing System.
* [Natsboard](https://github.com/devfacet/natsboard) dashboard to monitoring your NATS system in realtime.
* [Traefik](https://traefik.io/) modern HTTP reverse proxy and load balancer made to deploy microservices with ease.
* [Redis](https://redis.io) in memory cache for Hemera.

## Versions
 * Hapi 17
 * Hemera 5

## Architecture

![blocics](https://github.com/sergii-savchenko/arch.png?raw=true)

![aither](https://github.com/hemerajs/aither/blob/master/aither-architecture.png?raw=true)


## Getting started
* Running the system `docker-compose up`
* Start a request against load balancer [OPEN](http://localhost:8182/api/add?a=1&b=10)
* Scale the system `docker-compose scale math-service=5 api=2`

## Dashboards

- Traefik [http://localhost:8181/](http://localhost:8181/)
- NATS Dashboard [http://localhost:3000/](http://localhost:3000/)
- NATS Endpoint [http://localhost:8222/](http://localhost:8222/)
- Jaeger [http://localhost:16686/](http://localhost:16686/)

## Run load test

```bash
npm install -g artillery
artillery run loadtest.yml
```
Print the html artillery report with `artillery report <report.json>`

## Previews

### Traefik

![traefik](/traefik.png)

### NATS dashboard

![nats](/nats.png)

### NATS monitoring endpoint

![nats-monitoring](/nats-monitoring.png)

### Jaeger dashboard

![jaeger](/jaeger.png)

## Thank you
thanks most of all to the community who create these awesome opensource software and thereby making it possible.
