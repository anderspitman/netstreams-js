const { assert, expect } = require('chai')
const { ReceiveStream } = require('../src/receiver')

describe('Receiver', function() {
  it("can be terminated", function() {

    let upstreamTerminateCalled = false
    let onTerminationCalled = false
    const receiver = new ReceiveStream({
      requestFunc: () => {},
      terminateFunc: () => {
        upstreamTerminateCalled = true
      },
    })
    receiver.onTermination(() => {
      onTerminationCalled = true
    })

    receiver.terminate()
    expect(upstreamTerminateCalled).to.equal(true)
    expect(onTerminationCalled).to.equal(true)
  })
})
