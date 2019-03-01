import { Multiplexer } from 'omnistreams'
import { FileReadProducer } from 'omnistreams-filereader'


function timeNowSeconds() {
  return performance.now() / 1000
}

//const data = new Uint8Array(30)
//  .fill(1, 0, 10)
//  .fill(2, 10, 20)
//  .fill(3, 20, 30)

let startTime

const ws = new WebSocket('ws://localhost:9001')
//const ws = new WebSocket('ws://lf-proxy.iobio.io')
ws.binaryType = 'arraybuffer'

ws.onopen = () => {

  const uploadButton = document.getElementById('file_button')
  uploadButton.addEventListener('change', (e) => {
    const file = e.target.files[0]

    const mux = new Multiplexer()

    ws.onmessage = (message) => {
      mux.handleMessage(message.data)
    }

    mux.setSendHandler((message) => {
      ws.send(message)
    })

    mux.onControlMessage((message) => {
      console.log(message)
    })

    const consumer = mux.createConduit()

    startTime = timeNowSeconds()

    console.log("first write")
    const firstTime = timeNowSeconds() - startTime
    console.log(firstTime)

    const chunkSize = 1024*1024

    // TODO: should probably use a raw typed array Producer rather than going
    // through the file reader
    const fileProducer = new FileReadProducer(file, { chunkSize })
    fileProducer.pipe(consumer)

    mux.onControlMessage((message) => {
      const duration = timeNowSeconds() - startTime
      const mebibytes = data.length / 1024 / 1024
      console.log(mebibytes)
      const mebibits = mebibytes * 8
      console.log(mebibits)
      const bitrate = mebibits / duration
      console.log("bitrate: " + bitrate + "mbps")
    })
  })
}

