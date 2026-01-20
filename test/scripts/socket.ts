import { NostrSocket } from '@/class/socket.js'
import { TEST_URLS }   from '#/config.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'

const seckey = gen_seckey()
const pubkey = get_pubkey(seckey)

const filter = {
  kinds   : [ 1 ],
  authors : [ pubkey ]
}

const template = create_event({
  content : 'Hello, world!',
  kind    : 1,
  pubkey  : pubkey
})

const event = sign_event(template, seckey)

const socket = new NostrSocket(TEST_URLS.SOCKET_RELAY)

// socket.all(console.log)

socket.on('closed', () => {
  process.exit(0)
})

try {
  await socket.connect()

  // const subscription = await socket.subscribe(filter)

  // console.log('subscription', subscription)

  // const listener = subscription.listen()

  const receipt = await socket.publish(event)

  console.log('receipt', receipt)

  const result = await socket.query(filter)

  console.log('result', result)

  // const events = await listener

  // console.log('events', events)
} catch (error) {
  console.error('error', error)
} finally {
  socket.close()
}