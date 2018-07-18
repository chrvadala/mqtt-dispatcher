class ClientWrapper {
  constructor (mqtt) {
    this.mqtt = mqtt
  }

  subscribe (topics, options) {
    if (!Array.isArray(topics)) throw new Error('Should provide array with topics')
    return new Promise((resolve, reject) => {
      const cb = (err, granted) => {
        if (err) return reject(err)
        resolve(granted)
      }

      if (options) { this.mqtt.subscribe(topics, options, cb) } else { this.mqtt.subscribe(topics, cb) }
    })
  }

  unsubscribe (topics) {
    if (!Array.isArray(topics)) throw new Error('Should provide array with topics')
    return new Promise((resolve, reject) => {
      const cb = err => {
        if (err) return reject(err)
        resolve()
      }

      this.mqtt.unsubscribe(topics, cb)
    })
  }

  on (eventName, listener) {
    return this.mqtt.on(eventName, listener)
  }

  removeListener (eventName, listener) {
    return this.mqtt.removeListener(eventName, listener)
  }
}

module.exports = ClientWrapper
