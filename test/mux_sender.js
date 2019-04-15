const { assert, expect } = require('chai')
import { MuxSender } from '../src/mux_sender.mjs';


describe('MuxSender', function() {
  it("#constructor", function() {
    const sender = new MuxSender({
      sendFunc: () => {},
      endFunc: () => {},
    })
  })
})
