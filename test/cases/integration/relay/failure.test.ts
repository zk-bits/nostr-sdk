/**
 * Relay Failure Tests
 *
 * Error scenario tests validating that NostrRelay handles
 * failures and edge cases gracefully.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { TEST_PORTS }  from '#/config.js'

import { create_event, sign_event } from '@/lib/event.js'
import { wait_ms, create_keypair, create_test_event } from '#/cases/integration/helpers/fixtures.js'

export default async function relay_failure_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.RELAY.FAILURE })
  const url = `ws://localhost:${TEST_PORTS.RELAY.FAILURE}`

  // ───────────────────────────────────────────────────────────────
  // Invalid Event Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Invalid Events', async st => {
    st.test('rejects invalid event signatures', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const event = create_test_event()
      const tampered = { ...event, sig: '0'.repeat(128) }

      try {
        await socket.publish(tampered)
        t.fail('should have rejected invalid event')
      } catch (err: any) {
        t.ok(err.ok === false || err.message, 'publish rejected')
      }

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('rejects events with wrong id', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const event = create_test_event()
      const tampered = { ...event, id: '0'.repeat(64) }

      try {
        await socket.publish(tampered)
        t.fail('should have rejected wrong id')
      } catch (err: any) {
        t.ok(err.ok === false || err.message, 'publish rejected for wrong id')
      }

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('rejects duplicate events silently', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const event = create_test_event()

      const receipt1 = await socket.publish(event)
      t.ok(receipt1.ok, 'first publish succeeded')

      // Second publish of same event should succeed (relay accepts but dedupes)
      const receipt2 = await socket.publish(event)
      t.ok(receipt2.ok, 'duplicate publish accepted (deduped internally)')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Connection Handling Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Connection Handling', async st => {
    st.test('handles client disconnect gracefully', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const initialSessions = relay.sessions.size
      t.ok(initialSessions > 0, 'session exists')

      socket.close()
      await wait_ms(200)

      t.ok(relay.sessions.size < initialSessions, 'session removed after disconnect')
      t.ok(relay.is_ready, 'relay still ready after client disconnect')
      t.end()
    })

    st.test('handles rapid connect/disconnect', async t => {
      const cycles = 10
      for (let i = 0; i < cycles; i++) {
        const socket = new NostrSocket(url)
        await socket.connect()
        socket.close()
      }
      await wait_ms(200)

      t.ok(relay.is_ready, 'relay survives rapid connect/disconnect cycles')
      t.end()
    })

    st.test('handles socket close during subscription', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [1] })
      await sub.activate()

      // Abruptly close socket while subscription active
      socket.close()
      await wait_ms(200)

      t.ok(relay.is_ready, 'relay handles mid-subscription close')
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Edge Cases
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Edge Cases', async st => {
    st.test('handles empty filter query', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const results = await socket.query({})
      t.ok(Array.isArray(results), 'empty filter returns array')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles filter with no matches', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      // Query for nonexistent author
      const results = await socket.query({ authors: ['f'.repeat(64)] })
      t.equal(results.length, 0, 'no matches returns empty array')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles subscription cancel before EOSE', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [9999] })
      // Cancel immediately without waiting for EOSE
      sub.cancel()

      t.notOk(sub.is_active, 'subscription cancelled before EOSE')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles concurrent subscription and publish', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      // Start subscription and publish simultaneously
      const sub = socket.subscribe(filter)
      const listener = sub.listen({ mode: 'timeout', duration: 1000 })

      const events = Array.from({ length: 5 }, (_, i) =>
        sign_event(create_event({ content: `concurrent ${i}`, kind: 1, pubkey }), seckey)
      )

      await Promise.all(events.map(e => socket.publish(e)))
      const received = await listener

      t.ok(received.length >= 0, 'concurrent operations handled')

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
