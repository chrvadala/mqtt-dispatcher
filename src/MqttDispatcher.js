const { Qlobber } = require('qlobber')
const ClientWrapper = require('./ClientWrapper')

const mqttMatcher = {
  separator: '/',
  wildcard_one: '+',
  wildcard_some: '#'
}

const defaultOptions = {
  qos: 0,
  handleSubscriptions: true
}

const compareStr = (str1, str2) => str1.localeCompare(str2) === 0
const isFunction = fn => typeof fn === 'function'

/**
 * @classdesc MQTT Dispatcher component
 */
class MqttDispatcher {
  /**
  * Creates a MqttDispatcher object.
  * @param {Object} [options={}] - Subscription options
  * @param {number} [options.qos=0] - Default QoS. See {@link MqttDispatcher#addRule} options.
  * @param {boolean} [options.handledSubscription=true] - Default subscription strategy. See {@link MqttDispatcher#addRule} options.
  * @example
  * const mqtt = require('mqtt')
  * const MqttDispatcher = require('mqtt-dispatcher')
  *
  * const client = mqtt.connect('mqtt://mqtt.broker:1883')
  * const dispatcher = new MqttDispatcher(client)
  */
  constructor (mqtt, options = {}) {
    this.options = Object.assign({}, defaultOptions, options)
    this.mqtt = new ClientWrapper(mqtt)
    this.matcher = new Qlobber(mqttMatcher)
    this.destroyed = false
    this.rules = []

    this._handleIncomingMessage = this._handleIncomingMessage.bind(this)
    mqtt.on('message', this._handleIncomingMessage)
  }

  /**
   * This method is used to register a new handler, associated to a topic pattern. It returns a Promise that is fullfilled when the subscription on the client has been completed or immediately if no subscription is required.
   * @async
   * @param {string} topicPattern - Mqtt topic on which the handler has to be attached
   * @param {function} fn - Handler
   * @param {Object} [options={}] - Subscription options
   * @param {number} [options.qos=0] - MQTT Quality of Service
   * @param {boolean} [options.handledSubscription=true] - If false, the dispatcher won't subscribe to the provided MQTT client to topics. This mode is useful to reduce the number of subscriptions. Any mqtt subscription is up to the developer that must subscribe the client enough to obtain the required messages (e.g. '#'). Use with caution.
   * @param {boolean} [options.subscription] - Use this option to override the subscription for this rule with a new one that is more general and can work across multiple rules ( eg. If you have a rule for command/shutdown and command/reboot you can subscribe the client to command/+ and save subscriptions )
   * @returns {Promise<InvolvedEntities>}
   */
  async addRule (topicPattern, fn, options = {}) {
    const { rules, matcher, mqtt, options: { qos, handleSubscriptions } } = this

    if (this.destroyed) throw new Error('MqttDispatcher was destroyed')

    const rule = {
      topicPattern,
      fn,
      subscription: options.subscription || topicPattern
    }

    if (rules.some(i => compareStr(i.topicPattern, rule.topicPattern) && i.fn === rule.fn)) {
      throw new Error('Function already registered with same topic pattern')
    }

    let subscribed = []
    const needsSubscription = handleSubscriptions && !rules.some(_r => compareStr(_r.subscription, rule.subscription))

    matcher.add(topicPattern, fn)
    rules.push(rule)

    if (needsSubscription) {
      subscribed = await mqtt.subscribe([rule.subscription], { qos })
    }

    return { topicPattern, subscribed }
  }

  /**
   * Unsubscribe from a topic
   * @async
   * @param {string} topicPattern - Mqtt topic on which the handler has to be attached
   * @param {function} [fn=undefined] - Handler (if a function is provided removes the associated handler only)
   * @returns {Promise<InvolvedEntities>}
   */
  async removeRule (topicPattern, fn = undefined) {
    const { rules, matcher, mqtt, options: { handleSubscriptions } } = this

    if (this.destroyed) throw new Error('MqttDispatcher was destroyed')

    const rulesToDestroy = []
    const rulesToKeep = {}

    rules.forEach((_r, ruleIndex) => {
      const toDestroy = compareStr(_r.topicPattern, topicPattern) && (!isFunction(fn) || _r.fn === fn)
      if (toDestroy) { rulesToDestroy.push({ ..._r, ruleIndex }) } else { rulesToKeep[_r.subscription] = true }
    })

    if (rulesToDestroy.length === 0) throw new Error('Extraneous topic or fn provided')

    const subscriptionsToDestroy = {}
    let unsubscribed = []
    // I may have subscriptions required by others rules
    if (handleSubscriptions) {
      rulesToDestroy
        .filter(r1 => !(r1.subscription in rulesToKeep))
        .forEach(r => { subscriptionsToDestroy[r.subscription] = true })
      unsubscribed = Object.keys(subscriptionsToDestroy)
    }

    rulesToDestroy.forEach(r => {
      matcher.remove(r.topicPattern, r.fn)
      delete this.rules[r.ruleIndex]
    })

    this.rules = this.rules.filter(Boolean)

    if (handleSubscriptions && unsubscribed.length > 0) {
      await mqtt.unsubscribe(unsubscribed)
    }

    return { topicPattern, unsubscribed }
  }

  /**
   * Detaches the dispatcher from the MQTT client. After this call, any method on the dispatcher throws an exception.
   * @async
   * @return {Promise<Object>}
   */
  async destroy () {
    const { rules, matcher, mqtt, options: { handleSubscriptions } } = this

    if (this.destroyed) throw new Error('MqttDispatcher was destroyed')
    this.destroyed = true

    mqtt.removeListener('message', this._handleIncomingMessage)

    const subscriptionsToDestroy = {}
    let unsubscribed = []
    if (handleSubscriptions) {
      rules.forEach(_r => { subscriptionsToDestroy[_r.subscription] = true })
      unsubscribed = Object.keys(subscriptionsToDestroy)
    }

    matcher.clear()
    this.rules = []

    if (handleSubscriptions && unsubscribed.length > 0) {
      await mqtt.unsubscribe(unsubscribed)
    }

    return { unsubscribed }
  }

  _handleIncomingMessage (topic, message, packet) {
    const { matcher } = this
    const fns = matcher.match(topic)
    fns.forEach(fn => fn(topic, message, packet))
  }
}

module.exports = MqttDispatcher

/**
 * @typedef InvolvedEntities
 * @property {Array<String>} topicPattern - list of patterns involved in the operation
 * @property {Array<String>} subscriptions - list of subscriptions involved in the operation
 */
