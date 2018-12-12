const { FileChunker } = require('file-chunk-reader')
const ab2str = require('arraybuffer-to-string')
const str2ab = require('string-to-arraybuffer')

const MESSAGE_TYPE_CREATE_RECEIVE_STREAM = 0
const MESSAGE_TYPE_STREAM_DATA = 1
const MESSAGE_TYPE_STREAM_END = 2
const MESSAGE_TYPE_TERMINATE_SEND_STREAM = 3
const MESSAGE_TYPE_STREAM_ACK = 4


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

  handleMessage(rawMessage) {
    const message = this._parseMessage(rawMessage)

    switch (message.type) {
      case MESSAGE_TYPE_CREATE_RECEIVE_STREAM: {
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
        // TODO: properly delete streams when done
        //delete this._sendStreams[message.streamId]
        break;
      }
      case MESSAGE_TYPE_STREAM_ACK: {
        const dv = new DataView(message.data.buffer)
        const totalBytesAcked = dv.getFloat64(0)

        const stream = this._sendStreams[message.streamId]
        stream.ack(totalBytesAcked)
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

    const ackFunc = (totalBytesReceived) => {
      const message = new DataView(new ArrayBuffer(2 + 8))
      message.setInt8(0, MESSAGE_TYPE_STREAM_ACK)
      message.setInt8(1, id) 

      // use float64 because int32 only supports about 4GiB and javascript
      // doesn't support int64
      message.setFloat64(2, totalBytesReceived)
      this._send(message)
    }

    const terminateFunc = () => {
      this._terminateReceiveStream(id)
    }

    const stream = new ReceiveStream({ ackFunc, terminateFunc })
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

    const signallingLength = 2

    // TODO: allow stream ids to go higher than 255, or at least reuse them
    const message = new Uint8Array(signallingLength + mdArray.byteLength)
    message[0] = MESSAGE_TYPE_CREATE_RECEIVE_STREAM
    message[1] = streamId
    message.set(mdArray, signallingLength)
    
    this._send(message)
  }

  _streamSend(streamId, data) {
    
    const signallingLength = 2
    const message = new Uint8Array(signallingLength + data.byteLength)
    message[0] = MESSAGE_TYPE_STREAM_DATA
    message[1] = streamId 
    message.set(data, signallingLength)
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
    const byteMessage = new Uint8Array(rawMessage)
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
  constructor({ sendFunc, endFunc, terminateFunc, bufferSize, chunkSize }) {
    this._send = sendFunc
    this._end = endFunc
    this._terminate = terminateFunc
    this._bufferSize = bufferSize ? bufferSize : 1024*1024
    // TODO: use this
    this._chunkSize = chunkSize ? chunkSize : 1024
    this._totalBytesSent = 0
    this._totalBytesAcked = 0

    this._bufferFull = false
    this._paused = false
  }

  send(data) {
    const array = new Uint8Array(data)
    this._totalBytesSent += array.byteLength
    this._send(array)
  }

  ack(totalBytesAcked) {
    this._totalBytesAcked = totalBytesAcked
    this._checkBuffer()
  }

  sendFile(file) {

    this._chunker = new FileChunker(file, {
      binary: true,
      chunkSize: 1024 * 1024,
    })

    this._chunker.onChunk((chunk, readyForMore) => {
      this.send(chunk)

      this._checkBuffer()

      if (!this._bufferFull) {
        readyForMore()
      }
      else {
        this._paused = true
        this._readyForMore = readyForMore
      }
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

  _checkBuffer() {
    const bytesInFlight = this._totalBytesSent - this._totalBytesAcked
    if (bytesInFlight > this._bufferSize) {
      this._bufferFull = true
    }
    else {
      if (this._paused) {
        this._paused = false
        this._readyForMore()
        this._readyForMore = null
      }
    }
  }
}


class ReceiveStream {

  constructor({ ackFunc, terminateFunc }) {
    this._onData = () => {}
    this._onEnd = () => {}
    this._onTerminate = () => {}
    this._ack = ackFunc
    this._terminate = terminateFunc
    this._totalBytesReceived = 0
  }

  onData(callback) {
    this._onData = callback
  }

  onEnd(callback) {
    this._onEnd = callback
  }

  onReceive(data) {
    this._onData(data)
    this._totalBytesReceived += data.byteLength
    this._ack(this._totalBytesReceived)
  }

  terminate() {
    this._terminate()
  }
}

module.exports = {
  Peer,
}
