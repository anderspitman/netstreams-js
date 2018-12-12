import { Peer } from 'netstreams'


function timeNowSeconds() {
  return performance.now() / 1000
}

const data = new Uint8Array(1024*1024*1024).fill(1)


let startTime

const ws = new WebSocket('ws://localhost:9001')
ws.binaryType = 'arraybuffer'

const nsPeer = new Peer()

let conn;
ws.onopen = () => {

  conn = nsPeer.createConnection()

  ws.onmessage = (message) => {
    conn.handleMessage(message.data)
  }

  conn.setSendHandler((message) => {
    ws.send(message)
  })

  const stream = conn.createStream({})

  startTime = timeNowSeconds()
  stream.write(data).then(() => {
    stream.end()
  })
  .catch((err) => {
    console.error(err)
  })

  stream.onFlushed(() => {
    const duration = timeNowSeconds() - startTime
    const mebibytes = data.length / 1024 / 1024
    console.log(mebibytes)
    const mebibits = mebibytes * 8
    console.log(mebibits)
    const bitrate = mebibits / duration
    console.log("bitrate: " + bitrate + "mbps")
  })
}

