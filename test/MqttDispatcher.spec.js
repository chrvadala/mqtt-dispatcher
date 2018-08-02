/* global it, expect, jest, describe, beforeAll */
const {getMqttFakeClient} = require('./_utils')
const MqttDispatcher = require('../src/MqttDispatcher')

it('should attach listener and handle sub/unsub operations', async function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  expect(client.on).toHaveBeenCalledWith('message', expect.any(Function))
  expect(client.on).toHaveBeenCalledTimes(1)

  const fn1 = jest.fn()
  await expect(dispatcher.addRule('hello/mqtt', fn1)).resolves
    .toEqual({subscribed: [{topic: 'hello/mqtt', qos: 0}], topicPattern: 'hello/mqtt'})
  expect(client.subscribe).toHaveBeenCalledWith(['hello/mqtt'], {qos: 0}, expect.any(Function))
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(dispatcher.rules).toEqual([
    {topicPattern: 'hello/mqtt', fn: fn1, subscription: 'hello/mqtt'}
  ])

  const fn2 = jest.fn()
  await expect(dispatcher.addRule('hello/mqtt', fn2)).resolves
    .toEqual({subscribed: [], topicPattern: 'hello/mqtt'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.rules).toEqual([
    {topicPattern: 'hello/mqtt', fn: fn1, subscription: 'hello/mqtt'},
    {topicPattern: 'hello/mqtt', fn: fn2, subscription: 'hello/mqtt'}
  ])

  const fn3 = jest.fn()
  await expect(dispatcher.addRule('hello/world', fn3)).resolves
    .toEqual({subscribed: [{topic: 'hello/world', qos: 0}], topicPattern: 'hello/world'})
  expect(client.subscribe).toHaveBeenLastCalledWith(['hello/world'], {qos: 0}, expect.any(Function))
  expect(client.subscribe).toHaveBeenCalledTimes(2)
  expect(dispatcher.rules).toEqual([
    {topicPattern: 'hello/mqtt', fn: fn1, subscription: 'hello/mqtt'},
    {topicPattern: 'hello/mqtt', fn: fn2, subscription: 'hello/mqtt'},
    {topicPattern: 'hello/world', fn: fn3, subscription: 'hello/world'}
  ])

  await expect(dispatcher.removeRule('hello/mqtt', fn2)).resolves
    .toEqual({unsubscribed: [], topicPattern: 'hello/mqtt'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(dispatcher.rules).toEqual([
    {topicPattern: 'hello/mqtt', fn: fn1, subscription: 'hello/mqtt'},
    {topicPattern: 'hello/world', fn: fn3, subscription: 'hello/world'}
  ])

  await expect(dispatcher.removeRule('hello/mqtt', fn1)).resolves
    .toEqual({unsubscribed: ['hello/mqtt'], topicPattern: 'hello/mqtt'})
  expect(client.unsubscribe).toHaveBeenCalledWith(['hello/mqtt'], expect.any(Function))
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.rules).toEqual([
    {topicPattern: 'hello/world', fn: fn3, subscription: 'hello/world'}
  ])

  await expect(dispatcher.removeRule('hello/world', fn3)).resolves
    .toEqual({unsubscribed: ['hello/world'], topicPattern: 'hello/world'})
  expect(client.unsubscribe).toHaveBeenCalledWith(['hello/world'], expect.any(Function))
  expect(client.unsubscribe).toHaveBeenCalledTimes(2)
  expect(dispatcher.rules).toEqual([])
})

it('should route messages', async function () {
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
  await expect(dispatcher.addRule('+/mqtt', fn1)).resolves
    .toEqual({subscribed: [{topic: '+/mqtt', qos: 0}], topicPattern: '+/mqtt'})
  await expect(dispatcher.addRule('#', fn2)).resolves
    .toEqual({subscribed: [{topic: '#', qos: 0}], topicPattern: '#'})
  await expect(dispatcher.addRule('abcdef/#', fn3)).resolves
    .toEqual({subscribed: [{topic: 'abcdef/#', qos: 0}], topicPattern: 'abcdef/#'})
  await expect(dispatcher.addRule('#', fn4)).resolves
    .toEqual({subscribed: [], topicPattern: '#'})
  expect(dispatcher.rules).toEqual([
    {topicPattern: '+/mqtt', fn: fn1, subscription: '+/mqtt'},
    {topicPattern: '#', fn: fn2, subscription: '#'},
    {topicPattern: 'abcdef/#', fn: fn3, subscription: 'abcdef/#'},
    {topicPattern: '#', fn: fn4, subscription: '#'}
  ])

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
  await expect(dispatcher.removeRule('#', fn2)).resolves
    .toEqual({unsubscribed: [], topicPattern: '#'})
  client._simulatePublish('abcdef/test/test/test', 'message3')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn4).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message3', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(++calls4)
  expect(dispatcher.rules).toEqual([
    {topicPattern: '+/mqtt', fn: fn1, subscription: '+/mqtt'},
    {topicPattern: 'abcdef/#', fn: fn3, subscription: 'abcdef/#'},
    {topicPattern: '#', fn: fn4, subscription: '#'}
  ])

  // match [fn2(unsub)], [fn3], [fn4(unsub)]
  await expect(dispatcher.removeRule('#', fn4)).resolves
    .toEqual({unsubscribed: ['#'], topicPattern: '#'})
  client._simulatePublish('abcdef/test/test/test', 'message4')
  expect(fn3).toHaveBeenLastCalledWith('abcdef/test/test/test', 'message4', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(++calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.rules).toEqual([
    {topicPattern: '+/mqtt', fn: fn1, subscription: '+/mqtt'},
    {topicPattern: 'abcdef/#', fn: fn3, subscription: 'abcdef/#'}
  ])

  // match [fn2(unsub)], [fn3(unsub)], [fn4(unsub)]
  await expect(dispatcher.removeRule('abcdef/#', fn3)).resolves
    .toEqual({unsubscribed: ['abcdef/#'], topicPattern: 'abcdef/#'})
  client._simulatePublish('abcdef/test/test/test', 'message5')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.rules).toEqual([
    {topicPattern: '+/mqtt', fn: fn1, subscription: '+/mqtt'}
  ])

  // match [fn1]
  client._simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenLastCalledWith('helloworld/mqtt', 'message6', expect.any(Object))
  expect(fn1).toHaveBeenCalledTimes(++calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)

  // match [fn1(unsub)]
  await expect(dispatcher.removeRule('+/mqtt', undefined)).resolves
    .toEqual({unsubscribed: ['+/mqtt'], topicPattern: '+/mqtt'})
  client._simulatePublish('helloworld/mqtt', 'message6')
  expect(fn1).toHaveBeenCalledTimes(calls1)
  expect(fn2).toHaveBeenCalledTimes(calls2)
  expect(fn3).toHaveBeenCalledTimes(calls3)
  expect(fn4).toHaveBeenCalledTimes(calls4)
  expect(dispatcher.rules).toEqual([])
})

it('should destroy', async function () {
  const client = getMqttFakeClient()
  const fn = jest.fn()

  const dispatcher = new MqttDispatcher(client)
  await expect(dispatcher.addRule('+/mqtt', fn)).resolves.toEqual(expect.any(Object))
  await expect(dispatcher.addRule('#', fn)).resolves.toEqual(expect.any(Object))
  await expect(dispatcher.addRule('abcdef/#', fn)).resolves.toEqual(expect.any(Object))
  await expect(dispatcher.addRule('#', jest.fn())).resolves.toEqual(expect.any(Object))

  expect(client.subscribe).toHaveBeenCalledTimes(3)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledTimes(0)
  const handler = client.on.mock.calls[0][1]

  await expect(dispatcher.destroy()).resolves
    .toEqual({unsubscribed: ['+/mqtt', '#', 'abcdef/#']})

  expect(client.subscribe).toHaveBeenCalledTimes(3)
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
  expect(client.on).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledTimes(1)
  expect(client.removeListener).toHaveBeenCalledWith('message', handler)

  await expect(dispatcher.addRule('abc', fn)).rejects.toThrow(/destroyed/i)
  await expect(dispatcher.removeRule('abc', fn)).rejects.toThrow(/destroyed/i)
  await expect(dispatcher.destroy()).rejects.toThrow(/destroyed/i)
})

it('should detach all rules with the provided topicPattern if fn is not provided', async function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)
  await expect(dispatcher.addRule('#', jest.fn())).resolves
    .toEqual({subscribed: [{topic: '#', qos: 0}], topicPattern: '#'})
  await expect(dispatcher.addRule('#', jest.fn())).resolves
    .toEqual({subscribed: [], topicPattern: '#'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
  expect(dispatcher.rules).toEqual([
    {topicPattern: '#', subscription: '#', fn: expect.any(Function)},
    {topicPattern: '#', subscription: '#', fn: expect.any(Function)}
  ])

  await expect(dispatcher.removeRule('#')).resolves.toEqual({unsubscribed: ['#'], topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
  expect(dispatcher.rules).toEqual([])
})

it('should maintain subscription when trying to unsubscribe a fn that wasnt subscribed', async function () {
  const client = getMqttFakeClient()

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  const fnExtraneous = jest.fn()

  const dispatcher = new MqttDispatcher(client)
  await expect(dispatcher.addRule('#', fn1)).resolves.toEqual({subscribed: [{topic: '#', qos: 0}], topicPattern: '#'})
  await expect(dispatcher.addRule('#', fn2)).resolves.toEqual({subscribed: [], topicPattern: '#'})
  expect(client.subscribe).toHaveBeenCalledTimes(1)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  await expect(dispatcher.removeRule('#', fn1)).resolves.toEqual({unsubscribed: [], topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  await expect(dispatcher.removeRule('#', fnExtraneous)).rejects.toThrow(/extraneous/i)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)

  await expect(dispatcher.removeRule('#', fn2)).resolves.toEqual({unsubscribed: ['#'], topicPattern: '#'})
  expect(client.unsubscribe).toHaveBeenCalledTimes(1)
})

it('should reject double registration on same topic', async function () {
  const client = getMqttFakeClient()

  const fn1 = jest.fn()

  const dispatcher = new MqttDispatcher(client)
  await expect(dispatcher.addRule('#', fn1)).resolves.toEqual({subscribed: [{topic: '#', qos: 0}], topicPattern: '#'})
  await expect(dispatcher.addRule('#/foo', fn1)).resolves.toEqual({
    subscribed: [{topic: '#/foo', qos: 0}],
    topicPattern: '#/foo'
  })

  expect(dispatcher.rules).toEqual([
    {topicPattern: '#', fn: fn1, subscription: '#'},
    {topicPattern: '#/foo', fn: fn1, subscription: '#/foo'}
  ])

  await expect(dispatcher.addRule('#', fn1)).rejects.toThrow(/already registered/i)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
})

it('should reject unsub on unknown topics', async function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client)

  await expect(dispatcher.removeRule('/test')).rejects.toThrow(/extraneous topic/i)
  await expect(dispatcher.removeRule('/test', jest.fn())).rejects.toThrow(/extraneous topic/i)
})

it('should customize qos with options', function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client, {qos: 2})
  expect(dispatcher.options).toMatchObject({qos: 2})
  const fn = jest.fn()
  dispatcher.addRule('#', fn)
  expect(client.subscribe).toHaveBeenCalledWith(['#'], {qos: 2}, expect.any(Function))
})

it('should avoid to handle subscriptions using an option', async function () {
  const client = getMqttFakeClient()

  const dispatcher = new MqttDispatcher(client, {handleSubscriptions: false})
  expect(dispatcher.options).toMatchObject({handleSubscriptions: false})

  const fn1 = jest.fn()
  const fn2 = jest.fn()
  let calls1 = 0
  let calls2 = 0

  await expect(dispatcher.addRule('root/topic1', fn1)).resolves.toEqual({subscribed: [], topicPattern: 'root/topic1'})
  await expect(dispatcher.addRule('root/topic2', fn2)).resolves.toEqual({subscribed: [], topicPattern: 'root/topic2'})

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

  await expect(dispatcher.removeRule('root/topic1')).resolves.toEqual({unsubscribed: [], topicPattern: 'root/topic1'})
  await expect(dispatcher.removeRule('root/topic2')).resolves.toEqual({unsubscribed: [], topicPattern: 'root/topic2'})

  expect(client.subscribe).toHaveBeenCalledTimes(0)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
})

describe('test concurrency', () => {
  let client, dispatcher

  beforeAll(() => {
    client = getMqttFakeClient()
    dispatcher = new MqttDispatcher(client)
  })

  it('should addRule', async () => {
    expect.hasAssertions()

    const [r1, r2] = await Promise.all([
      dispatcher.addRule('command/shutdown', jest.fn(), {subscription: 'command/+'}),
      dispatcher.addRule('command/reboot', jest.fn(), {subscription: 'command/+'})
    ])

    expect(client.subscribe).toHaveBeenCalledTimes(1)
    expect(client.subscribe).toHaveBeenCalledWith(['command/+'], {qos: 0}, expect.any(Function))
    expect([...r1.subscribed, ...r2.subscribed]).toEqual([{topic: 'command/+', qos: 0}])
  })

  it('should removeRule', async () => {
    expect.hasAssertions()

    const convertToResolve = err => ({err: err.message})

    const [r1, r2, r3] = await Promise.all([
      dispatcher.removeRule('command/shutdown'),
      dispatcher.removeRule('command/reboot').catch(convertToResolve),
      dispatcher.removeRule('command/reboot').catch(convertToResolve)
    ])

    expect(client.unsubscribe).toHaveBeenCalledTimes(1)
    expect([r1, r2, r3]).toEqual(expect.arrayContaining([
      {topicPattern: 'command/shutdown', unsubscribed: []},
      {topicPattern: 'command/reboot', unsubscribed: ['command/+']},
      {err: 'Extraneous topic or fn provided'}
    ]))
  })
})

it('should skip unsubscribe when destroying an dispatcher', async () => {
  expect.hasAssertions()

  let client = getMqttFakeClient()
  let dispatcher = new MqttDispatcher(client)

  await dispatcher.destroy()

  expect(dispatcher.destroyed).toBe(true)
  expect(client.unsubscribe).toHaveBeenCalledTimes(0)
})
