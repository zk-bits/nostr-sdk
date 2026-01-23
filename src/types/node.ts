import type { NostrClientConfig } from '@/types/client.js'
import type { RelayPolicy }       from '@/types/relay.js'

export interface NostrNodeConfig extends NostrClientConfig {
  rpc_kind : number,
  sub_id   : string
}

export interface PeerNodeConfig {
  pubkey  : string
  policy  : RelayPolicy
}

export type PeerStatus = 'active' | 'inactive'

export interface RpcRequestOptions {
  threshold? : number,
  timeout?   : number
}
