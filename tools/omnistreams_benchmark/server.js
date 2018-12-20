const WebSocket = require('ws')
const { Peer } = require('omnistreams-concurrent')

const wsServer = new WebSocket.Server({ port: 9001 })

const peer = new Peer()

wsServer.on('connection', (ws) => {


  const conn = peer.createConnection()

  conn.setSendHandler((message) => {
    ws.send(message)
  })

  ws.addEventListener('message', (message) => {
    conn.handleMessage(message.data)
  })

  conn.onStream((stream, metadata) => {
    console.log("md: ")
    console.log(metadata)

    stream.onData((data) => {
      stream.request(1)
    })

    stream.onEnd(() => {
      conn.sendControlMessage(new Uint8Array(1))
    })

    stream.request(10)
  })
})
