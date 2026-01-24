/**
 * Client Stress Tests
 *
 * Performance and load tests validating that NostrClient handles
 * high volume operations across multiple relays.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrClient } from '@/class/client.js'
import { TEST_PORTS, STRESS_CONFIG } from '#/config.js'

import {
  wait_ms,
  create_keypair,
  create_event_stream,
  measure_time
} from '#/cases/integration/helpers/fixtures.js'

export default async function client_stress_tests (t: Test) {
  const relay1 = new NostrRelay()
  const relay2 = new NostrRelay()
  const relay3 = new NostrRelay()

  await relay1.start({ port: TEST_PORTS.CLIENT.STRESS_1 })
  await relay2.start({ port: TEST_PORTS.CLIENT.STRESS_2 })
  await relay3.start({ port: TEST_PORTS.CLIENT.STRESS_3 })

  const urls = [
    `ws://localhost:${TEST_PORTS.CLIENT.STRESS_1}`,
    `ws://localhost:${TEST_PORTS.CLIENT.STRESS_2}`,
    `ws://localhost:${TEST_PORTS.CLIENT.STRESS_3}`
  ]

  // ───────────────────────────────────────────────────────────────
  // Multi-Relay Publish Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Multi-Relay Publish', async st => {
    st.test('publishes many events across multiple relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const count = STRESS_CONFIG.EVENT_COUNT
      const events = create_event_stream(count)

      const { ms, result } = await measure_time(async () => {
        const receipts = []
        for (const event of events) {
          receipts.push(await client.publish(event))
        }
        return receipts
      })

      const succeeded = result.filter(r => r.ok).length
      t.equal(succeeded, count, `${count} publishes succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('concurrent publishes across relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const count = STRESS_CONFIG.CONCURRENT_OPS
      const events = create_event_stream(count)

      const { ms, result } = await measure_time(async () => {
        return Promise.all(events.map(e => client.publish(e)))
      })

      const succeeded = result.filter(r => r.ok).length
      t.equal(succeeded, count, `${count} concurrent publishes succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Deduplication Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Deduplication Under Load', async st => {
    st.test('deduplicates high volume events from multiple relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = client.subscribe(filter)
      await sub.activate()

      const received: any[] = []
      const seen = new Set<string>()
      let duplicates = 0

      sub.on('event', (e) => {
        if (seen.has(e.id)) {
          duplicates++
        } else {
          seen.add(e.id)
        }
        received.push(e)
      })

      // Publish many events
      const eventCount = 50
      const events = create_event_stream(eventCount, { pubkey, seckey })
      for (const event of events) {
        await client.publish(event)
      }

      await wait_ms(2000)

      t.ok(received.length >= eventCount, `received ${received.length} events`)
      t.equal(duplicates, 0, `no duplicates (dedup working)`)

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Query Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Query Under Load', async st => {
    st.test('handles many queries across relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      // Seed some events
      const { seckey, pubkey } = create_keypair()
      const events = create_event_stream(20, { pubkey, seckey })
      for (const event of events) {
        await client.publish(event)
      }
      await wait_ms(200)

      // Run many queries
      const queryCount = 30
      const { ms, result } = await measure_time(async () => {
        const queries = Array.from({ length: queryCount }, () =>
          client.query({ kinds: [1], authors: [pubkey] })
        )
        return Promise.all(queries)
      })

      t.ok(result.every(r => Array.isArray(r)), 'all queries returned arrays')
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${queryCount} queries in ${ms.toFixed(0)}ms`)

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Subscription Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Subscription Under Load', async st => {
    st.test('handles multiple subscriptions across relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const count = 10
      const subs = Array.from({ length: count }, (_, i) =>
        client.subscribe({ kinds: [i + 1] })
      )

      const { ms } = await measure_time(async () => {
        await Promise.all(subs.map(s => s.activate()))
      })

      const active = subs.filter(s => s.is_active).length
      t.equal(active, count, `${count} subscriptions active`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `activated in ${ms.toFixed(0)}ms`)

      for (const s of subs) s.cancel()
      client.close()
      await wait_ms(200)
      t.end()
    })

    st.test('subscription handles high volume from multiple relays', async t => {
      const client = new NostrClient(urls)
      await client.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = client.subscribe(filter)
      await sub.activate()

      const received: any[] = []
      sub.on('event', (e) => { received.push(e) })

      // Publish many events
      const eventCount = 100
      const events = create_event_stream(eventCount, { pubkey, seckey })

      const { ms } = await measure_time(async () => {
        for (const event of events) {
          await client.publish(event)
        }
      })

      await wait_ms(2000)
      t.ok(received.length >= eventCount * 0.5, `received ${received.length}/${eventCount} events`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `published in ${ms.toFixed(0)}ms`)

      client.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Connection Churn Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Client Connection Churn', async st => {
    st.test('handles rapid connect/disconnect cycles', async t => {
      const cycles = 10

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < cycles; i++) {
          const client = new NostrClient(urls)
          await client.connect()
          client.close()
          await wait_ms(50)
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${cycles} cycles in ${ms.toFixed(0)}ms`)
      t.end()
    })

    st.end()
  })

  t.teardown(() => {
    relay1.stop()
    relay2.stop()
    relay3.stop()
  })
}
