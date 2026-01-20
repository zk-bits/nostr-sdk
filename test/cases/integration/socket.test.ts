
import { Test }        from 'tape'
import { NostrSocket } from '@/class/socket.js'
import { TEST_URLS }   from '#/config.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'

export default async function (t : Test) {
  // Create a new socket.
  const socket = new NostrSocket(TEST_URLS.SOCKET_RELAY)
  // Try to run the test case.
  try { await socket_test(t, socket) } 
  // If an error occurs,
  catch (error) {
    // Log the error to the console.
    console.error(error)
    // Fail the test case.
    t.fail(String(error))
  }
  // Clean up the test case.
  finally {
    // Close the socket.
    socket.close()
  }
}

async function socket_test (t : Test, socket : NostrSocket) {
  const seckey = gen_seckey()
  const pubkey = get_pubkey(seckey)

  const filter = { kinds : [ 1 ], authors : [ pubkey ] }

  const template = create_event({
    content : 'Hello, world!',
    kind    : 1,
    pubkey  : pubkey
  })

  const event = sign_event(template, seckey)

  const subscription = await socket.subscribe(filter)
  const listener     = subscription.listen()

  t.ok(subscription.is_active, 'subscription is active')

  const receipt = await socket.publish(event)

  t.ok(receipt.ok, 'publish receipt is ok')

  const events = await listener

  t.ok(events.length > 0, 'subscription listener found events')

  t.ok(subscription.state.count === events.length, 'subscription recorded correct number of events')

  const result = await socket.query(filter)

  t.ok(result.length > 0, 'query found events')

  t.ok(result.length === events.length, 'query recorded correct number of events')
}
