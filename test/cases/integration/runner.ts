import tape from 'tape'

import { NostrRelay } from '@/class/relay.js'
import { TEST_PORTS } from '#/config.js'

import socket_test       from './socket.test.js'
import relay_tests       from './relay.test.js'
import subscription_tests from './subscription.test.js'
import client_tests      from './client.test.js'

tape('Socket Integration Tests', async t => {
  // Create a new relay for testing.
  const relay = new NostrRelay()
  // Start the relay.
  await relay.start({ port: TEST_PORTS.SOCKET_RELAY })
  // Run the socket test.
  await socket_test(t)
  // Stop the relay.
  t.teardown(() => { relay.stop() })
})

tape('Relay Integration Tests', async t => {
  await relay_tests(t)
  t.end()
})

tape('Subscription Integration Tests', async t => {
  await subscription_tests(t)
  t.end()
})

tape('Client Integration Tests', async t => {
  await client_tests(t)
  t.end()
})
