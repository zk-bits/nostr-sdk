export interface EventFilter {
  ids     ?: string[]
  authors ?: string[]
  kinds   ?: number[]
  since   ?: number
  until   ?: number
  limit   ?: number
  [ key : string ] : any
}

export interface EventConfig {
  content     : string
  created_at? : number
  kind        : number
  pubkey      : string
  tags?       : string[][]
}

export interface EventTemplate {
  content    : string
  created_at : number
  kind       : number
  pubkey     : string
  tags       : string[][]
}

export interface UnsignedEvent extends EventTemplate {
  id : string
}

export interface SignedEvent extends UnsignedEvent {
  sig : string
}

export interface ParsedEvent <T> extends SignedEvent {
  data : T
}
