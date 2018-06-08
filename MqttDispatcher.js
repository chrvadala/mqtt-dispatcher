const {Qlobber} = require('qlobber')

const mqttMatcher = {
  separator: '/',
  wildcard_one: '+',
  wildcard_some: '#'
}

class MqttDispatcher {
  constructor (mqtt, qos = 0) {
    this.mqtt = mqtt
    this.qos = qos
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
    const {matcher, mqtt, qos, subscribedTopics} = this
    this._ensureLive()
    let performedSubscription = false

    if (!Number.isFinite(subscribedTopics[topicPattern])) {
      mqtt.subscribe(topicPattern, {qos})
      subscribedTopics[topicPattern] = 0 // initialize
      performedSubscription = true
    }

    matcher.add(topicPattern, fn)
    subscribedTopics[topicPattern]++
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

    matcher.remove(topicPattern, fn)
    subscribedTopics[topicPattern] = fn ? subscribedTopics[topicPattern] - 1 : 0

    if (subscribedTopics[topicPattern] === 0) {
      mqtt.unsubscribe(topicPattern)
      subscribedTopics[topicPattern] = undefined
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
