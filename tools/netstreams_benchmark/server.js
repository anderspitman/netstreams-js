const WebSocket = require('ws')
const { Peer } = require('netstreams')

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
      console.log("onData")
      console.log(data)
      stream.request(1)
    })

    //stream.request(1)
    stream.request(10)
    //stream.request(10)
  })
})
