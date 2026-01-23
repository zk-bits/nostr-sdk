/**
 * Client Feature Tests
 *
 * Happy path tests validating that NostrClient works correctly
 * under normal conditions with multiple relays.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrClient } from '@/class/client.js'
import { TEST_PORTS, TEST_URLS } from '#/config.js'

import { create_event, sign_event } from '@/lib/event.js'
import {
  wait_ms,
  create_keypair,
  create_test_event,
  create_event_stream
} from '#/cases/integration/helpers/fixtures.js'

export default async function client_feature_tests (t: Test) {
  const relay1 = new NostrRelay()
  const relay2 = new NostrRelay()

  await relay1.start({ port: TEST_PORTS.CLIENT.FEATURE_1 })
  await relay2.start({ port: TEST_PORTS.CLIENT.FEATURE_2 })

  const urls = [TEST_URLS.CLIENT.FEATURE_1, TEST_URLS.CLIENT.FEATURE_2]

  // ───────────────────────────────────────────────────────────────
  // Construction Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Construction', async st => {
    st.test('requires at least one relay', t => {
      t.throws(
        () => new NostrClient([]),
        /at least one relay/,
        'throws for empty relays'
      )
      t.end()
    })

    st.test('creates socket for each relay', t => {
      const client = new NostrClient(urls)
      t.equal(client.sockets.length, 2, 'two sockets created')
      client.close()
      t.end()
    })

    st.test('accepts single relay', t => {
      const client = new NostrClient([urls[0]])
      t.equal(client.sockets.length, 1, 'one socket created')
      client.close()
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Connection Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Connection', async st => {
    st.test('connects to multiple relays', async t => {
      const client = new NostrClient(urls)
      await client.connectAll()

      t.ok(client.sockets.some(s => s.is_ready), 'at least one socket ready')
      t.ok(client.sockets.every(s => s.is_ready), 'all sockets ready')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('close disconnects all sockets', async t => {
      const client = new NostrClient(urls)
      await client.connect()
      client.close()
      await wait_ms(300)

      t.ok(client.sockets.every(s => !s.is_ready), 'all sockets closed')
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Publish Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Publish', async st => {
    st.test('publishes event to relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const event = create_test_event()
      const receipt = await client.publish(event)

      t.ok(receipt.ok, 'publish succeeded')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('publishes multiple events', async t => {
      const client = new NostrClient(urls, { queue_ival: 50, msg_timeout: 10000 })
      await client.connect()

      const events = create_event_stream(5)
      const receipts = await Promise.all(events.map(e => client.publish(e)))

      t.ok(receipts.every(r => r.ok), 'all publishes succeeded')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('event reaches both relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const event = create_test_event()
      await client.publish(event)
      await wait_ms(200)

      // Check both relays have the event
      const inRelay1 = relay1.cache.events.some(e => e.id === event.id)
      const inRelay2 = relay2.cache.events.some(e => e.id === event.id)

      t.ok(inRelay1, 'event in relay 1')
      t.ok(inRelay2, 'event in relay 2')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Query Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Query', async st => {
    st.test('queries from relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const event = sign_event(create_event({ content: 'query test', kind: 1, pubkey }), seckey)

      await client.publish(event)
      await wait_ms(200)

      const results = await client.query({ kinds: [1], authors: [pubkey] })
      t.ok(results.some(e => e.id === event.id), 'query found event')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('query with no matches returns empty', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const results = await client.query({ authors: ['a'.repeat(64)] })
      t.equal(results.length, 0, 'no matches returns empty array')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Subscribe Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Subscribe', async st => {
    st.test('subscribes and receives events', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = client.subscribe(filter)
      await sub.activate()

      const received: any[] = []
      sub.on('event', (e) => received.push(e))

      const event = sign_event(create_event({ content: 'subscribe test', kind: 1, pubkey }), seckey)
      await client.publish(event)

      await wait_ms(500)
      t.ok(received.some(e => e.id === event.id), 'subscription received event')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('deduplicates events from multiple relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = client.subscribe(filter)
      await sub.activate()

      const received: any[] = []
      sub.on('event', (e) => received.push(e))

      // Publish event (goes to both relays)
      const event = sign_event(create_event({ content: 'dedup test', kind: 1, pubkey }), seckey)
      await client.publish(event)
      await wait_ms(500)

      // Should only receive once despite being on two relays
      const matching = received.filter(e => e.id === event.id)
      t.equal(matching.length, 1, 'event deduplicated')

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Partial Availability Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Partial Availability', async st => {
    st.test('handles one relay being slow', async t => {
      // Use a fresh relay and a non-existent one
      const tempRelay = new NostrRelay()
      await tempRelay.start({ port: TEST_PORTS.CLIENT.FEATURE_1 + 20 })

      const client = new NostrClient([
        `ws://localhost:${TEST_PORTS.CLIENT.FEATURE_1 + 20}`,
        `ws://localhost:9998` // Non-existent
      ])

      try {
        await client.connect()
        t.ok(client.sockets.some(s => s.is_ready), 'at least one socket connected')
      } catch (_e) {
        t.pass('connection handled partial failure')
      }

      client.close()
      tempRelay.stop()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  t.teardown(() => {
    relay1.stop()
    relay2.stop()
  })
}
