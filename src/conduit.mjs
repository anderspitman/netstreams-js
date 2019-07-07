import { pipeInto, pipeThrough } from './core.mjs';


class BufferConduit {
  constructor(capacity) {
    this._capacity = capacity ? capacity : 1;
    this._downstreamDemand = 0;
    this._upstreamDemand = this._capacity;
    this._buffer = [];

    this.onTermination(() => {});
    this.onRequest(() => {});
  }

  write(data) {
    if (this._upstreamDemand > 0) {
      this._buffer.push(data);
      this._upstreamDemand--;
      this._flush();
    }
    else {
      throw new Error("Attempt to write more than requested");
    }
  }

  end() {
    this._onEnd();
  }

  terminate(reason) {
    if (this._pipee) {
      this._pipee.terminate()
    }

    this._onTerminate(reason);
  }

  request(n) {
    this._downstreamDemand += n;
    this._flush();
  }

  // TODO: this is deprecated
  pipe(consumer) {
    return this.pipeThrough(consumer);
  }

  pipeInto(consumer) {
    this._pipee = consumer;
    pipeInto(this, consumer);
  }

  pipeThrough(conduit) {
    this._pipee = conduit;
    return pipeThrough(this, conduit);
  }

  onData(callback) {
    this._onData = callback;
  }

  onEnd(callback) {
    this._onEnd = callback;
  }

  onRequest(callback) {
    this._onRequest = callback;
    // TODO: not sure about this. Seems like there could be unintended
    // consequences.
    this._onRequest(this._upstreamDemand);
  }

  onTermination(callback) {
    this._onTerminate = callback
  }

  _flush() {
    while (this._downstreamDemand > 0 && this._buffer.length > 0) {
      this._onData(this._buffer.shift());
      this._downstreamDemand--;
      this._upstreamDemand++;
      this._onRequest(1);
    }
  }
}

export { BufferConduit };
