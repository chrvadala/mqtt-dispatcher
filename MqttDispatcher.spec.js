/* global it, expect, jest */
const MqttDispatcher = require('./MqttDispatcher'
)

const noop = jest.fn()

it('should attach listener and handle sub/unsub operations', function () {
  const client = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn()
  }

  const dispatcher = new MqttDispatcher(client, 0)
  expect(client.on).toHaveBeenCalledWith('message', expect.any(Function))
  expect(client.on).toHaveBeenCalledTimes(1)

  const fn1 = jest.fn()
  expect(dispatcher.subscribe('hello/mqtt', fn1)).toEqual({performedSubscription: true})
  expect(client.subscribe).toHaveBeenCalledWith('hello/mqtt', {qos: 0})
  expect(client.on).toHaveBeenCalledTimes(1)

  const fn2 = jest.fn()
  expect(dispatcher.subscribe('hello/mqtt', fn2)).toEqual({performedSubscription: false})
  expect(client.subscribe).toHaveBeenCalledTimes(1)

  const fn3 = jest.fn()
  expect(dispatcher.subscribe('hello/world', fn3)).toEqual({performedSubscription: true})
  expect(client.subscribe).toHaveBeenLastCalledWith('hello/world', {qos: 0})
  expect(client.subscribe).toHaveBeenCalledTimes(2)

  expect(dispatcher.unsubscribe('hello/mqtt', fn2)).toEqual({performedUnsubscription: false})
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('hello/mqtt', fn1)).toEqual({performedUnsubscription: true})
  expect(client.unsubscribe).toHaveBeenCalledWith('hello/mqtt')
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)

  expect(dispatcher.unsubscribe('hello/world', fn3)).toEqual({performedUnsubscription: true})
  expect(client.unsubscribe).toHaveBeenCalledWith('hello/world')
  expect(client.unsubscribe).toHaveBeenCalledTimes(2)
})

it('should route messages', function () {
  const client = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn()
  }

  const dispatcher = new MqttDispatcher(client, 0)
  expect(client.on).toHaveBeenCalledTimes(1)

  let simulatePublish = (topic, message) => {
    const handler = client.on.mock.calls[0][1]
    const packet = {
      cmd: 'publish',
      retain: false,
      qos: 0,
      dup: false,
      length: 10,
      topic,
      payload: Buffer.from(message, 'utf8')
    }
    return handler(topic, message, packet)
  }

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  const fn3 = jest.fn()
  const fn4 = jest.fn()
  let calls1 = 0
  let calls2 = 0
  let calls3 = 0
  let calls4 = 0
  expect(dispatcher.subscribe('+/mqtt', fn1)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', fn2)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('abcdef/#', fn3)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', fn4)).toEqual({performedSubscription: false})

  // match [fn1], [fn2], [fn4]
  simulatePublish('hello/mqtt', 'message1')
  expect(fn1).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn2).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn2).toHaveBeenCalledTimes(++calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)

  // match [fn2], [fn4]
  simulatePublish('hello/mqtt/test', 'message2')
  expect(fn2).toHaveBeenLastCalledWith('hello/mqtt/test', 'message2', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('hello/mqtt/test', 'message2', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(++calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)

  // match [fn2(unsub)], [fn3], [fn4]
  expect(dispatcher.unsubscribe('#', fn2)).toEqual({performedUnsubscription: false})
  simulatePublish('abcdef/test/test/test', 'message3')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)

  // match [fn2(unsub)], [fn3], [fn4(unsub)]
  expect(dispatcher.unsubscribe('#', fn4)).toEqual({performedUnsubscription: true})
  simulatePublish('abcdef/test/test/test', 'message4')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message4', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)

  // match [fn2(unsub)], [fn3(unsub)], [fn4(unsub)]
  expect(dispatcher.unsubscribe('abcdef/#', fn3)).toEqual({performedUnsubscription: true})
  simulatePublish('abcdef/test/test/test', 'message5')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)

  // match [fn1]
  simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenLastCalledWith('helloworld/mqtt', 'message6', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)

  // match [fn1(unsub)]
  expect(dispatcher.unsubscribe('+/mqtt', undefined)).toEqual({performedUnsubscription: true})
  simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
})

it('should destroy', function () {
  const client = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }

  const dispatcher = new MqttDispatcher(client, 0)
  expect(dispatcher.subscribe('+/mqtt', noop)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', noop)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('abcdef/#', noop)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', noop)).toEqual({performedSubscription: false})

  expect(client.subscribe).toHaveBeenCalledTimes(3)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledTimes(0)
  const handler = client.on.mock.calls[0][1]

  dispatcher.destroy()

  expect(client.subscribe).toHaveBeenCalledTimes(3)
  expect(client.unsubscribe).toHaveBeenCalledTimes(3)
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledWith('message', handler)

  expect(function () {
    dispatcher.subscribe('abc', noop)
  }).toThrowError(/destroyed/)

  expect(function () {
    dispatcher.unsubscribe('abc', noop)
  }).toThrowError(/destroyed/)

  expect(function () {
    dispatcher.destroy()
  }).toThrowError(/destroyed/)
})

it('should unsubscribe from the client if fn is not provided', function () {
  const client = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }

  const dispatcher = new MqttDispatcher(client, 0)
  expect(dispatcher.subscribe('#', jest.fn())).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', jest.fn())).toEqual({performedSubscription: false})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('#')).toEqual({performedUnsubscription: true})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
})

it.skip('should maintain subscription when trying to unsubscribe a fn that wasnt subscribed', function () {
  const client = {
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
    on: jest.fn(),
    removeListener: jest.fn()
  }

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  const fnExtraneous = jest.fn()

  const dispatcher = new MqttDispatcher(client, 0)
  expect(dispatcher.subscribe('#', fn1)).toEqual({performedSubscription: true})
  expect(dispatcher.subscribe('#', fn2)).toEqual({performedSubscription: false})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('#', fn1)).toEqual({performedUnsubscription: false})
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(function () {
    dispatcher.unsubscribe('#', fnExtraneous)
  }).toThrow(/extraneous/)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('#', fn2)).toEqual({performedUnsubscription: true})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
})