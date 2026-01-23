import { z } from 'zod'

import * as BASE from '@/schema/base.js'

const base_message = z.object({
  id      : BASE.str,
  version : BASE.uint
})

const base_template = base_message.partial()
const message_data  = z.unknown().refine(e => e !== undefined)

export const request_template = z.object({
  ...base_template.shape,
  method  : BASE.str,
  params  : BASE.str.array().optional(),
  peers   : BASE.hex32.array().optional()
})

export const request_message = z.object({
  ...base_message.shape,
  method : BASE.str,
  params : BASE.str.array(),
  peers  : BASE.hex32.array(),
  type   : z.literal('request'), 
})

export const accept_message = z.object({
  ...base_message.shape,
  data   : message_data,
  status : z.literal(true),
  type   : z.literal('accept'),
})

export const reject_message = z.object({
  ...base_message.shape,
  reason : BASE.str,
  status : z.literal(false),
  type   : z.literal('reject'),
})

export const event_template = z.object({
  ...base_template.shape,
  data  : message_data,
  topic : BASE.str,
})

export const event_message = z.object({
  ...base_message.shape,
  data  : message_data,
  topic : BASE.str,
  type  : z.literal('event'),
})

export const message_payload = z.discriminatedUnion('type', [
  request_message, accept_message, reject_message, event_message
])
