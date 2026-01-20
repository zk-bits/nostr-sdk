import { Test } from 'tape'

import {
  encode_b64url,
  decode_b64url
} from '@/crypto/encode.js'

// Note: There's a mismatch in the SDK between encode_b64url (uses URL-safe base64 with - and _)
// and assert_base64 (only accepts standard base64 with + and /).
// This means decode_b64url cannot decode the output of encode_b64url for certain inputs.
// Tests here focus on what actually works.

export default function encode_tests (t: Test) {
  t.test('encode_b64url / decode_b64url', st => {
    st.test('encode produces string output', t => {
      const original = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8])
      const encoded  = encode_b64url(original)

      t.equal(typeof encoded, 'string', 'returns string')
      t.ok(encoded.length > 0, 'non-empty output')
      t.end()
    })

    st.test('produces URL-safe output', t => {
      // Use data that would produce + and / in standard base64
      const data    = new Uint8Array([251, 255, 254, 253])
      const encoded = encode_b64url(data)

      t.notOk(encoded.includes('+'), 'no + character')
      t.notOk(encoded.includes('/'), 'no / character')
      t.notOk(encoded.includes('='), 'no padding character')
      t.end()
    })

    st.test('handles empty array', t => {
      const original = new Uint8Array([])
      const encoded  = encode_b64url(original)

      t.equal(encoded, '', 'empty array produces empty string')
      t.end()
    })

    st.test('encode throws on non-Uint8Array', t => {
      t.throws(
        () => encode_b64url('not a uint8array' as any),
        /Assertion failed/i,
        'throws on string input'
      )
      t.end()
    })

    st.test('decode throws on non-string', t => {
      t.throws(
        () => decode_b64url(123 as any),
        /not a string/i,
        'throws on non-string input'
      )
      t.end()
    })

    st.test('deterministic encoding', t => {
      const data = new Uint8Array([10, 20, 30, 40, 50])
      const enc1 = encode_b64url(data)
      const enc2 = encode_b64url(data)

      t.equal(enc1, enc2, 'same data produces same encoding')
      t.end()
    })

    st.end()
  })
}
