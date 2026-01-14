import type { SignedEvent } from './event.js'

export type PublishResponse      = PublishAccept      | PublishReject
export type QueryResponse        = QueryAccept        | QueryReject
export type SubscriptionResponse = SubscriptionAccept | SubscriptionReject

export interface RelayAccept {
  ok    : true
  relay : string
}

export interface RelayReject {
  ok     : false
  relay  : string
  reason : string
}

export interface SubscriptionAccept extends RelayAccept {
  sub_id : string
}

export interface SubscriptionReject extends RelayReject {
  sub_id : string
}

export interface PublishAccept extends RelayAccept {
  event_id : string
}

export interface PublishReject extends RelayReject {
  event_id : string
}

export interface QueryAccept extends RelayAccept {
  events : SignedEvent[]
}

export interface QueryReject extends RelayReject {
  events : SignedEvent[]
}