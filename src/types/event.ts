/** Filter criteria for querying events from relays. */
export interface EventFilter {
  ids     ?: string[]
  authors ?: string[]
  kinds   ?: number[]
  since   ?: number
  until   ?: number
  limit   ?: number
  [ key : string ] : string[] | string | number | number[] | undefined
}

/** Configuration for creating a new event. */
export interface EventConfig {
  content?    : string
  created_at? : number
  kind        : number
  pubkey      : string
  tags?       : string[][]
}

/** A complete event template ready for signing. */
export interface EventTemplate {
  content    : string
  created_at : number
  kind       : number
  pubkey     : string
  tags       : string[][]
}

/** An event with computed ID but no signature. */
export interface UnsignedEvent extends EventTemplate {
  id : string
}

/** A fully signed Nostr event. */
export interface SignedEvent extends UnsignedEvent {
  sig : string
}

/** A signed event with parsed content data. */
export interface ParsedEvent <T> extends SignedEvent {
  data : T
}
