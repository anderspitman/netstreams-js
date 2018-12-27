const { ProducerStream, ConsumerStream } = require('omnistreams-core')
const ab2str = require('arraybuffer-to-string')
const str2ab = require('string-to-arraybuffer')

const MESSAGE_TYPE_CREATE_RECEIVE_STREAM = 0
const MESSAGE_TYPE_STREAM_DATA = 1
const MESSAGE_TYPE_STREAM_END = 2
const MESSAGE_TYPE_TERMINATE_SEND_STREAM = 3
const MESSAGE_TYPE_STREAM_REQUEST_DATA = 4
const MESSAGE_TYPE_CONTROL_MESSAGE = 5


class Multiplexer {
  constructor() {

    this._sendStreams = {}
    this._receiveStreams = {}
    this._nextStreamId = 0
  }

  onControlMessage(callback) {
    this._controlMessageCallback = callback
  }

  sendControlMessage(controlMessage) {
    const message = new Uint8Array(1 + controlMessage.byteLength)
    message[0] = MESSAGE_TYPE_CONTROL_MESSAGE
    message.set(controlMessage, 1) 
    this._send(message)
  }

  handleMessage(rawMessage) {

    const byteMessage = new Uint8Array(rawMessage)
    const message = {}

    message.type = byteMessage[0]

    if (message.type === MESSAGE_TYPE_CONTROL_MESSAGE) {
      const controlMessage = new Uint8Array(byteMessage.buffer, 1)
      console.log("Control message: " + controlMessage)
      this._controlMessageCallback(controlMessage)
    }
    else {

      message.streamId = byteMessage[1]
      message.data = new Uint8Array(byteMessage.buffer, 2)

      switch (message.type) {
        case MESSAGE_TYPE_CREATE_RECEIVE_STREAM: {
          console.log("Create stream: " + message.streamId)

          
          const producer = this._makeReceiveStream(message.streamId)

          this._receiveStreams[message.streamId] = producer

          const metadata = JSON.parse(ab2str(message.data))

          this._onChannelCallback(producer, metadata)

          break;
        }
        case MESSAGE_TYPE_STREAM_DATA: {
          //console.log("Stream data for stream: " + message.streamId)

          const stream = this._receiveStreams[message.streamId]
          if (stream) {
            stream.receive(message.data)
          }
          else {
            console.error("Invalid stream id: " + message.streamId)
          }

          break;
        }
        case MESSAGE_TYPE_STREAM_END: {
          console.log("Stream ended: " + message.streamId)
          const stream = this._receiveStreams[message.streamId]
          stream.end()
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
        case MESSAGE_TYPE_STREAM_REQUEST_DATA: {
          const elementRequested = message.data[0]

          const stream = this._sendStreams[message.streamId]
          stream._requestCallback(elementRequested)
          break;
        }
        default: {
          console.error("Unsupported message type: " + message.type)
          break;
        }
      }
    }
  }

  setSendHandler(handler) {
    this._send = handler
  }

  onChannel(callback) {
    this._onChannelCallback = callback
  }

  createChannel(metadata) {
    const id = this.nextStreamId()
    const stream = this._makeSendStream(id)
    this._sendStreams[id] = stream
    this._signalCreateChannel(id, metadata)
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

    const requestFunc = (numElements) => {
      const message = new Uint8Array(3)
      message[0] = MESSAGE_TYPE_STREAM_REQUEST_DATA
      message[1] = id 
      message[2] = numElements
      this._send(message)
    }

    const terminateFunc = () => {
      this._terminateReceiveStream(id)
    }

    const stream = new ReceiveStream({ requestFunc, terminateFunc })
    return stream
  }

  nextStreamId() {
    const next = this._nextStreamId
    this._nextStreamId++
    return next
  }

  _signalCreateChannel(streamId, metadata) {

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
    return message
  }

  _isLocalStream(streamId) {
    return this._sendStreams[streamId] !== undefined
  }
}


class SendStream extends ConsumerStream {
  constructor({ sendFunc, endFunc, terminateFunc, bufferSize, chunkSize }) {
    super()

    this._send = sendFunc
    this._endUpstream = endFunc
    this._terminate = terminateFunc
    this._bufferSize = bufferSize ? bufferSize : 2*1024*1024
    this._chunkSize = chunkSize ? chunkSize : 1024*1024
  }

  _write(data) {
    if (this._finished) {
      return
    }

    data = new Uint8Array(data)
    this.send(data)
  }

  _end() {
    this._finished = true
    this._endUpstream()
    this._endCallback()
  }

  send(data) {
    const array = new Uint8Array(data)
    this._send(array)
  }

  terminate() {
    this._terminate()
  }

  stop() {
    if (this._chunker) {
      this._chunker.cancel()
    }
    this._terminateCallback()
  }

  onFlushed(callback) {
    this._onFlushed = callback
  }

  onTerminateOld(callback) {
    this._terminateCallback = callback
  }
}


class ReceiveStream extends ProducerStream {

  constructor({ requestFunc, terminateFunc }) {
    super()

    this._request = requestFunc
    this.onTerminate(terminateFunc)
    this._totalBytesReceived = 0
    this._buffer = new Uint8Array(2*1024*1024)
    this._offset = 0
  }

  _demandChanged(numElements) {
    if (this._terminated) {
      return
    }

    this._request(numElements)
  }

  end() {
    this._endCallback()
  }

  receive(data) {
    if (this._terminated) {
      return
    }

    this._dataCallback(data)
  }
}

module.exports = {
  Multiplexer,
}
