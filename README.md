# mqtt-dispatcher 
[![Build Status](https://travis-ci.org/chrvadala/mqtt-dispatcher.svg?branch=master)](https://travis-ci.org/chrvadala/mqtt-dispatcher) [![Coverage Status](https://coveralls.io/repos/github/chrvadala/mqtt-dispatcher/badge.svg?branch=master)](https://coveralls.io/github/chrvadala/mqtt-dispatcher?branch=master) [![NPM Version](https://img.shields.io/npm/v/mqtt-dispatcher.svg)](https://www.npmjs.com/package/mqtt-dispatcher) [![Dependency Status](https://david-dm.org/roccomuso/is-google.png)](https://david-dm.org/roccomuso/is-google) [![JavaScript Style Guide](https://img.shields.io/badge/code_style-standard-brightgreen.svg)](https://standardjs.com)


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

let func1 = (topic, message) => {
  console.log('func1', topic, message.toString());
}
let func2 = (topic, message) => {
  console.log('func2', topic, message.toString());
}

router.subscribe('#', func1)
router.subscribe('#', func2)

setTimeout(() => {
  console.log('timeout 1', router.unsubscribe('#', func1));
}, 10 * 1000)

setTimeout(() => {
  console.log('timeout 2', router.unsubscribe('#', func2));
}, 20 * 1000)

```

## License

MIT

## Contributors

[chrvadala](https://github.com/chrvadala)
