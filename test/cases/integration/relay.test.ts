import { Test }        from 'tape'
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event, verify_event } from '@/lib/event.js'
import { createTestEvent } from '#/helpers/index.js'

export default async function relay_tests (t: Test) {
  t.test('NostrRelay lifecycle', async st => {
    st.test('starts and stops cleanly', async t => {
      const relay = new NostrRelay()

      await relay.start({ port: 8081 })
      t.ok(relay.ready, 'relay is ready after start')

      relay.stop()
      // Give time for cleanup
      await new Promise(r => setTimeout(r, 100))
      t.notOk(relay.ready, 'relay not ready after stop')
      t.end()
    })

    st.test('emits ready event', async t => {
      const relay = new NostrRelay()
      let emitted = false

      relay.on('ready', () => { emitted = true })
      await relay.start({ port: 8082 })

      t.ok(emitted, 'ready event emitted')
      relay.stop()
      t.end()
    })

    st.end()
  })

  t.test('NostrRelay client handling', async st => {
    const relay = new NostrRelay()
    await relay.start({ port: 8083 })

    st.test('accepts client connections', async t => {
      const socket = new NostrSocket('ws://localhost:8083')
      await socket.connect()

      t.ok(socket.is_ready, 'socket connected to relay')
      t.ok(relay.sessions.size > 0, 'relay has active session')

      socket.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.test('handles EVENT message', async t => {
      const socket = new NostrSocket('ws://localhost:8083')
      await socket.connect()

      const event   = createTestEvent()
      const receipt = await socket.publish(event)

      t.ok(receipt.ok, 'event accepted')
      t.ok(relay.cache.events.some(e => e.id === event.id), 'event cached')

      socket.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.test('handles REQ message with filters', async t => {
      const socket = new NostrSocket('ws://localhost:8083')
      await socket.connect()

      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event1 = sign_event(create_event({ content: 'a', kind: 1, pubkey }), seckey)
      const event2 = sign_event(create_event({ content: 'b', kind: 2, pubkey }), seckey)

      await socket.publish(event1)
      await socket.publish(event2)

      const kind1Events = await socket.query({ kinds: [1], authors: [pubkey] })
      t.ok(kind1Events.some(e => e.kind === 1), 'filter by kind works')

      socket.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.test('handles CLOSE message', async t => {
      const socket = new NostrSocket('ws://localhost:8083')
      await socket.connect()

      const sub = await socket.subscribe({ kinds: [1] })
      t.ok(sub.is_active, 'subscription active')

      sub.unsubscribe()
      await new Promise(r => setTimeout(r, 100))
      t.notOk(sub.is_active, 'subscription closed')

      socket.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.test('rejects invalid events', async t => {
      const socket = new NostrSocket('ws://localhost:8083')
      await socket.connect()

      const event  = createTestEvent()
      const tampered = { ...event, sig: '0'.repeat(128) }

      try {
        await socket.publish(tampered)
        t.fail('should have rejected invalid event')
      } catch (err: any) {
        t.ok(err.ok === false, 'publish rejected')
      }

      socket.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.test('broadcasts events to subscribers', async t => {
      const socket1 = new NostrSocket('ws://localhost:8083')
      const socket2 = new NostrSocket('ws://localhost:8083')

      await socket1.connect()
      await socket2.connect()

      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const filter = { kinds: [1], authors: [pubkey] }

      const sub = await socket2.subscribe(filter)
      const listener = sub.listen(2000)

      const event = sign_event(create_event({ content: 'broadcast test', kind: 1, pubkey }), seckey)
      await socket1.publish(event)

      const received = await listener
      t.ok(received.some(e => e.id === event.id), 'subscriber received event')

      socket1.close()
      socket2.close()
      await new Promise(r => setTimeout(r, 200))
      t.end()
    })

    st.teardown(() => {
      relay.stop()
    })

    st.end()
  })
}
