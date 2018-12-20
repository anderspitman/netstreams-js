import { Peer } from 'omnistreams-concurrent'
import { FileReadStream } from 'omnistreams-filereader-js'


function timeNowSeconds() {
  return performance.now() / 1000
}

//const data = new Uint8Array(30)
//  .fill(1, 0, 10)
//  .fill(2, 10, 20)
//  .fill(3, 20, 30)

let startTime

const ws = new WebSocket('ws://localhost:9001')
ws.binaryType = 'arraybuffer'

const nsPeer = new Peer()

let conn;
ws.onopen = () => {

  const data = new Uint8Array(1024*1024*1024).fill(24)

  conn = nsPeer.createConnection()

  ws.onmessage = (message) => {
    conn.handleMessage(message.data)
  }

  conn.setSendHandler((message) => {
    ws.send(message)
  })

  conn.onControlMessage((message) => {
    console.log(message)
  })

  const stream = conn.createStream({})

  startTime = timeNowSeconds()

  console.log("first write")
  const firstTime = timeNowSeconds() - startTime
  console.log(firstTime)

  const chunkSize = 1024*1024

  const file = new File([data], "yolo.og")
  // TODO: should probably use a raw typed array Producer rather than going
  // through the file reader
  const fileProducer = new FileReadStream(file, { chunkSize })
  fileProducer.pipe(stream)

  conn.onControlMessage((message) => {
    const duration = timeNowSeconds() - startTime
    const mebibytes = data.length / 1024 / 1024
    console.log(mebibytes)
    const mebibits = mebibytes * 8
    console.log(mebibits)
    const bitrate = mebibits / duration
    console.log("bitrate: " + bitrate + "mbps")
  })
}

