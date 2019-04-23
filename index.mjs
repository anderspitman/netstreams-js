function encodeObject(obj) {
  const enc = new TextEncoder();
  return enc.encode(JSON.stringify(obj));
}

function decodeObject(array) {
  return JSON.parse(String.fromCharCode.apply(null, new Uint8Array(array)));
}

export { Multiplexer } from './src/multiplexer.mjs';
export { Producer, Consumer } from './src/core.mjs';
export { initiateWebSocketMux } from './src/transport.mjs';
export { encodeObject, decodeObject };
