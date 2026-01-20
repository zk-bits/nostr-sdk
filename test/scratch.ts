import { NostrSocket } from '@/class/socket.js'
import { TEST_URLS }   from '#/config.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'
import { match_filter } from '@/lib/filter.js'
import { sleep }                    from '@/lib/util.js'
import { EventFilter, EventTemplate } from '@/types/event.js'

const seckey = gen_seckey()
const pubkey = get_pubkey(seckey)
const hash   = '82e748fc9f0c2fd6b9366c9dc2b6732c2d8e76e4de8615c1c3418e29b5f40547'

const filter : EventFilter = {
  kinds   : [ 1 ],
  authors : [ pubkey ],
  '#h'    : [ hash ]
}

const template : EventTemplate = create_event({
  content : 'Hello, world!',
  kind    : 1,
  pubkey  : pubkey,
  tags    : [ [ 'h', hash ] ]
})

const event = sign_event(template, seckey)

const socket = new NostrSocket(TEST_URLS.SOCKET_RELAY)

socket.all(console.log)

try {
  const receipt = await socket.publish(event)

  console.log('[ scratch ] published event')

  console.dir(receipt, { depth: null })

  await sleep(500)

  const result = await socket.query(filter)

  console.log('[ scratch ] queried events')

  console.dir(result, { depth: null })
} catch (error) {
  console.error('[ scratch ] error', error)
} finally {
  socket.close()
}