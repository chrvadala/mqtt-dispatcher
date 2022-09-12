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

class MqttDispatcher {
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
   * Subscribe to a topic with a function
   * @param topicPattern
   * @param fn
   * @param options
   * @returns {diff}
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
   * Unsubscribe to a topic (if a function is provided removes just that reference)
   * @param topicPattern
   * @param fn
   * @returns {diff}
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
   * Detach dispatcher from client
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
 * @typedef diff
 * @property {Array} topicPattern - list of patterns
 * @property {Array} subscriptions - list of subscriptions
 */
