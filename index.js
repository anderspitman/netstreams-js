const MESSAGE_TYPE_CREATE_STREAM = 0
const MESSAGE_TYPE_STREAM_DATA = 1


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
}


class Connection {
  constructor() {

    this._localStreams = {}
    this._remoteStreams = {}
    this._nextStreamId = 0
  }

  onMessage(rawMessage) {
    const message = this._parseMessage(rawMessage)

    switch (message.type) {
      case MESSAGE_TYPE_CREATE_STREAM: {
        console.log("Create new stream: " + message.streamId)

        const stream = this._makeStream(message.streamId)
        this._remoteStreams[message.streamId] = stream
        this._onStream(stream)

        break;
      }
      case MESSAGE_TYPE_STREAM_DATA: {
        console.log("Stream data for stream: " + message.streamId)

        const stream = this._remoteStreams[message.streamId]
        if (stream) {
          stream.onReceive(message.data)
        }
        else {
          console.error("Invalid stream id: " + message.streamId)
        }

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
    const stream = this._makeStream(id)
    this._localStreams[id] = stream
    this._signalCreateStream(id)
    return stream
  }

  _makeStream(id) {
    const stream = new Stream(id, this._streamSend.bind(this))
    return stream
  }

  nextStreamId() {
    const next = this._nextStreamId
    this._nextStreamId++
    return next
  }

  _signalCreateStream(streamId) {
    // TODO: allow stream ids to go higher than 256, or at least reuse them
    const message = new Uint8Array(2)
    message[0] = MESSAGE_TYPE_CREATE_STREAM
    message[1] = streamId

    this._send(message)
  }

  _streamSend(streamId, data) {
    const message = new Uint8Array(2 + data.length)
    message[0] = MESSAGE_TYPE_STREAM_DATA
    message[1] = streamId 

    for (let i = 0; i < data.byteLength; i++) {
      message[i+2] = data[i]
    }
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
}


class Stream {
  constructor(id, sendFunc) {
    this.id = id
    this._send = sendFunc
  }

  write(data) {
    this._send(this.id, data)
  }

  onData(callback) {
    this._onData = callback
  }

  onReceive(data) {
    this._onData(data)
  }
}

module.exports = {
  Peer,
}