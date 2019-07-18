import { pipeInto, pipeThrough } from './core.mjs';


// TODO: inherit from a Conduit base class for things like the pipe plumbing
//
class MapConduit {
  constructor(mapFunc) {
    this._mapFunc = mapFunc ? mapFunc : x => x;

    this.onTermination(() => {});
    this.onRequest(() => {});

    this._terminated = false;
  }

  write(data) {
    this._onData(this._mapFunc(data));
  }

  end() {
    this._onEnd();
  }

  terminate(reason) {
    // TODO: it was infinitely recursing without this guard. Not sure why.
    if (!this._terminated) {

      this._terminated = true;
      if (this._pipee) {
        this._pipee.terminate()
      }

      this._onTerminate(reason);
    }
  }

  request(n) {
    this._onRequest(n);
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
  }

  onTermination(callback) {
    this._onTerminate = callback
  }
}

export { MapConduit };
