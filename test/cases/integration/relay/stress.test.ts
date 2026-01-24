/**
 * Relay Stress Tests
 *
 * Performance and load tests validating that NostrRelay handles
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

export default async function relay_stress_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.RELAY.STRESS })
  const url = `ws://localhost:${TEST_PORTS.RELAY.STRESS}`

  // ───────────────────────────────────────────────────────────────
  // Sequential Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Sequential Load', async st => {
    st.test('handles many events sequentially', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count  = STRESS_CONFIG.EVENT_COUNT
      const events = create_event_stream(count)

      const { ms } = await measure_time(async () => {
        for (const event of events) {
          await socket.publish(event)
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${count} events in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles many queries sequentially', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { pubkey } = create_keypair()
      const queryCount = 50

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

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Concurrent Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Concurrent Load', async st => {
    st.test('handles concurrent publish operations', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count  = STRESS_CONFIG.CONCURRENT_OPS
      const events = create_event_stream(count)

      const { ms, result } = await measure_time(async () => {
        return Promise.all(events.map(e => socket.publish(e)))
      })

      const succeeded = result.filter(r => r.ok).length
      t.ok(succeeded === count, `${succeeded}/${count} concurrent publishes succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles concurrent subscriptions', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const count = STRESS_CONFIG.SUBSCRIPTION_COUNT
      const subs  = Array.from({ length: count }, (_, i) =>
        socket.subscribe({ kinds: [i + 1] })
      )

      const { ms } = await measure_time(async () => {
        await Promise.all(subs.map(s => s.activate()))
      })

      const active = subs.filter(s => s.is_active).length
      t.equal(active, count, `${active}/${count} subscriptions active`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `activated in ${ms.toFixed(0)}ms`)

      // Cleanup
      for (const s of subs) s.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('handles concurrent clients', async t => {
      const clientCount = 10
      const sockets: NostrSocket[] = []

      const { ms: connectMs } = await measure_time(async () => {
        const connects = Array.from({ length: clientCount }, () => {
          const s = new NostrSocket(url)
          sockets.push(s)
          return s.connect()
        })
        await Promise.all(connects)
      })

      t.equal(relay.sessions.size, clientCount, `${clientCount} clients connected`)
      t.ok(connectMs < 5000, `connected in ${connectMs.toFixed(0)}ms`)

      // Each client publishes an event
      const events = create_event_stream(clientCount)
      const { ms: publishMs } = await measure_time(async () => {
        await Promise.all(sockets.map((s, i) => s.publish(events[i])))
      })

      t.ok(publishMs < STRESS_CONFIG.THROUGHPUT_LIMIT, `all published in ${publishMs.toFixed(0)}ms`)

      for (const s of sockets) s.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Cache Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Cache Under Load', async st => {
    st.test('cache handles high volume', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const initialSize = relay.cache.events.length
      const events = create_event_stream(100)

      for (const event of events) {
        await socket.publish(event)
      }

      const growth = relay.cache.events.length - initialSize
      t.ok(growth > 0, `cache grew by ${growth} events`)

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('querying under load', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      // Publish events while querying
      const { seckey, pubkey } = create_keypair()
      const events = create_event_stream(20, { pubkey, seckey })

      const publishPromise = (async () => {
        for (const event of events) {
          await socket.publish(event)
          await wait_ms(10)
        }
      })()

      const queryPromise = (async () => {
        const results: number[] = []
        for (let i = 0; i < 10; i++) {
          const r = await socket.query({ kinds: [1], authors: [pubkey] })
          results.push(r.length)
          await wait_ms(20)
        }
        return results
      })()

      const [, queryResults] = await Promise.all([publishPromise, queryPromise])
      t.ok(queryResults.some(r => r > 0), 'queries returned events during publish load')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Broadcast Stress Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Relay Broadcast Under Load', async st => {
    st.test('broadcasts to many subscribers', async t => {
      // Create multiple subscriber sockets
      const subscriberCount = 10
      const publisher = new NostrSocket(url)
      const subscribers: NostrSocket[] = []

      await publisher.connect()

      for (let i = 0; i < subscriberCount; i++) {
        const s = new NostrSocket(url)
        await s.connect()
        subscribers.push(s)
      }

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      // All subscribers subscribe to same filter
      const subs = subscribers.map(s => s.subscribe(filter))
      await Promise.all(subs.map(s => s.activate()))

      // Collect events from each subscriber
      const listeners = subs.map(s => s.listen({ mode: 'timeout', duration: 2000 }))

      // Publish multiple events
      const events = create_event_stream(5, { pubkey, seckey })
      for (const event of events) {
        await publisher.publish(event)
      }

      const allReceived = await Promise.all(listeners)
      const receivedCounts = allReceived.map(r => r.length)

      t.ok(receivedCounts.every(c => c >= 1), 'all subscribers received events')

      publisher.close()
      for (const s of subscribers) s.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  t.teardown(() => {
    relay.stop()
  })
}
