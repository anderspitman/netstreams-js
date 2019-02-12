const { Producer, Consumer } = require('omnistreams-core')

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
    this._availableStreamIds = []
    for (let i = 0; i < 256; i++) {
      this._availableStreamIds.push(i)
    }

    this._onConduitCallback = () => {}
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
      this._controlMessageCallback(controlMessage)
    }
    else {

      message.streamId = byteMessage[1]

      if (byteMessage.length > 2) {
        message.data = new Uint8Array(byteMessage.buffer, 2)
      }

      switch (message.type) {
        case MESSAGE_TYPE_CREATE_RECEIVE_STREAM: {
          
          const producer = this._makeReceiveStream(message.streamId)

          this._receiveStreams[message.streamId] = producer

          const metadata = message.data

          this._onConduitCallback(producer, metadata)

          break;
        }
        case MESSAGE_TYPE_STREAM_DATA: {

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
          const stream = this._receiveStreams[message.streamId]
          stream.end()
          // TODO: delete stream from this._receiveStreams
          break;
        }
        case MESSAGE_TYPE_TERMINATE_SEND_STREAM: {
          const stream = this._sendStreams[message.streamId]
          stream.terminate()
          // TODO: properly delete streams when done
          //delete this._sendStreams[message.streamId]
          break;
        }
        case MESSAGE_TYPE_STREAM_REQUEST_DATA: {
          const elementRequested = message.data[0]

          const stream = this._sendStreams[message.streamId]
          if (stream) {
            stream._requestCallback(elementRequested)
          }
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

  onConduit(callback) {
    this._onConduitCallback = callback
  }

  createConduit(metadata) {
    const id = this.nextStreamId()
    if (id !== null) {
      const stream = this._makeSendStream(id)
      this._sendStreams[id] = stream
      this._signalCreateConduit(id, metadata)
      return stream
    }
    else {
      return null
    }
  }

  getConsumers() {
    return Object.keys(this._sendStreams)
      .map(key => this._sendStreams[key])
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
      this._removeSendStream(id)
    }

    const terminateFunc = () => {
      this._terminateSendStream(id)
      this._removeSendStream(id)
    }

    const stream = new SendStream({ sendFunc, endFunc, terminateFunc })
    return stream
  }

  _removeSendStream(id) {
    const consumer = this._sendStreams[id]
    delete this._sendStreams[id]
    this._availableStreamIds.push(id)
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
    //console.log(JSON.stringify(this._availableStreamIds))
    if (this._availableStreamIds.length > 0) {
      const id = this._availableStreamIds.shift()
      return id
    }
    else {
      return null
    }
  }

  _signalCreateConduit(streamId, metadata) {

    const signallingLength = 2

    let message

    if (metadata) {
      message = new Uint8Array(signallingLength + metadata.byteLength)
      message.set(metadata, signallingLength)
    }
    else {
      message = new Uint8Array(signallingLength)
    }

    // TODO: allow stream ids to go higher than 255, or at least reuse them
    message[0] = MESSAGE_TYPE_CREATE_RECEIVE_STREAM
    message[1] = streamId
    
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
    // TODO: properly terminate upstream when terminate called on local end
    //console.log("terminate send stream: " + streamId)
  }

  _terminateReceiveStream(streamId) {
    const message = new Uint8Array(2)
    message[0] = MESSAGE_TYPE_TERMINATE_SEND_STREAM
    message[1] = streamId

    this._send(message)
  }

  _parseMessage(rawMessage) {
    return message
  }

  _isLocalStream(streamId) {
    return this._sendStreams[streamId] !== undefined
  }
}


class SendStream extends Consumer {
  constructor({ sendFunc, endFunc, terminateFunc, bufferSize, chunkSize }) {
    super()

    this._send = sendFunc
    this._endUpstream = endFunc
    this._terminateUpstream = terminateFunc
    // TODO: remove these
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

  _terminate() {
    this._terminateUpstream()
  }

  //stop() {
  //  this._terminateCallback()
  //}

  onFlushed(callback) {
    this._onFlushed = callback
  }
}


class ReceiveStream extends Producer {

  constructor({ requestFunc, terminateFunc }) {
    super()

    this._request = requestFunc
    this.onTermination(terminateFunc)
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
