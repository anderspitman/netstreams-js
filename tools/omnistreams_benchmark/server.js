const WebSocket = require('ws')
const { Multiplexer } = require('omnistreams-concurrent')

const wsServer = new WebSocket.Server({ port: 9001 })

const mux = new Multiplexer()

wsServer.on('connection', (ws) => {

  const mux = new Multiplexer()

  mux.setSendHandler((message) => {
    ws.send(message)
  })

  ws.addEventListener('message', (message) => {
    mux.handleMessage(message.data)
  })

  mux.onConduit((producer, metadata) => {
    console.log("md: ")
    console.log(metadata)

    producer.onData((data) => {
      producer.request(1)
    })

    producer.onEnd(() => {
      mux.sendControlMessage(new Uint8Array(1))
    })

    producer.request(10)
  })
})
