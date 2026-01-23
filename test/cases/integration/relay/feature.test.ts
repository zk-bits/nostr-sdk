/**
 * Relay Feature Tests
 *
 * Happy path tests validating that NostrRelay works correctly
 * under normal conditions.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { TEST_PORTS, } from '#/config.js'

import { create_event, sign_event }            from '@/lib/event.js'
import { wait_ms, create_keypair } from '#/cases/integration/helpers/fixtures.js'

export default async function relay_feature_tests (t: Test) {
  // ───────────────────────────────────────────────────────────────
  // Lifecycle Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Lifecycle', async st => {
    st.test('starts and stops cleanly', async t => {
      const relay = new NostrRelay()

      await relay.start({ port: TEST_PORTS.RELAY.FEATURE })
      t.ok(relay.ready, 'relay is ready after start')

      relay.stop()
      await wait_ms(100)
      t.notOk(relay.ready, 'relay not ready after stop')
      t.end()
    })

    st.test('emits ready event', async t => {
      const relay   = new NostrRelay()
      let emitted = false

      relay.on('ready', () => { emitted = true })
      await relay.start({ port: TEST_PORTS.RELAY.FEATURE + 1 })

      t.ok(emitted, 'ready event emitted')
      relay.stop()
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Client Handling Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Client Handling', async st => {
    const relay = new NostrRelay()
    await relay.start({ port: TEST_PORTS.RELAY.FEATURE + 2 })
    const url = `ws://localhost:${TEST_PORTS.RELAY.FEATURE + 2}`

    st.test('accepts client connections', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      t.ok(socket.is_ready, 'socket connected to relay')
      t.ok(relay.sessions.size > 0, 'relay has active session')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles EVENT message', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const event = sign_event(create_event({ content: 'test', kind: 1, pubkey }), seckey)
      const receipt = await socket.publish(event)

      t.ok(receipt.ok, 'event accepted')
      t.ok(relay.cache.events.some(e => e.id === event.id), 'event cached')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles REQ message with filters', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const event1 = sign_event(create_event({ content: 'a', kind: 1, pubkey }), seckey)
      const event2 = sign_event(create_event({ content: 'b', kind: 2, pubkey }), seckey)

      await socket.publish(event1)
      await socket.publish(event2)

      const kind1Events = await socket.query({ kinds: [1], authors: [pubkey] })
      t.ok(kind1Events.some(e => e.kind === 1), 'filter by kind works')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles CLOSE message', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [1] })
      await sub.activate()
      t.ok(sub.is_active, 'subscription active')

      sub.cancel()
      await wait_ms(100)
      t.notOk(sub.is_active, 'subscription closed')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('broadcasts events to subscribers', async t => {
      const socket1 = new NostrSocket(url)
      const socket2 = new NostrSocket(url)

      await socket1.connect()
      await socket2.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = await socket2.subscribe(filter)
      const listener = sub.listen(2000)

      const event = sign_event(create_event({ content: 'broadcast test', kind: 1, pubkey }), seckey)
      await socket1.publish(event)

      const received = await listener
      t.ok(received.some(e => e.id === event.id), 'subscriber received event')

      socket1.close()
      socket2.close()
      await wait_ms(100)
      t.end()
    })

    // ─────────────────────────────────────────────────────────────
    // New Feature Tests
    // ─────────────────────────────────────────────────────────────

    st.test('handles multiple concurrent clients', async t => {
      const sockets = await Promise.all(
        Array.from({ length: 5 }, () => {
          const s = new NostrSocket(url)
          return s.connect().then(() => s)
        })
      )

      t.equal(relay.sessions.size, sockets.length, 'all clients connected')

      // Publish from each client
      const { seckey, pubkey } = create_keypair()
      const publishes = sockets.map((socket, i) => {
        const event = sign_event(create_event({ content: `client ${i}`, kind: 1, pubkey }), seckey)
        return socket.publish(event)
      })

      const results = await Promise.all(publishes)
      t.ok(results.every(r => r.ok), 'all publishes succeeded')

      for (const s of sockets) s.close()
      await wait_ms(100)
      t.end()
    })

    st.test('caches events correctly', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const initialCount = relay.cache.events.length
      const { seckey, pubkey } = create_keypair()

      // Publish 10 events
      for (let i = 0; i < 10; i++) {
        const event = sign_event(create_event({ content: `cache test ${i}`, kind: 1, pubkey }), seckey)
        await socket.publish(event)
      }

      t.equal(relay.cache.events.length - initialCount, 10, '10 events added to cache')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('filters by multiple criteria', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey: seckey1, pubkey: pubkey1 } = create_keypair()
      const { seckey: seckey2, pubkey: pubkey2 } = create_keypair()

      // Publish from different authors with different kinds
      await socket.publish(sign_event(create_event({ content: 'a', kind: 1, pubkey: pubkey1 }), seckey1))
      await socket.publish(sign_event(create_event({ content: 'b', kind: 2, pubkey: pubkey1 }), seckey1))
      await socket.publish(sign_event(create_event({ content: 'c', kind: 1, pubkey: pubkey2 }), seckey2))
      await socket.publish(sign_event(create_event({ content: 'd', kind: 2, pubkey: pubkey2 }), seckey2))

      // Query with multiple authors
      const multiAuthor = await socket.query({ authors: [pubkey1, pubkey2] })
      t.ok(multiAuthor.length >= 4, 'multi-author filter works')

      // Query with specific author and kind
      const specific = await socket.query({ kinds: [1], authors: [pubkey1] })
      t.ok(specific.every(e => e.kind === 1 && e.pubkey === pubkey1), 'combined filter works')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.teardown(() => {
      relay.stop()
    })

    st.end()
  })
}
