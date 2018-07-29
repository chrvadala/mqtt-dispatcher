const mqtt = require('mqtt')
const MqttDispatcher = require('.')

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
