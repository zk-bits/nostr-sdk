import { z } from 'zod'

import * as BASE  from '@/schema/base.js'
import * as EVENT from '@/schema/event.js'

import type {
  ClientCloseMessage,
  ClientMessage,
  ClientEventMessage,
  ClientRequestMessage,
  RelayClosedMessage,
  RelayEOSEMessage,
  RelayEventMessage,
  RelayMessage,
  RelayNoticeMessage,
  RelayReceiptMessage
} from '@/types/index.js'

export const client_request = z.tuple([
  z.literal('REQ'),
  BASE.str,
  EVENT.filter
]).rest(EVENT.filter) satisfies z.ZodType<ClientRequestMessage>

export const client_publish = z.tuple([
  z.literal('EVENT'),
  EVENT.signed
]) satisfies z.ZodType<ClientEventMessage>

export const client_close = z.tuple([
  z.literal('CLOSE'),
  BASE.str
]) satisfies z.ZodType<ClientCloseMessage>

export const client_message = z.union([
  client_request,
  client_publish,
  client_close
]) satisfies z.ZodType<ClientMessage>

export const relay_close = z.tuple([
  z.literal('CLOSED'),
  BASE.str,
  BASE.str
]) satisfies z.ZodType<RelayClosedMessage>

export const relay_eose = z.tuple([
  z.literal('EOSE'),
  BASE.str
]) satisfies z.ZodType<RelayEOSEMessage>

export const relay_event = z.tuple([
  z.literal('EVENT'),
  BASE.str,
  EVENT.signed
]) satisfies z.ZodType<RelayEventMessage>

export const relay_notice = z.tuple([
  z.literal('NOTICE'),
  BASE.str
]) satisfies z.ZodType<RelayNoticeMessage>

export const relay_receipt = z.tuple([
  z.literal('OK'),
  BASE.hex32,
  z.boolean(),
  BASE.str
]) satisfies z.ZodType<RelayReceiptMessage>

export const relay_message = z.union([
  relay_close,
  relay_eose,
  relay_event,
  relay_notice,
  relay_receipt
]) satisfies z.ZodType<RelayMessage>
