import { MuxReceiver } from './mux_receiver.mjs';
import { MuxSender } from './mux_sender.mjs';
import { WebSocketInitiator } from './transport.mjs';


const MESSAGE_TYPE_CREATE_RECEIVER = 0
const MESSAGE_TYPE_STREAM_DATA = 1
const MESSAGE_TYPE_STREAM_END = 2
const MESSAGE_TYPE_TERMINATE_SENDER = 3
const MESSAGE_TYPE_STREAM_REQUEST_DATA = 4
const MESSAGE_TYPE_CONTROL_MESSAGE = 5


export { Multiplexer } from './multiplexer.mjs';
