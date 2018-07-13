/* global it, expect, jest */
const MqttDispatcher = require('./MqttDispatcher')

const noop = jest.fn()

const getMqttFakeClient = () => ({
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  on: jest.fn(),
  removeListener: jest.fn(),

  _simulatePublish (topic, message) {
    expect(this.on).toHaveBeenCalledTimes(1)
    const handler = this.on.mock.calls[0][1]
    const payload = Buffer.from(message, 'utf8')
    const packet = {cmd: 'publish', retain: false, qos: 0, dup: false, length: 10, topic, payload}
    return handler(topic, message, packet)
  }
})

it('should attach listener and handle sub/unsub operations', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  expect(client.on).toHaveBeenCalledWith('message', expect.any(Function))
  expect(client.on).toHaveBeenCalledTimes(1)

  const fn1 = jest.fn()
  expect(dispatcher.subscribe('hello/mqtt', fn1)).toEqual({performedSubscription: true, topicPattern: 'hello/mqtt'})
  expect(client.subscribe).toHaveBeenCalledWith('hello/mqtt', {qos: 0})
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(dispatcher.subscribedTopics).toEqual({'hello/mqtt': new Set([fn1])})

  const fn2 = jest.fn()
  expect(dispatcher.subscribe('hello/mqtt', fn2)).toEqual({performedSubscription: false, topicPattern: 'hello/mqtt'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.subscribedTopics).toEqual({'hello/mqtt': new Set([fn1, fn2])})

  const fn3 = jest.fn()
  expect(dispatcher.subscribe('hello/world', fn3)).toEqual({performedSubscription: true, topicPattern: 'hello/world'})
  expect(client.subscribe).toHaveBeenLastCalledWith('hello/world', {qos: 0})
  expect(client.subscribe).toHaveBeenCalledTimes(2)
  expect(dispatcher.subscribedTopics).toEqual({'hello/mqtt': new Set([fn1, fn2]), 'hello/world': new Set([fn3])})

  expect(dispatcher.unsubscribe('hello/mqtt', fn2)).toEqual({
    performedUnsubscription: false,
    topicPattern: 'hello/mqtt'
  })
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(dispatcher.subscribedTopics).toEqual({'hello/mqtt': new Set([fn1]), 'hello/world': new Set([fn3])})

  expect(dispatcher.unsubscribe('hello/mqtt', fn1)).toEqual({performedUnsubscription: true, topicPattern: 'hello/mqtt'})
  expect(client.unsubscribe).toHaveBeenCalledWith('hello/mqtt')
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.subscribedTopics).toEqual({'hello/world': new Set([fn3])})

  expect(dispatcher.unsubscribe('hello/world', fn3)).toEqual({
    performedUnsubscription: true,
    topicPattern: 'hello/world'
  })
  expect(client.unsubscribe).toHaveBeenCalledWith('hello/world')
  expect(client.unsubscribe).toHaveBeenCalledTimes(2)
  expect(dispatcher.subscribedTopics).toEqual({})
})

it('should route messages', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  expect(client.on).toHaveBeenCalledTimes(1)

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  const fn3 = jest.fn()
  const fn4 = jest.fn()
  let calls1 = 0
  let calls2 = 0
  let calls3 = 0
  let calls4 = 0
  expect(dispatcher.subscribe('+/mqtt', fn1)).toEqual({performedSubscription: true, topicPattern: '+/mqtt'})
  expect(dispatcher.subscribe('#', fn2)).toEqual({performedSubscription: true, topicPattern: '#'})
  expect(dispatcher.subscribe('abcdef/#', fn3)).toEqual({performedSubscription: true, topicPattern: 'abcdef/#'})
  expect(dispatcher.subscribe('#', fn4)).toEqual({performedSubscription: false, topicPattern: '#'})
  expect(dispatcher.subscribedTopics).toEqual({
    '+/mqtt': new Set([fn1]),
    '#': new Set([fn2, fn4]),
    'abcdef/#': new Set([fn3])
  })

  // match [fn1], [fn2], [fn4]
  client._simulatePublish('hello/mqtt', 'message1')
  expect(fn1).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn2).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('hello/mqtt', 'message1', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn2).toHaveBeenCalledTimes(++calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)

  // match [fn2], [fn4]
  client._simulatePublish('hello/mqtt/test', 'message2')
  expect(fn2).toHaveBeenLastCalledWith('hello/mqtt/test', 'message2', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('hello/mqtt/test', 'message2', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(++calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)

  // match [fn2(unsub)], [fn3], [fn4]
  expect(dispatcher.unsubscribe('#', fn2)).toEqual({performedUnsubscription: false, topicPattern: '#'})
  client._simulatePublish('abcdef/test/test/test', 'message3')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)
  expect(dispatcher.subscribedTopics).toEqual({
    '+/mqtt': new Set([fn1]),
    '#': new Set([fn4]),
    'abcdef/#': new Set([fn3])
  })

  // match [fn2(unsub)], [fn3], [fn4(unsub)]
  expect(dispatcher.unsubscribe('#', fn4)).toEqual({performedUnsubscription: true, topicPattern: '#'})
  client._simulatePublish('abcdef/test/test/test', 'message4')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message4', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.subscribedTopics).toEqual({
    '+/mqtt': new Set([fn1]),
    'abcdef/#': new Set([fn3])
  })

  // match [fn2(unsub)], [fn3(unsub)], [fn4(unsub)]
  expect(dispatcher.unsubscribe('abcdef/#', fn3)).toEqual({performedUnsubscription: true, topicPattern: 'abcdef/#'})
  client._simulatePublish('abcdef/test/test/test', 'message5')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.subscribedTopics).toEqual({
    '+/mqtt': new Set([fn1])
  })

  // match [fn1]
  client._simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenLastCalledWith('helloworld/mqtt', 'message6', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)

  // match [fn1(unsub)]
  expect(dispatcher.unsubscribe('+/mqtt', undefined)).toEqual({performedUnsubscription: true, topicPattern: '+/mqtt'})
  client._simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.subscribedTopics).toEqual({})
})

it('should destroy', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  expect(dispatcher.subscribe('+/mqtt', noop)).toEqual({performedSubscription: true, topicPattern: '+/mqtt'})
  expect(dispatcher.subscribe('#', noop)).toEqual({performedSubscription: true, topicPattern: '#'})
  expect(dispatcher.subscribe('abcdef/#', noop)).toEqual({performedSubscription: true, topicPattern: 'abcdef/#'})
  expect(dispatcher.subscribe('#', jest.fn())).toEqual({performedSubscription: false, topicPattern: '#'})

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
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  expect(dispatcher.subscribe('#', jest.fn())).toEqual({performedSubscription: true, topicPattern: '#'})
  expect(dispatcher.subscribe('#', jest.fn())).toEqual({performedSubscription: false, topicPattern: '#'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(dispatcher.subscribedTopics).toEqual({
    '#': expect.any(Set)
  })

  expect(dispatcher.unsubscribe('#')).toEqual({performedUnsubscription: true, topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.subscribedTopics).toEqual({})
})

it('should maintain subscription when trying to unsubscribe a fn that wasnt subscribed', function () {
  const client = getMqttFakeClient()

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  const fnExtraneous = jest.fn()

  const dispatcher = new MqttDispatcher(client)
  expect(dispatcher.subscribe('#', fn1)).toEqual({performedSubscription: true, topicPattern: '#'})
  expect(dispatcher.subscribe('#', fn2)).toEqual({performedSubscription: false, topicPattern: '#'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('#', fn1)).toEqual({performedUnsubscription: false, topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(function () {
    dispatcher.unsubscribe('#', fnExtraneous)
  }).toThrow(/extraneous/i)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  expect(dispatcher.unsubscribe('#', fn2)).toEqual({performedUnsubscription: true, topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
})

it('should reject double registration on same topic', function () {
  const client = getMqttFakeClient()

  const fn1 = jest.fn()

  const dispatcher = new MqttDispatcher(client)
  expect(dispatcher.subscribe('#', fn1)).toEqual({performedSubscription: true, topicPattern: '#'})
  expect(dispatcher.subscribe('#/foo', fn1)).toEqual({performedSubscription: true, topicPattern: '#/foo'})

  expect(dispatcher.subscribedTopics).toEqual({
    '#': new Set([fn1]),
    '#/foo': new Set([fn1])
  })

  expect(function () {
    dispatcher.subscribe('#', fn1)
  }).toThrow(/already registered/i)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
})

it('should reject unsub on unknown topics', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)

  expect(function () {
    dispatcher.unsubscribe('/test')
  }).toThrow(/extraneous topic/i)

  expect(function () {
    dispatcher.unsubscribe('/test', jest.fn())
  }).toThrow(/extraneous topic/i)
})

it('should customize qos with options', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client, {qos: 2})
  expect(dispatcher.options).toMatchObject({qos: 2})
  const fn = jest.fn()
  dispatcher.subscribe('#', fn)
  expect(client.subscribe).toHaveBeenCalledWith('#', {qos: 2})
})

it('should avoid to handle subscriptions using an option', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client, {handleSubscriptions: false})
  expect(dispatcher.options).toMatchObject({handleSubscriptions: false})

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  let calls1 = 0
  let calls2 = 0

  expect(dispatcher.subscribe('root/topic1', fn1)).toEqual({performedSubscription: false, topicPattern: 'root/topic1'})
  expect(dispatcher.subscribe('root/topic2', fn2)).toEqual({performedSubscription: false, topicPattern: 'root/topic2'})

  expect(client.subscribe).toHaveBeenCalledTimes(0)

  client._simulatePublish('root/topic1', 'blablabla')
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn1).toHaveBeenCalledWith('root/topic1', 'blablabla', expect.any(Object))
  expect(fn2).toHaveBeenCalledTimes(calls2)

  client._simulatePublish('root/topic2', 'abcdef')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(++calls2)
  expect(fn2).toHaveBeenCalledWith('root/topic2', 'abcdef', expect.any(Object))

  client._simulatePublish('root/topic999', 'zxcvbn')
  expect(fn1).toHaveBeenCalledTimes(calls2)
  expect(fn2).toHaveBeenCalledTimes(calls1)

  expect(dispatcher.unsubscribe('root/topic1')).toEqual({performedUnsubscription: false, topicPattern: 'root/topic1'})
  expect(dispatcher.unsubscribe('root/topic2')).toEqual({performedUnsubscription: false, topicPattern: 'root/topic2'})

  expect(client.subscribe).toHaveBeenCalledTimes(0)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
})