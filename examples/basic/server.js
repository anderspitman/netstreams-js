const WebSocket = require('ws')
const { Multiplexer } = require('../../')

const wsServer = new WebSocket.Server({ port: 9001 })

wsServer.on('connection', (ws) => {
  const mux = new Multiplexer()

  mux.setSendHandler((message) => {
    ws.send(message)
  })

  ws.onmessage = (rawMessage) => {
    mux.onMessage(rawMessage)
  }

  mux.onConduit((producer) => {
    console.log("new producer")

    producer.onData((data) => {
      console.log("data")
      console.log(data)
    })
  })

  const metadata = {}
  const stream = mux.createStream(metadata)
  stream.write(new Uint8Array([55, 56, 57]))

  //ws.send(JSON.stringify(msg))
})
