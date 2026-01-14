import { z } from 'zod'

import * as BASE from '@/schema/base.js'

import type {
  EventConfig,
  EventFilter,
  EventTemplate,
  SignedEvent,
  UnsignedEvent
} from '@/types/index.js'

export const tags = z.array(BASE.str)

export const config = z.object({
  content     : z.string(),
  created_at  : BASE.uint.optional(),
  kind        : BASE.uint,
  pubkey      : BASE.hex32,
  tags        : tags.array().optional(),
}) satisfies z.ZodType<EventConfig>

export const filter = z.object({
  ids     : BASE.hex32.array().optional(),
  authors : BASE.hex32.array().optional(),
  kinds   : BASE.uint.array().optional(),
  since   : BASE.uint.optional(),
  until   : BASE.uint.optional(),
  limit   : BASE.uint.optional(),
}).catchall(tags) satisfies z.ZodType<EventFilter>

export const template = z.object({
  ...config.shape,
  created_at : BASE.uint,
  tags       : tags.array()
}) satisfies z.ZodType<EventTemplate>

export const unsigned = z.object({
  ...template.shape,
  id : BASE.hex32
}) satisfies z.ZodType<UnsignedEvent>

export const signed = z.object({
  ...unsigned.shape,
  sig : BASE.hex64
}) satisfies z.ZodType<SignedEvent>
