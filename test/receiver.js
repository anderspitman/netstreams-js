const { assert, expect } = require('chai')
const { ReceiveStream } = require('../src/receiver')

describe('Receiver', function() {
  it("can be terminated", function() {
    const receiver = new ReceiveStream({
      requestFunc: () => {},
      terminateFunc: () => {},
    })
  })
})
