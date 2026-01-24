/**
 * Socket Feature Tests
 *
 * Happy path tests validating that NostrSocket works correctly
 * under normal conditions.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { TEST_PORTS, TEST_URLS } from '#/config.js'

import { create_event, sign_event } from '@/lib/event.js'
import {
  wait_ms,
  create_keypair,
  create_test_event,
  create_event_stream
} from '#/cases/integration/helpers/fixtures.js'

export default async function socket_feature_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.SOCKET.FEATURE })
  const url = TEST_URLS.SOCKET.FEATURE

  // ───────────────────────────────────────────────────────────────
  // Connection Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Connection', async st => {
    st.test('connects to relay', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      t.ok(socket.is_ready, 'socket is ready after connect')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('emits ready event on connect', async t => {
      const socket = new NostrSocket(url)
      let emitted = false

      socket.on('ready', () => { emitted = true })
      await socket.connect()

      t.ok(emitted, 'ready event emitted')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('close disconnects properly', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()
      t.ok(socket.is_ready, 'connected')

      socket.close()
      await wait_ms(200)

      t.notOk(socket.is_ready, 'socket closed')
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Publish Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Publish', async st => {
    st.test('publishes events with receipt', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const event   = create_test_event()
      const receipt = await socket.publish(event)

      t.ok(receipt.ok, 'publish receipt is ok')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('publishes multiple events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const events = create_event_stream(5)
      const receipts = await Promise.all(events.map(e => socket.publish(e)))

      t.ok(receipts.every(r => r.ok), 'all publishes succeeded')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Query Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Query', async st => {
    st.test('queries with filters', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const event = sign_event(create_event({ content: 'query test', kind: 1, pubkey }), seckey)

      await socket.publish(event)
      const results = await socket.query({ kinds: [1], authors: [pubkey] })

      t.ok(results.some(e => e.id === event.id), 'query found published event')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('queries with complex filters', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()

      // Publish events with different kinds
      for (let kind = 1; kind <= 3; kind++) {
        const event = sign_event(create_event({ content: `kind ${kind}`, kind, pubkey }), seckey)
        await socket.publish(event)
      }

      // Query for multiple kinds
      const results = await socket.query({ kinds: [1, 2], authors: [pubkey] })
      t.ok(results.every(e => [1, 2].includes(e.kind)), 'multi-kind filter works')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('query returns empty for no matches', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const results = await socket.query({ authors: ['a'.repeat(64)] })
      t.equal(results.length, 0, 'no matches returns empty array')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Subscribe Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Subscribe', async st => {
    st.test('subscribes and receives events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      const listener = sub.listen({ mode: 'timeout', duration: 2000 })

      const event = sign_event(create_event({ content: 'subscribe test', kind: 1, pubkey }), seckey)
      await socket.publish(event)

      const events = await listener
      t.ok(events.some(e => e.id === event.id), 'subscriber received event')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles multiple subscriptions', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub1 = socket.subscribe({ kinds: [1] })
      const sub2 = socket.subscribe({ kinds: [2] })
      const sub3 = socket.subscribe({ kinds: [3] })

      await Promise.all([sub1.activate(), sub2.activate(), sub3.activate()])

      t.ok(sub1.is_active, 'sub1 active')
      t.ok(sub2.is_active, 'sub2 active')
      t.ok(sub3.is_active, 'sub3 active')

      sub1.cancel()
      sub2.cancel()
      sub3.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('subscription state tracks count', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      t.equal(sub.state.count, 0, 'initial count is 0')

      const event = sign_event(create_event({ content: 'count test', kind: 1, pubkey }), seckey)
      await socket.publish(event)
      await wait_ms(200)

      t.ok(sub.state.count >= 1, 'count incremented')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Rate Limiting Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Rate Limiting', async st => {
    st.test('respects queue config', async t => {
      const socket = new NostrSocket(url, {
        queue_ival  : 100,
        queue_limit : 2
      })
      await socket.connect()

      const events = create_event_stream(10)

      // All publishes should succeed even with rate limiting
      const start = Date.now()
      const receipts = await Promise.all(events.map(e => socket.publish(e)))
      const elapsed = Date.now() - start

      t.ok(receipts.every(r => r.ok), 'all events published')
      // With limit 2 and interval 100ms, 10 events should take at least 400ms
      t.ok(elapsed >= 300, `rate limiting applied (${elapsed}ms)`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  t.teardown(() => {
    relay.stop()
  })
}
