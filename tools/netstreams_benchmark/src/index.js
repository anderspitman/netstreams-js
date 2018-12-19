import { Peer } from 'netstreams'


function timeNowSeconds() {
  return performance.now() / 1000
}

//const data = new Uint8Array(10*1024*1024)
const data = new Uint8Array(30)
  .fill(1, 0, 10)
  .fill(2, 10, 20)
  .fill(3, 20, 30)

console.log(data)


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

  console.log("first write")
  const firstTime = timeNowSeconds() - startTime
  console.log(firstTime)

  const chunkSize = 10

  let offset = 0
  stream.onRequest((numElements) => {
    console.log(offset, numElements)

    const numBytes = numElements * chunkSize

    if (offset + numBytes > data.byteLength) {
      console.log("end it")
      stream.end()
    }
    else {

      const d = new Uint8Array(data.buffer, offset, numBytes)
      offset += numBytes
      console.log(d)
      stream.write(d)
    }
  })

  //stream.write(data).then(() => {
  //  console.log("end")
  //  stream.end()
  //})
  //.catch((err) => {
  //  console.error(err)
  //})

  //console.log("second write")
  //const secondTime = timeNowSeconds() - startTime
  //console.log(secondTime)

  ////stream.write(data)

  //stream.onFlushed(() => {
  //  const duration = timeNowSeconds() - startTime
  //  const mebibytes = data.length / 1024 / 1024
  //  console.log(mebibytes)
  //  const mebibits = mebibytes * 8
  //  console.log(mebibits)
  //  const bitrate = mebibits / duration
  //  console.log("bitrate: " + bitrate + "mbps")
  //})
}

