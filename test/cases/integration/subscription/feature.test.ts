/**
 * Subscription Feature Tests
 *
 * Happy path tests validating that NostrSubscription works correctly
 * under normal conditions.
 */
import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { NostrSubscription } from '@/class/sub.js'
import { TEST_PORTS, TEST_URLS } from '#/config.js'

import { create_event, sign_event } from '@/lib/event.js'
import {
  wait_ms,
  create_keypair,
  create_event_stream
} from '#/cases/integration/helpers/fixtures.js'

export default async function subscription_feature_tests (t: Test) {
  const relay = new NostrRelay()
  await relay.start({ port: TEST_PORTS.SUB.FEATURE })
  const url = TEST_URLS.SUB.FEATURE

  // ───────────────────────────────────────────────────────────────
  // Lifecycle Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Lifecycle', async st => {
    st.test('creates subscription with filters', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = new NostrSubscription({ kinds: [1] }, socket)
      t.ok(sub.sub_id.length > 0, 'subscription has id')
      t.deepEqual(sub.filters, [{ kinds: [1] }], 'filters stored')
      t.notOk(sub.is_active, 'not active before subscribe')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('activates on subscribe', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [1] })
      await sub.activate()

      t.ok(sub.is_active, 'subscription active after subscribe')
      t.ok(sub.state.active, 'state reflects active')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('emits eose event', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = new NostrSubscription({ kinds: [1] }, socket)
      let eoseEmit = false

      sub.on('eose', () => { eoseEmit = true })
      await sub.activate()

      t.ok(eoseEmit, 'eose event emitted')
      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('cancel stops subscription', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [1] })
      await sub.activate()
      t.ok(sub.is_active, 'subscription active')

      sub.cancel()
      t.notOk(sub.is_active, 'subscription cancelled')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Event Receiving Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Events', async st => {
    st.test('emits event when receiving events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      const received: any[] = []
      sub.on('event', (e) => { received.push(e) })

      await sub.activate()

      const event = sign_event(create_event({ content: 'test', kind: 1, pubkey }), seckey)
      await socket.publish(event)

      await wait_ms(200)
      t.ok(received.some(e => e.id === event.id), 'event emitted')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('listen collects events for duration', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      const listener = sub.listen({ mode: 'timeout', duration: 1000 })

      const event1 = sign_event(create_event({ content: 'one', kind: 1, pubkey }), seckey)
      const event2 = sign_event(create_event({ content: 'two', kind: 1, pubkey }), seckey)

      await socket.publish(event1)
      await wait_ms(100)
      await socket.publish(event2)

      const events = await listener
      t.ok(events.length >= 1, 'collected events')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('unsubscribe stops receiving events', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      const received: any[] = []
      sub.on('event', (e) => { received.push(e) })

      sub.cancel()
      t.notOk(sub.is_active, 'subscription inactive after unsubscribe')

      const event = sign_event(create_event({ content: 'after', kind: 1, pubkey }), seckey)
      await socket.publish(event)
      await wait_ms(200)

      t.notOk(received.some(e => e.id === event.id), 'no events after unsubscribe')

      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Multiple Listeners Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Multiple Listeners', async st => {
    st.test('multiple listeners on same subscription', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      const received1: any[] = []
      const received2: any[] = []

      sub.on('event', (e) => { received1.push(e) })
      sub.on('event', (e) => { received2.push(e) })

      await sub.activate()

      const event = sign_event(create_event({ content: 'multi-listener', kind: 1, pubkey }), seckey)
      await socket.publish(event)
      await wait_ms(200)

      t.ok(received1.length > 0, 'listener 1 received events')
      t.ok(received2.length > 0, 'listener 2 received events')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('one listener can be removed while others continue', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      const received1: any[] = []
      const received2: any[] = []

      const handler1 = (e: any) => { received1.push(e) }
      const handler2 = (e: any) => { received2.push(e) }

      sub.on('event', handler1)
      sub.on('event', handler2)

      await sub.activate()

      // Remove first handler
      sub.off('event', handler1)

      const event = sign_event(create_event({ content: 'partial-listener', kind: 1, pubkey }), seckey)
      await socket.publish(event)
      await wait_ms(200)

      t.equal(received1.length, 0, 'removed listener got no events')
      t.ok(received2.length > 0, 'remaining listener got events')

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // Resubscribe Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription Resubscribe', async st => {
    st.test('can create new subscription after cancel', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      // First subscription
      const sub1 = socket.subscribe(filter)
      await sub1.activate()
      sub1.cancel()

      // Second subscription
      const sub2 = socket.subscribe(filter)
      await sub2.activate()
      t.ok(sub2.is_active, 'second subscription active')

      const received: any[] = []
      sub2.on('event', (e) => { received.push(e) })

      const event = sign_event(create_event({ content: 'resubscribe', kind: 1, pubkey }), seckey)
      await socket.publish(event)
      await wait_ms(200)

      t.ok(received.some(e => e.id === event.id), 'new subscription receives events')

      sub2.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.end()
  })

  // ───────────────────────────────────────────────────────────────
  // State Tracking Tests
  // ───────────────────────────────────────────────────────────────

  t.test('Subscription State', async st => {
    st.test('tracks event count', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const { seckey, pubkey } = create_keypair()
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = socket.subscribe(filter)
      await sub.activate()

      t.equal(sub.state.count, 0, 'initial count is 0')

      const events = create_event_stream(5, { pubkey, seckey })
      for (const event of events) {
        await socket.publish(event)
      }
      await wait_ms(500)

      t.ok(sub.state.count >= 1, `count updated to ${sub.state.count}`)

      sub.cancel()
      socket.close()
      await wait_ms(100)
      t.end()
    })

    st.test('tracks eose state', async t => {
      const socket = new NostrSocket(url)
      await socket.connect()

      const sub = socket.subscribe({ kinds: [1] })
      t.notOk(sub.state.eose, 'eose false before activate')

      await sub.activate()
      t.ok(sub.state.eose, 'eose true after activate')

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
