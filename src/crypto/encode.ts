import { base64urlnopad } from '@scure/base'

import { assert_base64, assert_ok } from '@/lib/index.js'

/**
 * Encodes bytes to base64url string (no padding).
 * @param data  Uint8Array to encode
 * @returns     Base64url encoded string
 */
export function encode_b64url (data : Uint8Array) {
  assert_ok(data instanceof Uint8Array)
  return base64urlnopad.encode(data)
}

/**
 * Decodes base64url string to bytes.
 * @param data  Base64url string to decode
 * @returns     Decoded Uint8Array
 */
export function decode_b64url (data : string) {
  assert_base64(data)
  return base64urlnopad.decode(data)
}
