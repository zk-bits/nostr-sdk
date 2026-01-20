import { Test } from 'tape'
import { Buff } from '@vbyte/buff'

import { hash_message } from '@/crypto/hash.js'

export default function hash_tests (t: Test) {
  t.test('hash_message', st => {
    st.test('returns 64-char hex string', t => {
      const hash = hash_message(Buff.str('test'))
      t.equal(typeof hash, 'string', 'returns string')
      t.equal(hash.length, 64, 'has 64 characters (SHA-256)')
      t.ok(/^[0-9a-f]+$/.test(hash), 'is valid hex')
      t.end()
    })

    st.test('deterministic output', t => {
      const input = Buff.str('hello world')
      const hash1 = hash_message(input)
      const hash2 = hash_message(input)
      t.equal(hash1, hash2, 'same input produces same hash')
      t.end()
    })

    st.test('different inputs produce different hashes', t => {
      const hash1 = hash_message(Buff.str('hello'))
      const hash2 = hash_message(Buff.str('world'))
      t.notEqual(hash1, hash2, 'different inputs produce different hashes')
      t.end()
    })

    st.test('known SHA-256 test vector', t => {
      // SHA-256("") = e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
      const hash = hash_message(Buff.str(''))
      t.equal(
        hash,
        'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        'empty string matches known hash'
      )
      t.end()
    })

    st.test('known SHA-256 test vector for "abc"', t => {
      // SHA-256("abc") = ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad
      const hash = hash_message(Buff.str('abc'))
      t.equal(
        hash,
        'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
        '"abc" matches known hash'
      )
      t.end()
    })

    st.test('concatenates multiple inputs', t => {
      const combined = hash_message(Buff.str('hello'), Buff.str('world'))
      const single   = hash_message(Buff.str('helloworld'))
      t.equal(combined, single, 'concatenated inputs match single combined input')
      t.end()
    })

    st.test('handles Uint8Array input', t => {
      const bytes = new Uint8Array([0x74, 0x65, 0x73, 0x74]) // "test"
      const hash  = hash_message(bytes)
      t.equal(hash.length, 64, 'returns valid hash from Uint8Array')
      t.end()
    })

    st.test('handles hex input via Buff.hex', t => {
      const hexInput = Buff.hex('deadbeef')
      const hash     = hash_message(hexInput)
      t.equal(hash.length, 64, 'returns valid hash from hex bytes')
      t.end()
    })

    st.end()
  })
}
