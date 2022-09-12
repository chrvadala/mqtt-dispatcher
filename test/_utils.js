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

    const res = topics.map(t => ({ topic: t, qos }))
    setTimeout(() => realCb(undefined, res), 0)
  }),

  unsubscribe: jest.fn().mockImplementation((topics, cb) => {
    setTimeout(() => cb(undefined), 1000)
  }),

  on: jest.fn(),

  removeListener: jest.fn(),

  _simulatePublish (topic, message) {
    expect(this.on).toHaveBeenCalledTimes(1)
    const handler = this.on.mock.calls[0][1]
    const payload = Buffer.from(message, 'utf8')
    const packet = { cmd: 'publish', retain: false, qos: 0, dup: false, length: 10, topic, payload }
    return handler(topic, message, packet)
  }
})

const fromCB = handler => {
  return new Promise((resolve, reject) => {
    const cb = (err, data) => {
      if (err) return reject(err)
      resolve(data)
    }
    handler(cb)
  })
}

module.exports = {
  getMqttFakeClient,
  fromCB
}
