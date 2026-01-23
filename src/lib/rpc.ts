import { PROTOCOL_VERSION }  from '@/const.js'
import { get_shared_secret } from '@/crypto/index.js'
import * as SCHEMA           from '@/schema/index.js'

import {
  create_event,
  sign_event,
  nip44_decrypt,
  nip44_encrypt,
  generate_label,
  parse_error
} from '@/lib/index.js'

import type {
  RequestRpcTemplate,
  RequestRpcMessage,
  RejectRpcMessage,
  EventRpcTemplate,
  EventRpcMessage,
  AcceptRpcMessage,
  RpcMessagePayload,
  SignedEvent,
  EventConfig,
  RpcMessageEnvelope
} from '@/types/index.js'

/**
 * Creates a JSON string payload containing message metadata.
 * @param template Message template
 * @returns        Request message
 */
export function create_request_message (
  template : RequestRpcTemplate,
) : RequestRpcMessage {
  return SCHEMA.RPC.request_message.parse({
    id      : template.id      ?? gen_message_id(),
    method  : template.method,
    params  : template.params  ?? [],
    peers   : template.peers   ?? [],
    type    : 'request',
    version : PROTOCOL_VERSION
  })
}

/**
 * Creates a JSON string payload containing message metadata.
 * @param request Request message
 * @param payload Payload data
 * @returns       JSON stringified array of [tag, id, data]
 */
export function create_accept_message (
  request : RequestRpcMessage,
  payload : any
) : AcceptRpcMessage {
  return SCHEMA.RPC.accept_message.parse({
    id      : request.id,
    data    : payload,
    status  : true,
    type    : 'accept',
    version : PROTOCOL_VERSION
  })
}

/**
 * Creates a JSON string payload containing message metadata.
 * @param request Request message
 * @param reason  Reason for rejection
 * @returns       JSON stringified array of [tag, id, data]
 */
export function create_reject_message (
  request : RequestRpcMessage,
  reason  : string
) : RejectRpcMessage {
  return SCHEMA.RPC.reject_message.parse({
    id      : request.id,
    reason  : reason,
    status  : false,
    type    : 'reject',
    version : PROTOCOL_VERSION
  })
}

/**
 * Creates an event message for broadcasting data to peers.
 * @param template  Event template with topic and data
 * @returns         Event RPC message
 */
export function create_event_message (
  template : EventRpcTemplate
) : EventRpcMessage {
  return SCHEMA.RPC.event_message.parse({
    id      : template.id      ?? gen_message_id(),
    data    : template.data,
    topic   : template.topic,
    type    : 'event',
    version : PROTOCOL_VERSION
  })
}

/**
 * Encrypts and wraps an RPC message in a signed Nostr event.
 * @param config   Event configuration (kind, pubkey)
 * @param message  The RPC message payload to wrap
 * @param peer_pk  The recipient's public key
 * @param seckey   The sender's secret key for signing
 * @returns        A signed Nostr event containing the encrypted message
 */
export function wrap_rpc_message (
  config   : EventConfig,
  message  : RpcMessagePayload,
  peer_pk  : string,
  seckey   : string,
) : SignedEvent {
  const secret  = get_shared_secret(seckey, peer_pk)
  const content = nip44_encrypt(secret, JSON.stringify(message))
  const event   = create_event({ ...config, content })
  event.tags.push([ 'p', peer_pk ])
  return sign_event(event, seckey)
}

/**
 * Decrypts and extracts an RPC message from a signed Nostr event.
 * @param event   The signed event containing the encrypted message
 * @param seckey  The recipient's secret key for decryption
 * @returns       The decrypted RPC message envelope with the original event
 */
export function unwrap_rpc_message (
  event  : SignedEvent,
  seckey : string
) : RpcMessageEnvelope<RpcMessagePayload> {
  const secret  = get_shared_secret(seckey, event.pubkey)
  const content = nip44_decrypt(secret, event.content)
  const parsed  = parse_rpc_message(content)
  return { ...parsed, event }
}

/**
 * Parses a message payload according to schema.
 * @param payload Payload data
 * @returns       Parsed message object
 */
export function parse_rpc_message (
  payload : string
) : RpcMessagePayload {
  try {
    const json = JSON.parse(payload)
    return SCHEMA.RPC.message_payload.parse(json)
  } catch (err) {
    throw new Error('failed to parse message: ' + parse_error(err))
  }
}

/** Generates a random 32-character hexadecimal message ID. */
export function gen_message_id () : string {
  return generate_label(32)
}

/** Validates a request template structure. */
export function validate_request_template (
  template : RequestRpcTemplate
) : asserts template is RequestRpcTemplate {
  SCHEMA.RPC.request_template.parse(template)
}

/** Validates an event template structure. */
export function validate_event_template (
  template : EventRpcTemplate
) : asserts template is EventRpcTemplate {
  SCHEMA.RPC.event_template.parse(template)
}

/** Validates a request RPC message. */
export function validate_request_message (
  message : RequestRpcMessage
) : asserts message is RequestRpcMessage {
  SCHEMA.RPC.request_message.parse(message)
}

/** Validates an event RPC message. */
export function validate_event_message (
  message : EventRpcMessage
) : asserts message is EventRpcMessage {
  SCHEMA.RPC.event_message.parse(message)
}

/** Validates an accept response message. */
export function validate_accept_message (
  message : AcceptRpcMessage
) : asserts message is AcceptRpcMessage {
  SCHEMA.RPC.accept_message.parse(message)
}

/** Validates a reject response message. */
export function validate_reject_message (
  message : RejectRpcMessage
) : asserts message is RejectRpcMessage {
  SCHEMA.RPC.reject_message.parse(message)
}

/** Validates any RPC message payload. */
export function validate_rpc_message (
  message : RpcMessagePayload
) : asserts message is RpcMessagePayload {
  SCHEMA.RPC.message_payload.parse(message)
}
