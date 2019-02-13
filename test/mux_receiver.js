const { assert, expect } = require('chai')
const { MuxReceiver } = require('../src/mux_receiver')

describe('Receiver', function() {
  it("can be terminated", function() {

    let upstreamTerminateCalled = false
    let onTerminationCalled = false
    const receiver = new MuxReceiver({
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
