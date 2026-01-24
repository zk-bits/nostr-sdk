import { Test } from 'tape'

import { NostrClient } from '@/class/client.js'
import { NostrSocket } from '@/class/socket.js'

import { MockWebSocket } from '#/helpers/mock-socket.js'

export default function client_tests (t: Test) {
  t.test('NostrClient', st => {

    st.test('constructor - requires at least one relay', t => {
      t.throws(
        () => new NostrClient([]),
        /at least one relay is required/,
        'throws on empty array'
      )
      t.end()
    })

    st.test('constructor - accepts string URLs', t => {
      // Note: This will create real WebSocket connections that will fail
      // Just verify it doesn't throw
      t.doesNotThrow(
        () => {
          const client = new NostrClient([ 'ws://localhost:9999' ])
          client.close()
        },
        'accepts string URL array'
      )
      t.end()
    })

    st.test('constructor - accepts NostrSocket instances', t => {
      const mock1   = new MockWebSocket('wss://relay1.test')
      const mock2   = new MockWebSocket('wss://relay2.test')
      const socket1 = new NostrSocket(mock1 as unknown as WebSocket)
      const socket2 = new NostrSocket(mock2 as unknown as WebSocket)

      const client = new NostrClient([ socket1, socket2 ])

      t.equal(client.sockets.length, 2, 'client has 2 sockets')
      t.ok(client.sockets.includes(socket1), 'includes socket1')
      t.ok(client.sockets.includes(socket2), 'includes socket2')

      client.close()
      t.end()
    })

    st.test('constructor - accepts mixed string and NostrSocket', t => {
      const mock    = new MockWebSocket('wss://relay1.test')
      const socket  = new NostrSocket(mock as unknown as WebSocket)

      // Note: The string URL will create a real WebSocket that will fail
      const client = new NostrClient([ socket, 'ws://localhost:9999' ])

      t.equal(client.sockets.length, 2, 'client has 2 sockets')
      t.ok(client.sockets.includes(socket), 'includes injected socket')

      client.close()
      t.end()
    })

    st.test('ready state - true after any socket opens', t => {
      const mock1   = new MockWebSocket('wss://relay1.test')
      const mock2   = new MockWebSocket('wss://relay2.test')
      const socket1 = new NostrSocket(mock1 as unknown as WebSocket)
      const socket2 = new NostrSocket(mock2 as unknown as WebSocket)

      const client = new NostrClient([ socket1, socket2 ])

      t.notOk(client.is_ready, 'not ready initially')

      mock1.simulateOpen()
      t.ok(client.is_ready, 'ready after first socket opens')

      client.close()
      t.end()
    })

    st.test('sockets property - returns all sockets', t => {
      const mock1   = new MockWebSocket('wss://relay1.test')
      const mock2   = new MockWebSocket('wss://relay2.test')
      const socket1 = new NostrSocket(mock1 as unknown as WebSocket)
      const socket2 = new NostrSocket(mock2 as unknown as WebSocket)

      const client = new NostrClient([ socket1, socket2 ])

      const sockets = client.sockets
      t.ok(Array.isArray(sockets), 'sockets is an array')
      t.equal(sockets.length, 2, 'has 2 sockets')

      client.close()
      t.end()
    })

    st.test('close - closes all sockets', async t => {
      const mock1   = new MockWebSocket('wss://relay1.test')
      const mock2   = new MockWebSocket('wss://relay2.test')
      const socket1 = new NostrSocket(mock1 as unknown as WebSocket)
      const socket2 = new NostrSocket(mock2 as unknown as WebSocket)

      mock1.simulateOpen()
      mock2.simulateOpen()

      const client = new NostrClient([ socket1, socket2 ])
      client.close()

      // Wait for close timers
      await new Promise(r => setTimeout(r, 200))

      t.notOk(socket1.is_ready, 'socket1 closed')
      t.notOk(socket2.is_ready, 'socket2 closed')
      t.end()
    })

    st.test('subscribe - creates subscription on all sockets', t => {
      const mock1   = new MockWebSocket('wss://relay1.test')
      const mock2   = new MockWebSocket('wss://relay2.test')
      const socket1 = new NostrSocket(mock1 as unknown as WebSocket)
      const socket2 = new NostrSocket(mock2 as unknown as WebSocket)

      mock1.simulateOpen()
      mock2.simulateOpen()

      const client = new NostrClient([ socket1, socket2 ])
      const manager = client.subscribe({ kinds: [ 1 ] })

      t.ok(manager, 'returns subscription manager')
      t.equal(client.subs.size, 1, 'subscription tracked')

      client.close()
      t.end()
    })

    st.test('subscribe - rejects duplicate subscription ID', t => {
      const mock    = new MockWebSocket('wss://relay1.test')
      const socket  = new NostrSocket(mock as unknown as WebSocket)
      mock.simulateOpen()

      const client = new NostrClient([ socket ])
      client.subscribe({ kinds: [ 1 ] }, 'test-sub')

      t.throws(
        () => client.subscribe({ kinds: [ 1 ] }, 'test-sub'),
        /subscription already exists/,
        'throws on duplicate sub_id'
      )

      client.close()
      t.end()
    })

    st.end()
  })
}
