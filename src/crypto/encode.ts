import { base64urlnopad } from '@scure/base'

import { assert_base64, assert_ok } from '@/lib/index.js'

export function encode_b64url (data : Uint8Array) {
  assert_ok(data instanceof Uint8Array)
  return base64urlnopad.encode(data)
}

export function decode_b64url (data : string) {
  assert_base64(data)
  return base64urlnopad.decode(data)
}
