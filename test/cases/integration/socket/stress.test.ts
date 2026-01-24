/**
 * Socket Stress Tests
 *
 * Performance and load tests validating that NostrSocket handles
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

export default async function socket_stress_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.SOCKET.STRESS })
  const url = `ws://localhost:${TEST_PORTS.SOCKET.STRESS}`

  // ───────────────────────────────────────────────────────────────
  // Sequential Publish Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Sequential Publish', async st => {
    st.test('publishes many events sequentially', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count  = STRESS_CONFIG.EVENT_COUNT
      const events = create_event_stream(count)

      const { ms, result } = await measure_time(async () => {
        const receipts = []
        for (const event of events) {
          receipts.push(await socket.publish(event))
        }
        return receipts
      })

      const succeeded = result.filter(r => r.ok).length
      t.equal(succeeded, count, `${count} sequential publishes succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Concurrent Publish Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Concurrent Publish', async st => {
    st.test('publishes many events concurrently', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count  = STRESS_CONFIG.CONCURRENT_OPS
      const events = create_event_stream(count)

      const { ms, result } = await measure_time(async () => {
        return Promise.all(events.map(e => socket.publish(e)))
      })

      const succeeded = result.filter(r => r.ok).length
      t.equal(succeeded, count, `${count} concurrent publishes succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles burst traffic', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      // Multiple bursts of concurrent publishes
      const burstSize = 20
      const burstCount = 5

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < burstCount; i++) {
          const events = create_event_stream(burstSize)
          await Promise.all(events.map(e => socket.publish(e)))
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${burstCount} bursts completed in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Subscription Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Subscription Stress', async st => {
    st.test('handles many active subscriptions', async t => {
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

      // Cancel all
      for (const s of subs) s.cancel()

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('rapid subscribe/unsubscribe cycles', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const cycles = 20

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < cycles; i++) {
          const sub = socket.subscribe({ kinds: [i + 1] })
          await sub.activate()
          sub.cancel()
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${cycles} cycles in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('subscriptions receive high volume events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      // Listen and publish concurrently
      const listener = sub.listen({ mode: 'timeout', duration: 3000 })

      const events = create_event_stream(50, { pubkey, seckey })
      await Promise.all(events.map(e => socket.publish(e)))

      const received = await listener
      t.ok(received.length >= 10, `received ${received.length} events under load`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Queue Backpressure Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Queue Backpressure', async st => {
    st.test('handles queue overflow gracefully', async t => {
      // Configure with aggressive rate limiting
      const socket = new NostrSocket(url, {
        queue_ival  : 50,
        queue_limit : 5
      })
      await socket.connect()

      // Submit more events than queue can handle immediately
      const events = create_event_stream(100)

      const { ms, result } = await measure_time(async () => {
        return Promise.all(events.map(e => socket.publish(e)))
      })

      const succeeded = result.filter(r => r.ok).length
      t.ok(succeeded > 0, `${succeeded} events published under backpressure`)
      // With limit 5 and interval 50ms, 100 events should take ~1000ms
      t.ok(ms >= 500, `backpressure applied (${ms.toFixed(0)}ms)`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Query Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Socket Query Stress', async st => {
    st.test('handles many sequential queries', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const queryCount = 50
      const { pubkey } = create_keypair()

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < queryCount; i++) {
          await socket.query({ kinds: [1], authors: [pubkey] })
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${queryCount} queries in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles concurrent queries', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const queryCount = 20
      const { pubkey } = create_keypair()

      const { ms, result } = await measure_time(async () => {
        const queries = Array.from({ length: queryCount }, () =>
          socket.query({ kinds: [1], authors: [pubkey] })
        )
        return Promise.all(queries)
      })

      t.ok(result.every(r => Array.isArray(r)), 'all queries returned arrays')
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${queryCount} concurrent queries in ${ms.toFixed(0)}ms`)

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
