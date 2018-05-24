const {Qlobber} = require('qlobber')

const mqttMatcher = {
  separator: '/',
  wildcard_one: '+',
  wildcard_some: '#'
}

class MqttDispatcher {
  constructor(mqtt, qos = 0) {
    this.mqtt = mqtt;
    this.qos = qos;
    this.matcher = new Qlobber(mqttMatcher);
    mqtt.on('message', this._handleIncomingMessage.bind(this))
  }

  subscribe(topic, fn) {
    const {matcher, mqtt, qos} = this;
    let performedSubscription = false
    if (!this._involvedTopic(topic)) {
      mqtt.subscribe(topic, {qos})
      performedSubscription = true;
    }
    matcher.add(topic, fn)
    return {performedSubscription}
  }

  unsubscribe(topic, fn = undefined) {
    const {matcher, mqtt} = this;
    let performedUnsubscription = false;
    matcher.remove(topic, fn)
    if (!this._involvedTopic(topic)) {
      mqtt.unsubscribe(topic)
      performedUnsubscription = true
    }
    return {performedUnsubscription}
  }

  _handleIncomingMessage(topic, message, packet) {
    const {matcher} = this;
    const fns = matcher.match(topic)
    fns.forEach(fn => fn(topic, message, packet))
  }

  _involvedTopic(topic) {
    const {matcher} = this;
    const fns = matcher.match(topic)
    return fns.length > 0
  }
}

module.exports = MqttDispatcher
