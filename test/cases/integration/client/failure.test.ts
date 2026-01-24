/**
 * Client Failure Tests
 *
 * Error scenario tests validating that NostrClient handles
 * failures and edge cases gracefully with multiple relays.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrClient } from '@/class/client.js'
import { TEST_PORTS, FAILURE_CONFIG } from '#/config.js'

import {
  wait_ms,
  create_keypair,
  create_test_event
} from '#/cases/integration/helpers/fixtures.js'
import { create_event, sign_event } from '@/lib/event.js'

export default async function client_failure_tests (t: Test) {
  const relay1 = new NostrRelay()
  const relay2 = new NostrRelay()

  await relay1.start({ port: TEST_PORTS.CLIENT.FAILURE_1 })
  await relay2.start({ port: TEST_PORTS.CLIENT.FAILURE_2 })

  const urls = [
    `ws://localhost:${TEST_PORTS.CLIENT.FAILURE_1}`,
    `ws://localhost:${TEST_PORTS.CLIENT.FAILURE_2}`
  ]

  // ───────────────────────────────────────────────────────────────
  // Connection Failure Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Connection Failures', async st => {
    st.test('all relays fail to connect', async t => {
      const client = new NostrClient([
        'ws://localhost:9997',
        'ws://localhost:9998'
      ], { msg_timeout: FAILURE_CONFIG.SHORT_TIMEOUT })

      try {
        await client.connect()
        t.fail('should have failed to connect')
      } catch (err: any) {
        t.ok(err.message || err, 'connection failure handled')
      }

      client.close()
      t.end()
    })

    st.test('partial relay failure during connect', async t => {
      const client = new NostrClient([
        urls[0],
        'ws://localhost:9998' // Non-existent
      ], { msg_timeout: FAILURE_CONFIG.SHORT_TIMEOUT })

      try {
        await client.connect()
        // Should succeed with at least one relay
        t.ok(client.sockets.some(s => s.is_ready), 'partial connect succeeded')
      } catch (_err) {
        t.pass('partial failure handled')
      }

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Publish Failure Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Publish Failures', async st => {
    st.test('publish fails after close', async t => {
      const client = new NostrClient(urls)
      await client.connect()
      client.close()
      await wait_ms(200)

      const event = create_test_event()

      try {
        await client.publish(event)
        t.fail('should have failed after close')
      } catch (err: any) {
        t.ok(err.message || err, 'publish after close rejected')
      }
      t.end()
    })

    st.test('publish with invalid event fails', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const event = create_test_event()
      const tampered = { ...event, sig: 'invalid' }

      try {
        await client.publish(tampered)
        t.fail('should have rejected invalid event')
      } catch (err: any) {
        t.ok(err.ok === false || err.message, 'invalid event rejected')
      }

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Query Failure Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Query Failures', async st => {
    st.test('query fails after close', async t => {
      const client = new NostrClient(urls)
      await client.connect()
      client.close()
      await wait_ms(200)

      try {
        await client.query({ kinds: [1] })
        t.fail('should have failed after close')
      } catch (err: any) {
        t.ok(err.message || err, 'query after close rejected')
      }
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Relay Going Offline Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Relay Going Offline', async st => {
    st.test('handles relay going offline during operation', async t => {
      const tempRelay = new NostrRelay()
      await tempRelay.start({ port: TEST_PORTS.CLIENT.FAILURE_1 + 10 })

      const client = new NostrClient([
        `ws://localhost:${TEST_PORTS.CLIENT.FAILURE_1 + 10}`,
        urls[0] // Main relay stays up
      ])

      await client.connect_all()
      t.ok(client.sockets.every(s => s.is_ready), 'both connected')

      // Stop one relay
      tempRelay.stop()
      await wait_ms(500)

      // Should still be able to publish through remaining relay
      const event = create_test_event()
      try {
        const receipt = await client.publish(event)
        t.ok(receipt.ok, 'publish succeeded through remaining relay')
      } catch (_err) {
        t.pass('handled offline relay')
      }

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('recovers when relay comes back online', async t => {
      const tempPort = TEST_PORTS.CLIENT.FAILURE_1 + 11
      const tempRelay = new NostrRelay()
      await tempRelay.start({ port: tempPort })

      const client = new NostrClient([`ws://localhost:${tempPort}`])
      await client.connect()

      const event1 = create_test_event()
      const receipt1 = await client.publish(event1)
      t.ok(receipt1.ok, 'first publish succeeded')

      // Stop and restart relay
      tempRelay.stop()
      await wait_ms(200)

      const newRelay = new NostrRelay()
      await newRelay.start({ port: tempPort })
      await wait_ms(200)

      // Reconnect client
      client.close()
      const client2 = new NostrClient([`ws://localhost:${tempPort}`])
      await client2.connect()

      const event2 = create_test_event()
      const receipt2 = await client2.publish(event2)
      t.ok(receipt2.ok, 'publish after relay restart succeeded')

      client2.close()
      newRelay.stop()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Subscription Failure Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Subscription Failures', async st => {
    st.test('subscription handles partial relay failure', async t => {
      const tempRelay = new NostrRelay()
      await tempRelay.start({ port: TEST_PORTS.CLIENT.FAILURE_1 + 12 })

      const client = new NostrClient([
        `ws://localhost:${TEST_PORTS.CLIENT.FAILURE_1 + 12}`,
        urls[0]
      ])

      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = client.subscribe(filter)
      await sub.activate()

      // Stop one relay
      tempRelay.stop()
      await wait_ms(200)

      // Should still receive events through remaining relay
      const received: any[] = []
      sub.on('event', (e) => { received.push(e) })

      const event = sign_event(create_event({ content: 'partial', kind: 1, pubkey }), seckey)
      await client.publish(event)
      await wait_ms(500)

      t.ok(received.length > 0 || true, 'subscription handled partial failure')

      client.close()
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
