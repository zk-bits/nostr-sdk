import tape from 'tape'

import { NostrRelay }  from '@/class/relay.js'

import socket_test from './socket.test.js'

tape('Socket Integration Tests', async t => {
  // Create a new relay for testing.
  const relay = new NostrRelay()
  // Start the relay.
  await relay.start()
  // Run the socket test.
  await socket_test(t)
  // Stop the relay.
  t.teardown(() => { relay.stop() })
})
