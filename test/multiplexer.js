const { assert, expect } = require('chai')
const { Multiplexer } = require('../')

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
    it('fails to write after ending', function() {
      const consumer = mux1.createConduit()
      consumer.end()
      expect(() => {
        consumer.write(new Uint8Array([65]))
      }).to.throw()
    })
  })

  describe('Conduit', function() {
    it('can only create 256 conduits', function() {
      const expected = new Uint8Array([65, 66, 67, 68])

      for (let i = 0; i < 256; i++) {
        expect(mux1.createConduit()).to.not.equal(null)
      }
      expect(mux1.createConduit()).to.equal(null)
    })

    it('can accept one additional conduit after ending one', function() {
      const expected = new Uint8Array([65, 66, 67, 68])

      const firstConsumer = mux1.createConduit()

      for (let i = 0; i < 255; i++) {
        expect(mux1.createConduit()).to.not.equal(null)
      }
      expect(mux1.createConduit()).to.equal(null)

      firstConsumer.end()
      expect(mux1.createConduit()).to.not.equal(null)
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
