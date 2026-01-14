import { NostrSocket } from '@/class/socket.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'
import { sleep }                    from '@/lib/util.js'

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

const socket = new NostrSocket('ws://localhost:8080')

socket.all(console.log)

try {
  await socket.connect()

  console.log('[ scratch ] connected to relay')

  const sub = await socket.subscribe(filter)

  sub.all(console.log)

  console.log('[ scratch ] subscribed to filter')

  console.log('[ scratch ] sub state', sub.state)

  const receipt = await socket.publish(event)

  console.log('[ scratch ] published event')

  console.dir(receipt, { depth: null })

  await sleep(1000)

  console.log('[ scratch ] sub state', sub.state)

  const result = await socket.query(filter)

  console.log('[ scratch ] queried events')

  console.dir(result, { depth: null })
} catch (error) {
  console.error('[ scratch ] error', error)
} finally {
  socket.close()
}