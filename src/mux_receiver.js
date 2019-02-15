const { Producer } = require('omnistreams-core')

class MuxReceiver extends Producer {

  constructor({ requestFunc, terminateFunc }) {
    super()

    this._request = requestFunc
    this._upstreamTerminate = terminateFunc
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

  stop() {
    this._endCallback()
  }

  receive(data) {
    if (this._terminated) {
      return
    }

    this._dataCallback(data)
  }

  _terminate() {
    this._upstreamTerminate()
  }
}

module.exports = {
  MuxReceiver,
}
