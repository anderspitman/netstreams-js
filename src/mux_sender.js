const { Consumer } = require('omnistreams-core')


class MuxSender extends Consumer {
  constructor({ sendFunc, endFunc, terminateFunc }) {
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
  MuxSender,
}
