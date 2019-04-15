const { assert, expect } = require('chai')
import { Multiplexer } from '../';

describe('Multiplexer', function() {

  let mux1
  let mux2

  beforeEach(function() {
    mux1 = new Multiplexer()
    mux2 = new Multiplexer()

    mux1.setSendHandler((message) => {
      mux2.handleMessage(message)
    })
    mux2.setSendHandler((message) => {
      mux1.handleMessage(message)
    })
  })

  describe('basic send', function() {
    it('works', function() {
      const expected = new Uint8Array([65, 66, 67, 68])
      mux2.onConduit((producer, metadata) => {
        producer.onData((data) => {
          expect(data).to.eql(expected)
        })
      })
      const consumer = mux1.createConduit()
      consumer.write(expected.slice())
    })
  })

  describe('Consumer', function() {
    describe('#end', function() {
      it('fails to write after ending', function() {
        const consumer = mux1.createConduit()
        consumer.end()
        expect(() => {
          consumer.write(new Uint8Array([65]))
        }).to.throw("Consumer: Attempt to call write after calling end")
      })
    })
    describe('#terminate', function() {
      it('fails to write after terminating', function() {
        const consumer = mux1.createConduit()
        consumer.terminate()
        expect(() => {
          consumer.write(new Uint8Array([65]))
        }).to.throw("Consumer: Attempt to call write after calling terminate")
      })
      it('terminates the remote end', function() {
        let remoteTerminated = false
        mux2.onConduit((producer, metadata) => {
          producer.onTermination(() => {
            remoteTerminated = true
          })
        })

        const consumer = mux1.createConduit()
        consumer.terminate()
        //expect(remoteTerminated).to.equal(true)
      })
    })
  })

  describe('Conduit', function() {

    describe('#getConsumers', function() {
      it('starts empty', function() {
        expect(mux1.getConsumers().length).to.equal(0)
        expect(mux2.getConsumers().length).to.equal(0)
      })

      it('local end grows when createConduit is called', function() {
        mux1.createConduit()
        expect(mux1.getConsumers().length).to.equal(1)
        expect(mux2.getConsumers().length).to.equal(0)
        mux2.createConduit()
        expect(mux1.getConsumers().length).to.equal(1)
        expect(mux2.getConsumers().length).to.equal(1)
      })

      it("local end shrinks when ending consumers", function() {
        const consumer = mux1.createConduit()
        expect(mux1.getConsumers().length).to.equal(1)
        consumer.end()
        expect(mux1.getConsumers().length).to.equal(0)
      })
    })

    describe('#getProducers', function() {
      it('starts empty', function() {
        expect(mux1.getProducers().length).to.equal(0)
        expect(mux2.getProducers().length).to.equal(0)
      })

      it('remote end grows when createConduit is called', function() {
        mux1.createConduit()
        expect(mux1.getProducers().length).to.equal(0)
        expect(mux2.getProducers().length).to.equal(1)
        mux2.createConduit()
        expect(mux1.getProducers().length).to.equal(1)
        expect(mux2.getProducers().length).to.equal(1)
      })

      it("remote end shrinks when ending consumers", function() {
        const consumer = mux1.createConduit()
        expect(mux2.getProducers().length).to.equal(1)
        consumer.end()
        expect(mux2.getProducers().length).to.equal(0)
      })
    })

    it('can only create 256 conduits', function() {
      const expected = new Uint8Array([65, 66, 67, 68])

      for (let i = 0; i < 256; i++) {
        expect(mux1.createConduit()).to.not.equal(null)
        expect(mux1.getConsumers().length).to.equal(i+1)
      }
      expect(mux1.createConduit()).to.equal(null)
      expect(mux1.getConsumers().length).to.equal(256)
    })

    it('can accept one additional conduit after ending one', function() {
      const expected = new Uint8Array([65, 66, 67, 68])

      const firstConsumer = mux1.createConduit()

      for (let i = 0; i < 255; i++) {
        expect(mux1.createConduit()).to.not.equal(null)
      }
      expect(mux1.createConduit()).to.equal(null)
      expect(mux1.getConsumers().length).to.equal(256)

      firstConsumer.end()
      expect(mux1.getConsumers().length).to.equal(255)
      expect(mux1.createConduit()).to.not.equal(null)
      expect(mux1.getConsumers().length).to.equal(256)
    })

    it("doesn't fail if request received after end", function() {
      let producer
      mux2.onConduit((newProducer, metadata) => {
        producer = newProducer
      })
      const consumer = mux1.createConduit()
      consumer.end()
      producer.request(1)
    })
  })
})
