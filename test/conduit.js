const { assert, expect } = require('chai')
import { BufferConduit } from '../';

describe('Conduit', function() {

  //let mux1
  //let mux2

  //beforeEach(function() {
  //  mux1 = new Multiplexer()
  //  mux2 = new Multiplexer()

  //  mux1.setSendHandler((message) => {
  //    mux2.handleMessage(message)
  //  })
  //  mux2.setSendHandler((message) => {
  //    mux1.handleMessage(message)
  //  })
  //})

  describe('BufferConduit', function() {

    const conduit = new BufferConduit();
    const data = new Uint8Array([65, 66, 67, 68])

    describe('basic', function() {
      it('does not crash', function() {

        conduit.onData((data) => {
          //console.log(data);
        });

        conduit.onEnd(() => {
          //console.log("end");
        });

        conduit.onRequest((n) => {
          //console.log(n);
        });

        conduit.write(data);
        conduit.end();
        conduit.request(1);
      })
    })

    describe('#pipeThrough', function() {
      
      const c1 = new BufferConduit();
      const c2 = new BufferConduit();
      const c3 = new BufferConduit();

      it('does not crash', function() {

        c1.write(data);
        c1.onRequest((n) => {
        });

        const producer = c1
          .pipeThrough(c2)
          .pipeThrough(c3);

        producer.onData((data) => {
          //console.log(data);
        });
        producer.request(1);
      })
    })
  })
})
