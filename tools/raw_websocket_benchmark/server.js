const WebSocket = require('ws')

const wsServer = new WebSocket.Server({ port: 9001 })

wsServer.on('connection', (ws) => {

  let size
  let receivedBytes = 0

  ws.addEventListener('message', (message) => {

    if (!size) {
      size = Number(message.data)
      console.log(size)
    }
    else {
      receivedBytes += message.data.length

      if (receivedBytes === size) {
        ws.send("done")
      } 
    }
  })
})
