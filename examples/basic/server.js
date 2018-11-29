const WebSocket = require('ws')
const { Peer } = require('../../')

const wsServer = new WebSocket.Server({ port: 9001 })
const nsPeer = new Peer

wsServer.on('connection', (ws) => {
  console.log("newcon")
  const conn = nsPeer.createConnection()

  conn.setSendHandler((message) => {
    ws.send(message)
  })

  ws.onmessage = (rawMessage) => {
    conn.onMessage(rawMessage)
  }

  conn.onStream((stream) => {
    console.log("new stream")

    stream.onData((data) => {
      console.log("data")
      console.log(data.toString('utf8'))
    })
  })

  //ws.send(JSON.stringify(msg))
})
