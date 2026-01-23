/**
 * Node Stress Tests
 *
 * Performance and load tests validating that NostrNode handles
 * high volume P2P operations.
 */
import { Test }       from 'tape'
import { NostrRelay } from '@/class/relay.js'
import { NostrNode }  from '@/class/node.js'
import { TEST_PORTS, STRESS_CONFIG } from '#/config.js'

import { gen_seckey, get_pubkey } from '@/crypto/ecc.js'
import { wait_ms, measure_time } from '#/cases/integration/helpers/fixtures.js'

import type { RpcMessageData, RequestRpcMessage } from '@/types/index.js'

export default async function node_stress_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.NODE.STRESS })

  const urls = [`ws://localhost:${TEST_PORTS.NODE.STRESS}`]

  // ───────────────────────────────────────────────────────────────
  // Request/Response Throughput Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Node Request Throughput', async st => {
    st.test('rapid request/response cycles', async t => {
      const seckey1 = gen_seckey()
      const seckey2 = gen_seckey()
      const pubkey1 = get_pubkey(seckey1)
      const pubkey2 = get_pubkey(seckey2)

      const node1 = new NostrNode([pubkey2], urls, seckey1)
      const node2 = new NostrNode([pubkey1], urls, seckey2)

      await Promise.all([node1.connect(), node2.connect()])

      // Node2 auto-responds
      node2.on('message', (msg: RpcMessageData) => {
        if (msg.type === 'request') {
          const req = msg as RpcMessageData & RequestRpcMessage
          node2.respond(req).accept({ ack: true })
        }
      })

      const cycles = 20
      let succeeded = 0

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < cycles; i++) {
          try {
            const response = await node1.request(
              { method: 'ping', params: [] },
              pubkey2,
              { timeout: 5000 }
            )
            if (response.type === 'accept') succeeded++
          } catch (_err) {
            // Timeout or error
          }
        }
      })

      t.ok(succeeded >= cycles * 0.5, `${succeeded}/${cycles} requests succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      node1.close()
      node2.close()
      await wait_ms(200)
      t.end()
    })

    st.test('concurrent requests', async t => {
      const seckey1 = gen_seckey()
      const seckey2 = gen_seckey()
      const pubkey1 = get_pubkey(seckey1)
      const pubkey2 = get_pubkey(seckey2)

      const node1 = new NostrNode([pubkey2], urls, seckey1)
      const node2 = new NostrNode([pubkey1], urls, seckey2)

      await Promise.all([node1.connect(), node2.connect()])

      // Node2 auto-responds
      node2.on('message', (msg: RpcMessageData) => {
        if (msg.type === 'request') {
          const req = msg as RpcMessageData & RequestRpcMessage
          node2.respond(req).accept({ ack: true })
        }
      })

      const count = 10

      const { ms, result } = await measure_time(async () => {
        const requests = Array.from({ length: count }, () =>
          node1.request({ method: 'ping', params: [] }, pubkey2, { timeout: 5000 })
            .catch(() => null)
        )
        return Promise.all(requests)
      })

      const succeeded = result.filter(r => r?.type === 'accept').length
      t.ok(succeeded >= count * 0.5, `${succeeded}/${count} concurrent requests succeeded`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `completed in ${ms.toFixed(0)}ms`)

      node1.close()
      node2.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Multi-Peer Broadcast Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Node Broadcast Throughput', async st => {
    st.test('broadcasts to many peers', async t => {
      // Create multiple peer nodes
      const peerCount = 5
      const seckey1   = gen_seckey()
      const pubkey1   = get_pubkey(seckey1)

      const peerKeys = Array.from({ length: peerCount }, () => {
        const seckey = gen_seckey()
        return { seckey, pubkey: get_pubkey(seckey) }
      })

      const peerPubkeys = peerKeys.map(k => k.pubkey)

      // Main node knows all peers
      const node1 = new NostrNode(peerPubkeys, urls, seckey1)

      // Peer nodes know main node
      const peerNodes = peerKeys.map(k =>
        new NostrNode([pubkey1], urls, k.seckey)
      )

      await node1.connect()
      await Promise.all(peerNodes.map(n => n.connect()))

      // Track received messages
      const received = new Map<string, number>()
      for (const pk of peerPubkeys) received.set(pk, 0)

      peerNodes.forEach((node, i) => {
        node.on('message', () => {
          const pk = peerPubkeys[i]
          received.set(pk, (received.get(pk) || 0) + 1)
        })
      })

      // Broadcast announcements
      const broadcastCount = 10
      const { ms } = await measure_time(async () => {
        for (let i = 0; i < broadcastCount; i++) {
          const results = node1.announce(
            { topic: 'broadcast', data: { index: i } },
            peerPubkeys
          )
          await Promise.all(results)
        }
      })

      await wait_ms(1000)

      const totalReceived = Array.from(received.values()).reduce((a, b) => a + b, 0)
      const expectedTotal = peerCount * broadcastCount

      t.ok(totalReceived >= expectedTotal * 0.5, `${totalReceived}/${expectedTotal} messages received`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `broadcasts completed in ${ms.toFixed(0)}ms`)

      node1.close()
      for (const n of peerNodes) n.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Cast Throughput Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Node Cast Throughput', async st => {
    st.test('sequential casts to multiple peers', async t => {
      const seckey1 = gen_seckey()
      const seckey2 = gen_seckey()
      const seckey3 = gen_seckey()
      const pubkey1 = get_pubkey(seckey1)
      const pubkey2 = get_pubkey(seckey2)
      const pubkey3 = get_pubkey(seckey3)

      const node1 = new NostrNode([pubkey2, pubkey3], urls, seckey1)
      const node2 = new NostrNode([pubkey1], urls, seckey2)
      const node3 = new NostrNode([pubkey1], urls, seckey3)

      await Promise.all([node1.connect(), node2.connect(), node3.connect()])

      // Both peers respond
      node2.on('message', (msg: RpcMessageData) => {
        if (msg.type === 'request') {
          const req = msg as RpcMessageData & RequestRpcMessage
          node2.respond(req).accept({ from: 'node2' })
        }
      })

      node3.on('message', (msg: RpcMessageData) => {
        if (msg.type === 'request') {
          const req = msg as RpcMessageData & RequestRpcMessage
          node3.respond(req).accept({ from: 'node3' })
        }
      })

      const castCount = 5
      let totalResponses = 0

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < castCount; i++) {
          const responses = await node1.cast(
            { method: 'ping', params: [] },
            [pubkey2, pubkey3],
            { timeout: 3000 }
          )
          totalResponses += responses.length
        }
      })

      t.ok(totalResponses >= castCount, `received ${totalResponses} total responses`)
      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `casts completed in ${ms.toFixed(0)}ms`)

      node1.close()
      node2.close()
      node3.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Connection Churn Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Node Connection Churn', async st => {
    st.test('handles rapid connect/disconnect cycles', async t => {
      const cycles = 5
      const peer   = gen_seckey()
      const pubkey = get_pubkey(peer)

      const { ms } = await measure_time(async () => {
        for (let i = 0; i < cycles; i++) {
          const seckey = gen_seckey()
          const node = new NostrNode([pubkey], urls, seckey)
          await node.connect()
          node.close()
          await wait_ms(100)
        }
      })

      t.ok(ms < STRESS_CONFIG.THROUGHPUT_LIMIT, `${cycles} cycles in ${ms.toFixed(0)}ms`)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Message Throughput Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Node Message Throughput', async st => {
    st.test('measures message round-trip time', async t => {
      const seckey1 = gen_seckey()
      const seckey2 = gen_seckey()
      const pubkey1 = get_pubkey(seckey1)
      const pubkey2 = get_pubkey(seckey2)

      const node1 = new NostrNode([pubkey2], urls, seckey1)
      const node2 = new NostrNode([pubkey1], urls, seckey2)

      await Promise.all([node1.connect(), node2.connect()])

      // Node2 immediately responds
      node2.on('message', (msg: RpcMessageData) => {
        if (msg.type === 'request') {
          const req = msg as RpcMessageData & RequestRpcMessage
          node2.respond(req).accept({ timestamp: Date.now() })
        }
      })

      const samples = 5
      const latencies: number[] = []

      for (let i = 0; i < samples; i++) {
        const start = Date.now()
        await node1.request({ method: 'ping', params: [] }, pubkey2, { timeout: 5000 })
        const latency = Date.now() - start
        latencies.push(latency)
      }

      const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length
      const maxLatency = Math.max(...latencies)

      t.ok(avgLatency < 2000, `avg latency: ${avgLatency.toFixed(0)}ms`)
      t.ok(maxLatency < 5000, `max latency: ${maxLatency.toFixed(0)}ms`)

      node1.close()
      node2.close()
      await wait_ms(200)
      t.end()
    })

    st.end()
  })

  t.teardown(() => {
    relay.stop()
  })
}
