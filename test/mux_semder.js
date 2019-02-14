const { assert, expect } = require('chai')
const { MuxSender } = require('../src/mux_sender')


describe('MuxSender', function() {
  it("#constructor", function() {
    const sender = new MuxSender({
      sendFunc: () => {},
      endFunc: () => {},
    })
  })
})
