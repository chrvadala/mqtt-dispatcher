/* global expect, test, beforeAll, afterAll, jest, describe */
const aedesLib = require('aedes')
const net = require('net')
const portfinder = require('portfinder')
const mqtt = require('mqtt')
const MqttDispatcher = require('..')
const {fromCB} = require('./_utils')

let aedes, server, port, client

async function startBrokerAndClient () {
  aedes = aedesLib()
  server = net.createServer(aedes.handle)

  // aedes.on('client', client => console.log('client connected', client.id))
  aedes.on('clientError', (client, err) => console.error('clientError', client, err))

  // aedes.subscribe('#', (packet, cb) => {
  //   console.log('received message on topic ', packet.topic, packet.payload.toString())
  //   cb()
  // })

  port = await portfinder.getPortPromise()
  await new Promise(resolve => server.listen(port, resolve))

  client = mqtt.connect({port})
  await new Promise(resolve => client.on('connect', resolve))
}

async function stopBrokerAndClient () {
  await Promise.all([
    new Promise(resolve => client.end(resolve)),
    new Promise(resolve => server.close(resolve)),
    new Promise(resolve => aedes.close(resolve))
  ])
}

/**
 * this is the most standard way to use this library
 */
describe('standard way', async () => {
  beforeAll(startBrokerAndClient)
  afterAll(stopBrokerAndClient)

  let dispatcher

  const fn1 = jest.fn()
  const fn2 = jest.fn()

  test('install rules', async () => {
    expect.assertions(2)

    dispatcher = new MqttDispatcher(client)
    let r1 = dispatcher.addRule('command/restart', fn1)
    let r2 = dispatcher.addRule('command/shutdown', fn2)

    await expect(r1).resolves.toEqual({subscribed: [{qos: 0, topic: 'command/restart'}], topicPattern: 'command/restart'})
    await expect(r2).resolves.toEqual({subscribed: [{qos: 0, topic: 'command/shutdown'}], topicPattern: 'command/shutdown'})
  })

  test('routing', done => {
    expect.assertions(2)

    Promise.all([
      new Promise(resolve => fn1.mockImplementation(resolve)),
      new Promise(resolve => fn2.mockImplementation(resolve))
    ]).then(() => {
      expect(fn1).toHaveBeenCalledWith(expect.any(String), Buffer.from('restart command'), expect.anything())
      expect(fn2).toHaveBeenCalledWith(expect.any(String), Buffer.from('shutdown command'), expect.anything())
      done()
    })

    client.publish('command/restart', 'restart command')
    client.publish('command/shutdown', 'shutdown command')
  })

  test('remove rules', async () => {
    expect.assertions(2)

    let r1 = dispatcher.removeRule('command/restart')
    let r2 = dispatcher.removeRule('command/shutdown')

    await expect(r1).resolves.toEqual({'topicPattern': 'command/restart', 'unsubscribed': ['command/restart']})
    await expect(r2).resolves.toEqual({'topicPattern': 'command/shutdown', 'unsubscribed': ['command/shutdown']})
  })
})

/**
 * in this mode the dispatcher doesn't subscribe the client
 */
describe('custom subscriptions', async function () {
  beforeAll(startBrokerAndClient)
  afterAll(stopBrokerAndClient)

  let dispatcher

  const fn1 = jest.fn()
  const fn2 = jest.fn()

  test('install rules', async () => {
    expect.assertions(2)

    dispatcher = new MqttDispatcher(client, {handleSubscriptions: false})
    await fromCB(cb => client.subscribe('#', cb)) // <--- if handleSubscriptions: false, then this line is required

    let r1 = dispatcher.addRule('command/restart', fn1)
    let r2 = dispatcher.addRule('command/shutdown', fn2)

    await expect(r1).resolves.toEqual({subscribed: [], topicPattern: 'command/restart'})
    await expect(r2).resolves.toEqual({subscribed: [], topicPattern: 'command/shutdown'})
  })

  test('routing', done => {
    expect.assertions(2)

    Promise.all([
      new Promise(resolve => fn1.mockImplementation(resolve)),
      new Promise(resolve => fn2.mockImplementation(resolve))
    ]).then(() => {
      expect(fn1).toHaveBeenCalledWith(expect.any(String), Buffer.from('restart command'), expect.anything())
      expect(fn2).toHaveBeenCalledWith(expect.any(String), Buffer.from('shutdown command'), expect.anything())
      done()
    })

    client.publish('command/restart', 'restart command')
    client.publish('command/shutdown', 'shutdown command')
  })

  test('remove rules', async () => {
    expect.assertions(2)

    let r1 = dispatcher.removeRule('command/restart')
    let r2 = dispatcher.removeRule('command/shutdown')
    await fromCB(cb => client.unsubscribe('#', cb)) // <--- if handleSubscriptions: false, then this line is required

    await expect(r1).resolves.toEqual({'topicPattern': 'command/restart', 'unsubscribed': []})
    await expect(r2).resolves.toEqual({'topicPattern': 'command/shutdown', 'unsubscribed': []})
  })
})

/**
 * in this mode the dispatcher decouples subscriptions and matched topic
 */
describe('decoupled subscriptions', async function () {
  beforeAll(startBrokerAndClient)
  afterAll(stopBrokerAndClient)

  let dispatcher

  const fn1 = jest.fn()
  const fn2 = jest.fn()

  test('install rules', async () => {
    expect.assertions(2)
    dispatcher = new MqttDispatcher(client)

    let r1 = dispatcher.addRule(
      'command/restart',
      fn1,
      {subscription: 'command/+'} // <--- reduces subscriptions using same topic in different rules
    )

    let r2 = dispatcher.addRule(
      'command/shutdown',
      fn2,
      {subscription: 'command/+'} // <--- reduces subscriptions using same topic in different rules
    )

    await expect(r1).resolves.toEqual({subscribed: [{qos: 0, topic: 'command/+'}], topicPattern: 'command/restart'})
    await expect(r2).resolves.toEqual({subscribed: [], topicPattern: 'command/shutdown'})
  })

  test('routing', done => {
    expect.assertions(2)

    Promise.all([
      new Promise(resolve => fn1.mockImplementation(resolve)),
      new Promise(resolve => fn2.mockImplementation(resolve))
    ]).then(() => {
      expect(fn1).toHaveBeenCalledWith(expect.any(String), Buffer.from('restart command'), expect.anything())
      expect(fn2).toHaveBeenCalledWith(expect.any(String), Buffer.from('shutdown command'), expect.anything())
      done()
    })

    client.publish('command/restart', 'restart command')
    client.publish('command/shutdown', 'shutdown command')
  })

  test('remove rules', async () => {
    expect.assertions(2)

    let r1 = dispatcher.removeRule('command/restart')
    let r2 = dispatcher.removeRule('command/shutdown')

    await expect(r1).resolves.toEqual({'topicPattern': 'command/restart', 'unsubscribed': []})
    await expect(r2).resolves.toEqual({'topicPattern': 'command/shutdown', 'unsubscribed': ['command/+']})
  })
})
