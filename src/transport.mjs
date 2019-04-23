import { Multiplexer } from './multiplexer.mjs';


class WebSocketTransport {
  constructor(ws) {
    this._ws = ws;

    this._ws.binaryType = 'arraybuffer';

    this._ws.addEventListener('message', (message) => {
      if (this._messageCallback) {
        this._messageCallback(message.data);
      }
    });
  }

  send(message) {
    this._ws.send(message);
  }

  onMessage(callback) {
    this._messageCallback = callback;
  }
}


async function initiateWebSocketMux(options) {

  const address = options && options.address ? options.address : '127.0.0.1';
  const port = options && options.port ? options.port : 9001;
  const secure = options && options.secure ? options.secure : false;

  let wsProtoStr;
  if (secure) {
    wsProtoStr = 'wss:';
  }
  else {
    wsProtoStr = 'ws:';
  }

  const wsString = `${wsProtoStr}//${address}:${port}/omnistreams`
  const ws = new WebSocket(wsString);
  const transport = new WebSocketTransport(ws);

  return new Promise((resolve, reject) => {
    ws.addEventListener('open', () => {
      resolve(new Multiplexer(transport));
    })
  });
}

export { initiateWebSocketMux };
