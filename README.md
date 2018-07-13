# mqtt-dispatcher 
Node.js message dispatcher for MQTT

[![Build Status](https://travis-ci.org/chrvadala/mqtt-dispatcher.svg?branch=master)](https://travis-ci.org/chrvadala/mqtt-dispatcher)
[![Coverage Status](https://coveralls.io/repos/github/chrvadala/mqtt-dispatcher/badge.svg?branch=master)](https://coveralls.io/github/chrvadala/mqtt-dispatcher?branch=master)
[![NPM Version](https://img.shields.io/npm/v/mqtt-dispatcher.svg)](https://www.npmjs.com/package/mqtt-dispatcher)
[![Dependencies Status](https://david-dm.org/chrvadala/mqtt-dispatcher/status.svg)](https://david-dm.org/chrvadala/mqtt-dispatcher)
[![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)
[![Beerpay](https://beerpay.io/chrvadala/transformation-matrix/badge.svg?style=beer)](https://beerpay.io/chrvadala/mqtt-dispatcher)


## Why this library?
The implementation for **MQTT** in Javascript is [MQTT.js](https://github.com/mqttjs/MQTT.js). It is able to handle MQTT messages but doesn't have
a built-in message dispatcher. You can subscribe different topics, but all messages are handled by a single event listener `on('message', cb)`.

This library provides a dispatch system that connects a **subscribe** operation with a specific callback. A callback is called only when an incoming message matches the provided pattern.

Under the hood it uses the library [qlobber](https://github.com/davedoesdev/qlobber) to handle the mach task.

## Api
- `new MqttDispatcher(mqtt, options)` - Connects dispatcher with listener
- `subscribe(topicPattern, fn )` - Adds listener
- `unsubscribe(topicPattern, [fn])` - Removes listener
- `destroy()` - Detaches dispatcher from client

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
const MqttDispatcher = require('mqtt-dispatcher')

const client = mqtt.connect('mqtt://broker.mqttdashboard.com:8000')
const router = new MqttDispatcher(client)

client.on('connect', () => {
  console.log('connect')
})

//create some handlers
let func1 = (topic, message) => {
  console.log('func1', topic, message.toString());
}
let func2 = (topic, message) => {
  console.log('func2', topic, message.toString());
}

//attach handlers to topics
router.subscribe('hello/mqtt', func1)
router.subscribe('hello/+', func2)

//remove handlers
setTimeout(() => {
    console.log('timeout 1')
    router.unsubscribe('hello/mqtt', func1)
}, 10 * 1000)

setTimeout(() => {
    console.log('timeout 2')
    router.unsubscribe('hello/+', func2)
}, 20 * 1000)

```

## Changelog
- **0.0** - Preview version

## Contributors
- [chrvadala](https://github.com/chrvadala) (author)

## Related projects
- [mqtt-router](https://www.npmjs.com/package/mqtt-router)
