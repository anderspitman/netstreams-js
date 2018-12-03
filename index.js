const { FileChunker } = require('file-chunk-reader')
const ab2str = require('arraybuffer-to-string')
const str2ab = require('string-to-arraybuffer')

const MESSAGE_TYPE_CREATE_STREAM = 0
const MESSAGE_TYPE_STREAM_DATA = 1
const MESSAGE_TYPE_STREAM_END = 2
const MESSAGE_TYPE_TERMINATE_SEND_STREAM = 3


class Peer {
  constructor() {
    this._connections = {}
    this._nextConnectionId = 0
  }

  _getNextConnectionId() {
    const next = this._nextConnectionId
    this._nextConnectionId++
    return next
  }

  createConnection() {
    const connection = new Connection
    const id = this._getNextConnectionId()
    this._connections[id] = connection
    return connection
  }

  createWebsocketConnection(ws) {

    return new Promise(function(resolve, reject) {

      const conn = new Connection

      ws.binaryType = 'arraybuffer'

      ws.onopen = (event) => {

        conn.setSendHandler((message) => {
          ws.send(message)
        })

        ws.onmessage = (rawMessage) => {
          conn.onMessage(rawMessage)
        }

        resolve(conn);
      }

      ws.onerror = (err) => {
        reject(err);
      }
    });
  }
}


class Connection {
  constructor() {

    this._sendStreams = {}
    this._receiveStreams = {}
    this._nextStreamId = 0
  }

  onMessage(rawMessage) {
    const message = this._parseMessage(rawMessage)

    switch (message.type) {
      case MESSAGE_TYPE_CREATE_STREAM: {
        console.log("Create stream: " + message.streamId)

        
        const stream = this._makeReceiveStream(message.streamId)

        this._receiveStreams[message.streamId] = stream

        const metadata = JSON.parse(ab2str(message.data))

        this._onStream(stream, metadata)

        break;
      }
      case MESSAGE_TYPE_STREAM_DATA: {
        //console.log("Stream data for stream: " + message.streamId)

        const stream = this._receiveStreams[message.streamId]
        if (stream) {
          stream.onReceive(message.data)
        }
        else {
          console.error("Invalid stream id: " + message.streamId)
        }

        break;
      }
      case MESSAGE_TYPE_STREAM_END: {
        console.log("Stream ended: " + message.streamId)
        const stream = this._receiveStreams[message.streamId]
        stream._onEnd()
        break;
      }
      case MESSAGE_TYPE_TERMINATE_SEND_STREAM: {
        console.log("Terminate send stream: " + message.streamId)
        const stream = this._sendStreams[message.streamId]
        stream.stop()
        delete this._sendStreams[message.streamId]
        break;
      }
      default: {
        console.error("Unsupported message type: " + message.type)
        break;
      }
    }
  }

  setSendHandler(handler) {
    this._send = handler
  }

  onStream(callback) {
    this._onStream = callback
  }

  createStream(metadata) {
    const id = this.nextStreamId()
    const stream = this._makeSendStream(id)
    this._sendStreams[id] = stream
    this._signalCreateStream(id, metadata)
    return stream
  }

  _makeSendStream(id) {
    const sendFunc = (data) => {
      this._streamSend(id, data)
    }

    const endFunc = () => {
      const message = new Uint8Array(2)
      message[0] = MESSAGE_TYPE_STREAM_END
      message[1] = id 
      this._send(message)
    }

    const terminateFunc = () => {
      this._terminateSendStream(id)
    }

    const stream = new SendStream({ sendFunc, endFunc, terminateFunc })
    return stream
  }

  _makeReceiveStream(id) {

    const terminateFunc = () => {
      this._terminateReceiveStream(id)
    }

    const stream = new ReceiveStream({ terminateFunc })
    return stream
  }

  nextStreamId() {
    const next = this._nextStreamId
    this._nextStreamId++
    return next
  }

  _signalCreateStream(streamId, metadata) {

    const mdString = JSON.stringify(metadata)
    const mdArray = new Uint8Array(str2ab(mdString))

    // TODO: allow stream ids to go higher than 256, or at least reuse them
    const message = new Uint8Array(2 + mdArray.byteLength)
    message[0] = MESSAGE_TYPE_CREATE_STREAM
    message[1] = streamId

    for (let i = 0; i < mdArray.byteLength; i++) {
      message[i+2] = mdArray[i]
    }
    
    this._send(message)
  }

  _streamSend(streamId, data) {
    const message = new Uint8Array(2 + data.byteLength)
    message[0] = MESSAGE_TYPE_STREAM_DATA
    message[1] = streamId 

    for (let i = 0; i < data.byteLength; i++) {
      message[i+2] = data[i]
    }
    this._send(message)
  }

  _terminateSendStream(streamId) {
    console.log("terminate send stream: " + streamId)
  }

  _terminateReceiveStream(streamId) {
    console.log("terminate receive stream: " + streamId)
    const message = new Uint8Array(2)
    message[0] = MESSAGE_TYPE_TERMINATE_SEND_STREAM
    message[1] = streamId

    console.log("send it")
    console.log(message)
    this._send(message)
  }

  _parseMessage(rawMessage) {
    const byteMessage = new Uint8Array(rawMessage.data)
    const message = {}
    message.type = byteMessage[0]
    message.streamId = byteMessage[1]
    message.data = byteMessage.slice(2)
    return message
  }

  _isLocalStream(streamId) {
    return this._sendStreams[streamId] !== undefined
  }
}


class SendStream {
  constructor({ sendFunc, endFunc, terminateFunc, chunkSize }) {
    this._send = sendFunc
    this._end = endFunc
    this._terminate = terminateFunc
    this._chunkSize = chunkSize ? chunkSize : 1024
  }

  send(data) {
    this._send(new Uint8Array(data))
  }

  sendFile(file) {

    this._chunker = new FileChunker(file, {
      binary: true,
      chunkSize: 1 * 1024 * 1024,
    })

    this._chunker.onChunk((chunk) => {
      console.log("send chunk")
      this.send(chunk)
    });

    this._chunker.onEnd(() => {
      this._end()
    });

    this._chunker.read()
  }

  terminate() {
    this._terminate()
  }

  stop() {
    if (this._chunker) {
      this._chunker.cancel()
    }
  }
}


class ReceiveStream {

  constructor({ terminateFunc }) {
    this._onData = () => {}
    this._onEnd = () => {}
    this._onTerminate = () => {}
    this._terminate = terminateFunc
  }

  onData(callback) {
    this._onData = callback
  }

  onEnd(callback) {
    this._onEnd = callback
  }

  onReceive(data) {
    this._onData(data)
  }

  terminate() {
    this._terminate()
  }
}

module.exports = {
  Peer,
}
