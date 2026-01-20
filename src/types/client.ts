import { NostrSocket } from '@/class/socket.js'

import type {
  RelayEventMessage,
  RelayEOSEMessage,
  RelayReceiptMessage,
  RelayClosedMessage,
  RelayMessage
} from './message.js'

import type { SignedEvent }       from './event.js'
import type { NostrSocketConfig } from './socket.js'

export interface RelayFailure {
  relay  : string
  reason : string
}

export interface NostrClientConfig extends NostrSocketConfig {
  cache_size : number
}

export interface NostrEmitterEvent extends Record<string, any[]> {
  bounce  : [ string, RelayEventMessage   ],
  closed  : [ string, NostrSocket         ],
  eose    : [ string, RelayEOSEMessage    ],
  error   : [ string, unknown, unknown    ],
  event   : [ string, RelayEventMessage   ],
  message : [ string, RelayMessage        ],
  notice  : [ string, string              ],
  ready   : [ string, NostrSocket         ],
  receipt : [ string, RelayReceiptMessage ],
  reject  : [ string, unknown, string     ],
  unsub   : [ string, RelayClosedMessage  ]
}

export interface NostrClientEvent extends Record<string, any[]> {
  closed : [ void ],
  event  : [ string, SignedEvent  ]
  ready  : [ void ]
}
