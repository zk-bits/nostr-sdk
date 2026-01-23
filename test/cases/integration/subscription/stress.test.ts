/**
 * Subscription Stress Tests
 *
 * Performance and load tests validating that NostrSubscription handles
 * high volume and concurrent operations.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { TEST_PORTS, STRESS_CONFIG } from '#/config.js'

import {
  wait_ms,
  create_keypair,
  create_event_stream,
  measure_time
} from '#/cases/integration/helpers/fixtures.js'

export default async function subscription_stress_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.SUB.STRESS })
  const url = `ws://localhost:${TEST_PORTS.SUB.STRESS}`

  // ───────────────────────────────────────────────────────────────
  // High Volume Event Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription High Volume', async st => {
    st.test('receives many events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      const listener = sub.listen(5000)

      // Publish many events
      const count = 100
      const events = create_event_stream(count, { pubkey, seckey })

      const { ms } = await measure_time(async () => {
        for (const event of events) {
          await socket.publish(event)
        }
      })

      const received = await listener
      t.ok(received.length >= count * 0.5, `received ${received.length}/${count} events`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `published in ${ms.toFixed(0)}ms`)

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles high event rate', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      // Start listener
      const listener = sub.listen(3000)

      // Rapid-fire publish
      const events = create_event_stream(50, { pubkey, seckey })
      await Promise.all(events.map(e => socket.publish(e)))

      const received = await listener
      t.ok(received.length > 0, `received ${received.length} events at high rate`)

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Multiple Subscription Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Concurrent', async st => {
    st.test('multiple subscriptions receiving same events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      // Create multiple subscriptions to same filter
      const subCount = 5
      const subs = Array.from({ length: subCount }, () => socket.subscribe(filter))

      await Promise.all(subs.map(s => s.activate()))

      // All listen concurrently
      const listeners = subs.map(s => s.listen(2000))

      // Publish events
      const events = create_event_stream(10, { pubkey, seckey })
      for (const event of events) {
        await socket.publish(event)
      }

      const allReceived = await Promise.all(listeners)

      // Each subscription should receive events
      allReceived.forEach((received, i) => {
        t.ok(received.length > 0, `sub ${i} received ${received.length} events`)
      })

      for (const s of subs) s.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('many subscriptions with different filters', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count = STRESS_CONFIG.SUBSCRIPTION_COUNT
      const subs = Array.from({ length: count }, (_, i) =>
        socket.subscribe({ kinds: [i + 1] })
      )

      const { ms } = await measure_time(async () => {
        await Promise.all(subs.map(s => s.activate()))
      })

      const active = subs.filter(s => s.is_active).length
      t.equal(active, count, `${count} subscriptions active`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `activated in ${ms.toFixed(0)}ms`)

      for (const s of subs) s.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Event Listener Memory Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Memory', async st => {
    st.test('handles many sequential listeners', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      // Create many sequential listeners
      const listenerCount = 20
      for (let i = 0; i < listenerCount; i++) {
        const listener = sub.listen(50)
        await listener
      }

      t.pass(`${listenerCount} sequential listeners completed`)

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('cleanup after cancel', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      // Create and cancel many subscriptions
      const cycles = 20
      for (let i = 0; i < cycles; i++) {
        const sub = socket.subscribe({ kinds: [i + 1] })
        await sub.activate()
        sub.cancel()
      }

      // Socket should still be functional
      const finalSub = socket.subscribe({ kinds: [1] })
      await finalSub.activate()
      t.ok(finalSub.is_active, 'socket functional after many cancels')

      finalSub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Throughput Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Throughput', async st => {
    st.test('measures event throughput', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      const eventCount = 50
      const events = create_event_stream(eventCount, { pubkey, seckey })

      const startCount = sub.state.count
      const listener = sub.listen(3000)

      // Publish events
      for (const event of events) {
        await socket.publish(event)
      }

      const received = await listener
      const throughput = received.length
      const growth = sub.state.count - startCount

      t.ok(throughput > 0, `throughput: ${throughput} events received`)
      t.ok(growth >= throughput, `state count grew by ${growth}`)

      sub.cancel()
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
