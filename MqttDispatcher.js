const {Qlobber} = require('qlobber')

const mqttMatcher = {
  separator: '/',
  wildcard_one: '+',
  wildcard_some: '#'
}

const defaultOptions = {
  qos: 0,
}

class MqttDispatcher {
  constructor (mqtt, options = {}) {
    this.mqtt = mqtt
    this.options = {...defaultOptions, ...options}
    this.matcher = new Qlobber(mqttMatcher)
    this.destroyed = false
    this.subscribedTopics = {}
    this._handleIncomingMessage = this._handleIncomingMessage.bind(this)
    mqtt.on('message', this._handleIncomingMessage)
  }

  /**
   * Subscribe to a topic with a function
   * @param topicPattern
   * @param fn
   * @returns {{performedSubscription: boolean}}
   */
  subscribe (topicPattern, fn) {
    const {matcher, mqtt, options: {qos}, subscribedTopics} = this
    this._ensureLive()
    let performedSubscription = false

    if (!subscribedTopics[topicPattern]) {
      mqtt.subscribe(topicPattern, {qos})
      subscribedTopics[topicPattern] = new Set() // initialize
      performedSubscription = true
    }

    if (subscribedTopics[topicPattern].has(fn)) {
      throw new Error('Function already registered on same topic pattern')
    }

    matcher.add(topicPattern, fn)
    subscribedTopics[topicPattern].add(fn)
    return {performedSubscription, topicPattern}
  }

  /**
   * Unsubscribe to a topic (if a function is provided removes just that reference)
   * @param topicPattern
   * @param fn
   * @returns {{performedUnsubscription: boolean}}
   */
  unsubscribe (topicPattern, fn = undefined) {
    const {matcher, mqtt, subscribedTopics} = this
    this._ensureLive()
    let performedUnsubscription = false

    if (!subscribedTopics.hasOwnProperty(topicPattern)) throw new Error('Extraneous topic provided')

    if (fn) {
      if (!subscribedTopics[topicPattern].has(fn)) throw new Error('Extraneous function provided')
      matcher.remove(topicPattern, fn)
      subscribedTopics[topicPattern].delete(fn)
    } else {
      matcher.remove(topicPattern)
      subscribedTopics[topicPattern].clear()
    }

    if (subscribedTopics[topicPattern].size === 0) {
      mqtt.unsubscribe(topicPattern)
      delete subscribedTopics[topicPattern]
      performedUnsubscription = true
    }
    return {performedUnsubscription, topicPattern}
  }

  /**
   * Detach dispatcher from client
   */
  destroy () {
    const {matcher, mqtt, subscribedTopics} = this
    this._ensureLive()
    Object.keys(subscribedTopics).forEach(topic => {
      mqtt.unsubscribe(topic)
    })
    matcher.clear()
    this.subscribedTopics = {}
    mqtt.removeListener('message', this._handleIncomingMessage)
    this.destroyed = true
  }

  _handleIncomingMessage (topic, message, packet) {
    const {matcher} = this
    const fns = matcher.match(topic)
    fns.forEach(fn => fn(topic, message, packet))
  }

  _ensureLive () {
    if (this.destroyed) throw new Error('MqttDispatcher was destroyed')
  }
}

module.exports = MqttDispatcher
