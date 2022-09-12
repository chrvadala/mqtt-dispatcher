# mqtt-dispatcher 
MQTT dispatcher is a library that extends MQTT.js and allows to route incoming messages on a specific handler, according to defined routing rules.

[![chrvadala](https://img.shields.io/badge/website-chrvadala-orange.svg)](https://chrvadala.github.io)
[![Test](https://github.com/chrvadala/mqtt-dispatcher/workflows/Test/badge.svg)](https://github.com/chrvadala/mqtt-dispatcher/actions)
[![Coverage Status](https://coveralls.io/repos/github/chrvadala/mqtt-dispatcher/badge.svg)](https://coveralls.io/github/chrvadala/mqtt-dispatcher)
[![npm](https://img.shields.io/npm/v/mqtt-dispatcher.svg?maxAge=2592000?style=plastic)](https://www.npmjs.com/package/mqtt-dispatcher)
[![Downloads](https://img.shields.io/npm/dm/mqtt-dispatcher.svg)](https://www.npmjs.com/package/mqtt-dispatcher)
[![Donate](https://img.shields.io/badge/donate-PayPal-green.svg)](https://www.paypal.me/chrvadala/25)


# Why this library?
The implementation for **MQTT** in Javascript is [MQTT.js](https://github.com/mqttjs/MQTT.js). It is able to handle MQTT messages but it doesn't have
a built-in message dispatcher. You can subscribe different topics, but all messages are handled by a single event listener `on('message', cb)`.

This library provides a dispatch system that connects a **subscribe** operation with a specific callback. A callback is called only when an incoming message matches the provided pattern.

# Documentation
- [APIs](https://github.com/chrvadala/mqtt-dispatcher/blob/main/docs/api.md)

# Install
````
npm install mqtt-dispatcher
````

# Example
```javascript
const mqtt = require('mqtt')
const MqttDispatcher = require('mqtt-dispatcher')

const client = mqtt.connect('mqtt://broker.hivemq.com:1883')
const dispatcher = new MqttDispatcher(client)

client.on('connect', () => console.log('connected'));

(async () => {
  await dispatcher.addRule('mqtt-dispatcher/command/logout', (topic, message) => {
    console.log('RECEIVED MESSAGE', message.toString())
  })

  await dispatcher.addRule('mqtt-dispatcher/command/restart', (topic, message) => {
    console.log('RECEIVED MESSAGE', message.toString())
  })

  await dispatcher.addRule('mqtt-dispatcher/command/shutdown', (topic, message) => {
    console.log('RECEIVED MESSAGE', message.toString())
  })

  client.publish('mqtt-dispatcher/command/logout', 'logout command')
  client.publish('mqtt-dispatcher/command/restart', 'restart command')
  client.publish('mqtt-dispatcher/command/shutdown', 'shutdown command')

  await new Promise(resolve => setTimeout(resolve, 5000))

  await dispatcher.removeRule('mqtt-dispatcher/command/logout')
  await dispatcher.removeRule('mqtt-dispatcher/command/restart')
  await dispatcher.removeRule('mqtt-dispatcher/command/shutdown')

  client.end(() => console.log('end'))
})()
```

## Changelog
- **0.x** - Preview version
- **1.0** - First stable version
- **1.1** - Upgrades libraries
- **1.2** - Migrates to codecov

## Contributors
- [chrvadala](https://github.com/chrvadala) (author)

## Related projects
- [mqtt-router](https://www.npmjs.com/package/mqtt-router)
