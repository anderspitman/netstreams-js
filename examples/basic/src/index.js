import { Peer as NetStreamPeer } from '../../../'


const nsPeer = new NetStreamPeer

const ws = new WebSocket('ws://localhost:9001')

ws.binaryType = 'arraybuffer'

ws.onopen = (event) => {
  console.log("open")
  const conn = nsPeer.createConnection()

  conn.setSendHandler((message) => {
    ws.send(message)
  })

  ws.onmessage = (rawMessage) => {
    conn.onMessage(rawMessage)
  }

  const metadata = {}
  const stream = conn.createStream(metadata)
  const stream2 = conn.createStream(metadata)

  const enc = new TextEncoder()

  stream.write(enc.encode("hi there"))
  stream.write(new Uint8Array([2,3,4,5,6]))
  stream2.write(enc.encode("yolo"))
}
