/* global expect, jest */

const getMqttFakeClient = () => ({
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

module.exports = {
  getMqttFakeClient
}
