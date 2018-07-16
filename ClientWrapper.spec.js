/* global it, expect, jest */
const ClientWrapper = require('./ClientWrapper')

it('should wrap mqtt.js client', function () {
  const client = {
    subscribe: jest.fn().mockImplementation((topics, optionsOrCb, cb) => {
      let qos, realCb
      if (typeof optionsOrCb === 'function') {
        qos = 0
        realCb = optionsOrCb
      } else {
        qos = optionsOrCb.qos || 0
        realCb = cb
      }

      let res = topics.map(t => ({topic: t, qos}))
      realCb(undefined, res)
    }),

    unsubscribe: jest.fn().mockImplementation((topics, cb) => {
      cb(undefined)
    }),

    on: jest.fn()
  }

  const wrapper = new ClientWrapper(client)
  const fn1 = jest.fn()
  wrapper.on('message', fn1)
  expect(client.on).toBeCalledWith('message', fn1)

  expect(wrapper.subscribe(['test1'], {qos: 1})).resolves.toMatchObject([{topic: 'test1', qos: 1}])
  expect(wrapper.subscribe(['test2'])).resolves.toMatchObject([{topic: 'test2', qos: 0}])
  expect(wrapper.unsubscribe(['test3'])).resolves.toBe(undefined)

  expect(() => wrapper.subscribe('test1')).toThrow()
  expect(() => wrapper.unsubscribe('test1')).toThrow()
})
