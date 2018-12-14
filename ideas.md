* Rename to omnistreams?
  * Doesn't have to be just a network concept. Even with just file read sources
    and write sinks it could be a very useful abstraction.
* Use libp2p as network layer?
  * Going to be transport-agnostic anyway, and connection endpoints are peers
    regardless of how they are connected.
* Probably use the pull backpressure from Reactive Streams, ie consumer
  indicates how many bytes it's willing to receive.
