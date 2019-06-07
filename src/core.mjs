class Streamer {
  constructor() {
    this._terminateCallback = () => {}
    this._terminated = false
  }

  terminate() {
    if (!this._terminated) {
      this._terminated = true
      this._terminate()
      this._terminateCallback()
    }
  }

  onError(callback) {
    this._errorCallback = callback
  }

  onTermination(callback) {
    this._terminateCallback = callback
  }

  _terminate() {
    throw "_terminate must be implemented"
  }
}

class Producer extends Streamer {
  constructor() {
    super()
    this._demand = 0
    this._dataCallback = () => {}
    this._endCallback = () => {}
  }

  request(numElements) {
    this._demand += numElements
    this._demandChanged(numElements)
  }

  pipe(consumer) {

    this._pipee = consumer

    this.onData((data) => {
      consumer.write(data)
    })

    this.onEnd(() => {
      consumer.end()
    })

    consumer.onRequest((numElements) => {
      this.request(numElements)
    })

    consumer.onTermination(() => {
      this.terminate()
    })

    // If the consumer is also a Conduit, this will make continued piping
    // more ergonomic
    return consumer
  }

  onData(callback) {
    this._dataCallback = callback
  }

  onEnd(callback) {
    this._endCallback = callback
  }

  terminate() {
    super.terminate()

    if (this._pipee) {
      this._pipee.terminate()
    }
  }

  _demandChanged() {
    throw "_demandChanged must be implemented"
  }
}


class Consumer extends Streamer {
  constructor(options) {
    super()

    const opts = options ? options : {}

    this._endCallback = () => {}
    this._requestCallback = () => {}
    this._finishCallback = () => {}
  }

  write(data) {
    this._write(data)
  }

  end() {

    this.write = () => {
      throw new Error("Consumer: Attempt to call write after calling end")
    }

    this._ended = true
    this._end()
  }

  // override
  terminate() {
    super.terminate()

    this.write = () => {
      throw new Error("Consumer: Attempt to call write after calling terminate")
    }
  }

  onRequest(callback) {
    this._requestCallback = (numElements) => {
      if (!this._ended) {
        callback(numElements)
      }
    }
  }

  onFinish(callback) {
    this._finishCallback = callback
  }

  _write() {
    throw "_write must be implemented"
  }

  _end() {
    throw "_end must be implemented"
  }
}

export { Consumer, Producer };
