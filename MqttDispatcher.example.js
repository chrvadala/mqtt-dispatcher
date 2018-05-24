const mqtt = require('mqtt')
const MqttDispatcher = require('./MqttDispatcher')

const client = mqtt.connect('mqtt://broker.mqttdashboard.com:8000')
const router = new MqttDispatcher(client)

client.on('connect', () => {
  console.log('connect')
})

let func1 = (topic, message) => {
  console.log('func1', topic, message.toString().substr(0, 50));
}
let func2 = (topic, message) => {
  console.log('func2', topic, message.toString().substr(0, 50));
}

router.subscribe('#', func1)
router.subscribe('#', func2)

setTimeout(() => {
  console.log('timeout 1', router.unsubscribe('#', func1));
}, 10 * 1000)

setTimeout(() => {
  console.log('timeout 2', router.unsubscribe('#', func2));
}, 20 * 1000)
