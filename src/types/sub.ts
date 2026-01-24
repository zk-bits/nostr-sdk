import type { NostrSubscription } from '@/class/sub.js'
import type { SignedEvent }       from './event.js'

export type SubscriptionFilterMode = 'eose' | 'event' | 'timeout'

export interface SubscriptionFilterOptions {
  duration? : number
  mode?     : SubscriptionFilterMode
}

export interface SubscriptionEventHandler {
  cancel : (reason?: string) => void,
  eose   : () => void,
  event  : (event: SignedEvent) => void
}

export interface SubscriptionState {
  active  : boolean
  count   : number
  eose    : boolean
  retries : number
  since   : number
}

export interface NostrSubscriptionEvent extends Record<string, any[]> {
  active : [ void ],
  cancel : [ string ],
  eose   : [ void ],
  event  : [ SignedEvent ]
}

export interface SubscriptionManagerEvent extends Record<string, any[]> {
  active : [ void ],
  cancel : [ NostrSubscription, string ],
  eose   : [ NostrSubscription ],
  event  : [ SignedEvent ]
}
