const { Consumer } = require('omnistreams-core')
const { MuxReceiver } = require('./mux_receiver')


const MESSAGE_TYPE_CREATE_RECEIVE_STREAM = 0
const MESSAGE_TYPE_STREAM_DATA = 1
const MESSAGE_TYPE_STREAM_END = 2
const MESSAGE_TYPE_TERMINATE_SENDER = 3
const MESSAGE_TYPE_STREAM_REQUEST_DATA = 4
const MESSAGE_TYPE_CONTROL_MESSAGE = 5


class Multiplexer {
  constructor() {

    this._senders = {}
    this._receivers = {}
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
          
          const producer = this._makeReceiver(message.streamId)

          this._receivers[message.streamId] = producer

          const metadata = message.data

          this._onConduitCallback(producer, metadata)

          break;
        }
        case MESSAGE_TYPE_STREAM_DATA: {

          const stream = this._receivers[message.streamId]
          if (stream) {
            stream.receive(message.data)
          }
          else {
            console.error("Invalid stream id: " + message.streamId)
          }

          break;
        }
        case MESSAGE_TYPE_STREAM_END: {
          const stream = this._receivers[message.streamId]
          stream.end()
          // TODO: delete stream from this._receivers
          break;
        }
        case MESSAGE_TYPE_TERMINATE_SENDER: {
          const stream = this._senders[message.streamId]
          stream.terminate()
          break;
        }
        case MESSAGE_TYPE_STREAM_REQUEST_DATA: {
          const elementRequested = message.data[0]

          const stream = this._senders[message.streamId]
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
      const stream = this._makeSender(id)
      this._senders[id] = stream
      this._signalCreateConduit(id, metadata)
      return stream
    }
    else {
      return null
    }
  }

  getConsumers() {
    return Object.keys(this._senders)
      .map(key => this._senders[key])
  }

  _makeSender(id) {
    const sendFunc = (data) => {
      this._streamSend(id, data)
    }

    const endFunc = () => {
      const message = new Uint8Array(2)
      message[0] = MESSAGE_TYPE_STREAM_END
      message[1] = id 
      this._send(message)
      this._removeSender(id)
    }

    const terminateFunc = () => {
      this._terminateSender(id)
      this._removeSender(id)
    }

    const stream = new MuxSender({ sendFunc, endFunc, terminateFunc })
    return stream
  }

  _removeSender(id) {
    const consumer = this._senders[id]
    delete this._senders[id]
    this._availableStreamIds.push(id)
  }

  _makeReceiver(id) {

    const requestFunc = (numElements) => {
      const message = new Uint8Array(3)
      message[0] = MESSAGE_TYPE_STREAM_REQUEST_DATA
      message[1] = id 
      message[2] = numElements
      this._send(message)
    }

    const terminateFunc = () => {
      this._terminateReceiver(id)
    }

    const stream = new MuxReceiver({ requestFunc, terminateFunc })
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

  _terminateSender(streamId) {
    // TODO: properly terminate upstream when terminate called on local end
    //console.log("terminate send stream: " + streamId)
  }

  _terminateReceiver(streamId) {
    const message = new Uint8Array(2)
    message[0] = MESSAGE_TYPE_TERMINATE_SENDER
    message[1] = streamId

    this._send(message)
  }

  _parseMessage(rawMessage) {
    return message
  }

  _isLocalStream(streamId) {
    return this._senders[streamId] !== undefined
  }
}


class MuxSender extends Consumer {
  constructor({ sendFunc, endFunc, terminateFunc, bufferSize, chunkSize }) {
    super()

    this._send = sendFunc
    this._endUpstream = endFunc
    this._terminateUpstream = terminateFunc
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


module.exports = {
  Multiplexer,
}
