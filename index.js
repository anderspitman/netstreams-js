class Stream {
  terminate() {
    this._terminate()
  }

  onError(callback) {
    this._errorCallback = callback
  }

  onTerminate(callback) {
    this._terminateCallback = callback
  }

  onEnd(callback) {
    this._endCallback = callback
  }

  _terminate() {
    throw "_terminate must be implemented"
  }
}

class ProducerStream extends Stream {
  constructor() {
    super()
    //this._dataCallback = () => {}
    //this._endCallback = () => {}
    this._demand = 0
  }

  request(numElements) {
    this._demand += numElements
    this._demandChanged(numElements)
  }

  pipe(consumerStream) {

    this._pipee = consumerStream

    this.onData((data) => {
      consumerStream.write(data)
    })

    this.onEnd(() => {
      // TODO: ConsumerStream.end doesn't appear to exist...
      consumerStream.end()
    })

    consumerStream.onRequest((numElements) => {
      this.request(numElements)
    })

    consumerStream.onTerminate(() => {
      if (!this._terminated) {
        this.terminate()
      }
    })
  }

  onData(callback) {
    this._dataCallback = callback
  }


  _terminate() {
    this._terminated = true

    if (this._pipee) {
      this._pipee.terminate()
    }

    this._terminateCallback()
  }

  _demandChanged() {
    throw "_demandChanged must be implemented"
  }
}


class ConsumerStream extends Stream {
  constructor(options) {
    super()

    const opts = options ? options : {}

    this._endCallback = () => {}
  }

  write(data) {
    this._write(data)
  }

  end() {
    this._ended = true
    this._end()
  }

  onRequest(callback) {
    this._requestCallback = (numElements) => {
      if (!this._ended) {
        callback(numElements)
      }
    }
  }

  onEnd(callback) {
    this._endCallback = () => {
      callback()
      this._ended = true
    }
  }

  _write() {
    throw "_write must be implemented"
  }

  _end() {
    throw "_end must be implemented"
  }
}

module.exports = {
  ProducerStream,
  ConsumerStream,
}
