# mqtt-dispatcher 
Node.js message dispatcher for MQTT

[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard.js-brightgreen.svg)](https://standardjs.com)
[![Build Status](https://travis-ci.org/chrvadala/mqtt-dispatcher.svg?branch=master)](https://travis-ci.org/chrvadala/mqtt-dispatcher)
[![Coverage Status](https://coveralls.io/repos/github/chrvadala/mqtt-dispatcher/badge.svg?branch=master)](https://coveralls.io/github/chrvadala/mqtt-dispatcher?branch=master)
[![NPM Version](https://img.shields.io/npm/v/mqtt-dispatcher.svg)](https://www.npmjs.com/package/mqtt-dispatcher)
[![Dependencies Status](https://david-dm.org/chrvadala/mqtt-dispatcher/status.svg)](https://david-dm.org/chrvadala/mqtt-dispatcher)
[![Donate](https://img.shields.io/badge/donate-PayPal-green.svg)](https://www.paypal.me/chrvadala/25)


## Why this library?
The implementation for **MQTT** in Javascript is [MQTT.js](https://github.com/mqttjs/MQTT.js). It is able to handle MQTT messages but doesn't have
a built-in message dispatcher. You can subscribe different topics, but all messages are handled by a single event listener `on('message', cb)`.

This library provides a dispatch system that connects a **subscribe** operation with a specific callback. A callback is called only when an incoming message matches the provided pattern.

Under the hood it uses the library [qlobber](https://github.com/davedoesdev/qlobber) to handle the mach task.

## Api
- `new MqttDispatcher(mqtt, options)` - Connects dispatcher with listener
- `await addRule(topicPattern, fn )` - Adds listener
- `await removeRule(topicPattern, [fn])` - Removes listener
- `await destroy()` - Detaches dispatcher from client

## Options

----------------
| Option | Default | Description |
|---|---|---|
| `qos` | `0` | Customize subscription qos |
| `handleSubscriptions` | true |  If `false` the dispatcher won't subscribe the provided MQTT client to topics. This mode is useful to reduce the number of subscriptions, but supposes that the developer properly performs the required operations to obtain the required messages. _Use with caution_. |

## Install
````
yarn add mqtt-dispatcher
````

## Example
```javascript
const mqtt = require('mqtt')
const MqttDispatcher = require('.')

const client = mqtt.connect('mqtt://broker.hivemq.com:1883')
const dispatcher = new MqttDispatcher(client)

client.on('connect', () => console.log('connected'));

(async () => {
  await dispatcher.addRule('mqtt-dispatcher/command/logout', (topic, message) => {
    console.log(message.toString())
  })

  await dispatcher.addRule('mqtt-dispatcher/command/restart', (topic, message) => {
    console.log(message.toString())
  })

  await dispatcher.addRule('mqtt-dispatcher/command/shutdown', (topic, message) => {
    console.log(message.toString())
  })

  await fromCB(cb => client.publish('mqtt-dispatcher/command/logout', 'logout command', {qos: 1}, cb))
  await fromCB(cb => client.publish('mqtt-dispatcher/command/restart', 'restart command', {qos: 1}, cb))
  await fromCB(cb => client.publish('mqtt-dispatcher/command/shutdown', 'shutdown command', {qos: 1}, cb))

  await dispatcher.removeRule('mqtt-dispatcher/command/logout')
  await dispatcher.removeRule('mqtt-dispatcher/command/restart')
  await dispatcher.removeRule('mqtt-dispatcher/command/shutdown')

  await fromCB(cb => client.end(cb))
})()

const fromCB = handler => new Promise((resolve, reject) => {
  handler((err, data) => {
    if (err) return reject(err)
    resolve(data)
  })
})
```

## Changelog
- **0.0** - Preview version

## Contributors
- [chrvadala](https://github.com/chrvadala) (author)

## Related projects
- [mqtt-router](https://www.npmjs.com/package/mqtt-router)
