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
