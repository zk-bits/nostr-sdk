import type { EventFilter, SignedEvent } from './event.js'

export type ClientRequestMessage = [
  type       : 'REQ',
  sub_id     : string,
  ...filters : EventFilter[]
]

export type ClientEventMessage = [
  type  : 'EVENT',
  event : SignedEvent
]

export type ClientCloseMessage = [
  type   : 'CLOSE',
  sub_id : string
]

export type ClientMessage =
    ClientRequestMessage
  | ClientEventMessage
  | ClientCloseMessage

export type RelayClosedMessage = [
  type    : 'CLOSED',
  sub_id  : string,
  message : string
]

export type RelayEOSEMessage = [
  type   : 'EOSE',
  sub_id : string
]

export type RelayEventMessage = [
  type   : 'EVENT',
  sub_id : string,
  event  : SignedEvent
]

export type RelayNoticeMessage = [
  type    : 'NOTICE',
  message : string
]

export type RelayReceiptMessage = [
  type     : 'OK',
  event_id : string,
  status   : boolean,
  message  : string
]

export type RelayMessage =
    RelayClosedMessage
  | RelayEOSEMessage
  | RelayEventMessage
  | RelayNoticeMessage
  | RelayReceiptMessage
