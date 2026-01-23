import { SignedEvent } from './event.js'
import { PublishResponse } from './response.js'

export type RpcMessageType = 'request' | 'accept' | 'reject' | 'event'

export type ResponseRpcMessage = AcceptRpcMessage  | RejectRpcMessage
export type RpcMessagePayload  = RequestRpcMessage | ResponseRpcMessage | EventRpcMessage
export type RpcMessageEnvelope<T extends RpcMessagePayload> = T & { event : SignedEvent }
export type RpcMessageData     = RpcMessageEnvelope<RpcMessagePayload>

export interface RpcResponseMethod {
  accept : (data   : unknown) => Promise<PublishResponse>
  reject : (reason : string)  => Promise<PublishResponse>
}

export interface RpcFilterOptions {
  threshold? : number
  timeout?   : number
}

export interface RpcMessageFilter {
  request_id : string,
  peers      : string[],
  threshold? : number
  timeout?   : number
}

export interface BaseRpcTemplate {
  id?     : string
  version : number
}

export interface BaseRpcMessage extends BaseRpcTemplate {
  id : string
}

export interface RequestRpcTemplate extends BaseRpcTemplate {
  method  : string,
  params? : string[],
  peers?  : string[]
}

export interface RequestRpcMessage extends BaseRpcMessage {
  method : string,
  params : string[],
  peers  : string[],
  type   : 'request'
}

export interface AcceptRpcMessage extends BaseRpcMessage {
  data   : unknown,
  status : true,
  type   : 'accept'
}

export interface RejectRpcMessage extends BaseRpcMessage {
  reason : string,
  status : false,
  type   : 'reject'
}

export interface EventRpcTemplate extends BaseRpcTemplate {
  data  : unknown,
  topic : string
}

export interface EventRpcMessage extends BaseRpcMessage {
  data   : unknown,
  topic  : string,
  type   : 'event'
}
