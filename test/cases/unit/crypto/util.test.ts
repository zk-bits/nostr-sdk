import { Test } from 'tape'

import { base64urlnopad } from '@scure/base'

import {
  get_conversation_key,
  get_message_keys,
  calc_padded_len,
  write_u16_be,
  pad_message,
  unpad_message,
  hmac_aad,
  decode_payload
} from '@/crypto/util.js'

import { gen_seckey } from '@/crypto/ecc.js'

export default function util_crypto_tests (t: Test) {
  t.test('get_conversation_key', st => {
    st.test('returns 32-byte Uint8Array', t => {
      const secret = gen_seckey()
      const key    = get_conversation_key(secret)

      t.ok(key instanceof Uint8Array, 'returns Uint8Array')
      t.equal(key.length, 32, 'has 32 bytes')
      t.end()
    })

    st.test('deterministic for same input', t => {
      const secret = gen_seckey()
      const key1   = get_conversation_key(secret)
      const key2   = get_conversation_key(secret)

      t.deepEqual(key1, key2, 'same input produces same key')
      t.end()
    })

    st.test('different for different secrets', t => {
      const secret1 = gen_seckey()
      const secret2 = gen_seckey()
      const key1    = get_conversation_key(secret1)
      const key2    = get_conversation_key(secret2)

      t.notDeepEqual(key1, key2, 'different secrets produce different keys')
      t.end()
    })

    st.end()
  })

  t.test('get_message_keys', st => {
    st.test('returns object with correct key sizes', t => {
      const secret    = gen_seckey()
      const convo_key = get_conversation_key(secret)
      const nonce     = new Uint8Array(32).fill(0x42)
      const keys      = get_message_keys(convo_key, nonce)

      t.ok(keys.chacha_key instanceof Uint8Array, 'chacha_key is Uint8Array')
      t.equal(keys.chacha_key.length, 32, 'chacha_key is 32 bytes')
      t.ok(keys.chacha_nonce instanceof Uint8Array, 'chacha_nonce is Uint8Array')
      t.equal(keys.chacha_nonce.length, 12, 'chacha_nonce is 12 bytes')
      t.ok(keys.hmac_key instanceof Uint8Array, 'hmac_key is Uint8Array')
      t.equal(keys.hmac_key.length, 32, 'hmac_key is 32 bytes')
      t.end()
    })

    st.test('deterministic for same inputs', t => {
      const secret    = gen_seckey()
      const convo_key = get_conversation_key(secret)
      const nonce     = new Uint8Array(32).fill(0x42)
      const keys1     = get_message_keys(convo_key, nonce)
      const keys2     = get_message_keys(convo_key, nonce)

      t.deepEqual(keys1.chacha_key, keys2.chacha_key, 'same chacha_key')
      t.deepEqual(keys1.chacha_nonce, keys2.chacha_nonce, 'same chacha_nonce')
      t.deepEqual(keys1.hmac_key, keys2.hmac_key, 'same hmac_key')
      t.end()
    })

    st.test('different for different nonces', t => {
      const secret    = gen_seckey()
      const convo_key = get_conversation_key(secret)
      const nonce1    = new Uint8Array(32).fill(0x42)
      const nonce2    = new Uint8Array(32).fill(0x43)
      const keys1     = get_message_keys(convo_key, nonce1)
      const keys2     = get_message_keys(convo_key, nonce2)

      t.notDeepEqual(keys1.chacha_key, keys2.chacha_key, 'different chacha_key')
      t.end()
    })

    st.end()
  })

  t.test('calc_padded_len', st => {
    st.test('returns 32 for lengths 1-32', t => {
      t.equal(calc_padded_len(1), 32, 'length 1 -> 32')
      t.equal(calc_padded_len(16), 32, 'length 16 -> 32')
      t.equal(calc_padded_len(32), 32, 'length 32 -> 32')
      t.end()
    })

    st.test('returns 64 for lengths 33-64', t => {
      t.equal(calc_padded_len(33), 64, 'length 33 -> 64')
      t.equal(calc_padded_len(64), 64, 'length 64 -> 64')
      t.end()
    })

    st.test('correct padding for larger lengths', t => {
      t.equal(calc_padded_len(100), 128, 'length 100 -> 128')
      t.equal(calc_padded_len(256), 256, 'length 256 -> 256')
      t.equal(calc_padded_len(257), 320, 'length 257 -> 320')
      t.end()
    })

    st.test('throws on non-positive integers', t => {
      t.throws(() => calc_padded_len(0), 'throws on 0')
      t.throws(() => calc_padded_len(-1), 'throws on negative')
      t.throws(() => calc_padded_len(1.5), 'throws on non-integer')
      t.end()
    })

    st.end()
  })

  t.test('write_u16_be', st => {
    st.test('correctly encodes numbers in big-endian', t => {
      const arr1 = write_u16_be(1)
      t.equal(arr1[0], 0, 'high byte is 0')
      t.equal(arr1[1], 1, 'low byte is 1')

      const arr256 = write_u16_be(256)
      t.equal(arr256[0], 1, 'high byte is 1')
      t.equal(arr256[1], 0, 'low byte is 0')

      const arrMax = write_u16_be(65535)
      t.equal(arrMax[0], 255, 'high byte is 255')
      t.equal(arrMax[1], 255, 'low byte is 255')
      t.end()
    })

    st.test('throws on out-of-range values', t => {
      t.throws(() => write_u16_be(0), 'throws on 0')
      t.throws(() => write_u16_be(-1), 'throws on negative')
      t.throws(() => write_u16_be(65536), 'throws on > 65535')
      t.end()
    })

    st.end()
  })

  t.test('pad_message / unpad_message', st => {
    st.test('round-trip preserves message', t => {
      const message  = 'hello world'
      const padded   = pad_message(message)
      const unpadded = unpad_message(padded)

      t.equal(unpadded, message, 'message preserved')
      t.end()
    })

    st.test('round-trip with short message', t => {
      const message  = 'a'
      const padded   = pad_message(message)
      const unpadded = unpad_message(padded)

      t.equal(unpadded, message, 'short message preserved')
      t.equal(padded.length, 34, 'padded to 32 bytes + 2 byte prefix')
      t.end()
    })

    st.test('round-trip with unicode', t => {
      const message  = 'hello \u{1F600}'
      const padded   = pad_message(message)
      const unpadded = unpad_message(padded)

      t.equal(unpadded, message, 'unicode message preserved')
      t.end()
    })

    st.test('correct padding lengths', t => {
      const msg32  = 'a'.repeat(32)
      const msg33  = 'a'.repeat(33)

      const padded32 = pad_message(msg32)
      const padded33 = pad_message(msg33)

      t.equal(padded32.length, 34, '32 chars -> 34 bytes (32 + 2 prefix)')
      t.equal(padded33.length, 66, '33 chars -> 66 bytes (64 + 2 prefix)')
      t.end()
    })

    st.test('unpad throws on invalid padding', t => {
      // Create invalid padding: length prefix doesn't match actual content
      const invalid = new Uint8Array(34)
      invalid[0] = 0
      invalid[1] = 100 // Claims 100 bytes but only has 32

      t.throws(() => unpad_message(invalid), 'throws on invalid padding')
      t.end()
    })

    st.end()
  })

  t.test('hmac_aad', st => {
    st.test('returns 32-byte MAC', t => {
      const key     = new Uint8Array(32).fill(0x42)
      const message = new Uint8Array(64).fill(0x00)
      const aad     = new Uint8Array(32).fill(0x01)
      const mac     = hmac_aad(key, message, aad)

      t.ok(mac instanceof Uint8Array, 'returns Uint8Array')
      t.equal(mac.length, 32, 'MAC is 32 bytes')
      t.end()
    })

    st.test('deterministic for same inputs', t => {
      const key     = new Uint8Array(32).fill(0x42)
      const message = new Uint8Array(64).fill(0x00)
      const aad     = new Uint8Array(32).fill(0x01)
      const mac1    = hmac_aad(key, message, aad)
      const mac2    = hmac_aad(key, message, aad)

      t.deepEqual(mac1, mac2, 'same inputs produce same MAC')
      t.end()
    })

    st.test('different for different inputs', t => {
      const key      = new Uint8Array(32).fill(0x42)
      const message1 = new Uint8Array(64).fill(0x00)
      const message2 = new Uint8Array(64).fill(0x01)
      const aad      = new Uint8Array(32).fill(0x01)
      const mac1     = hmac_aad(key, message1, aad)
      const mac2     = hmac_aad(key, message2, aad)

      t.notDeepEqual(mac1, mac2, 'different messages produce different MACs')
      t.end()
    })

    st.test('throws if AAD is not 32 bytes', t => {
      const key     = new Uint8Array(32).fill(0x42)
      const message = new Uint8Array(64).fill(0x00)
      const badAad  = new Uint8Array(16).fill(0x01)

      t.throws(() => hmac_aad(key, message, badAad), 'throws on wrong AAD length')
      t.end()
    })

    st.end()
  })

  t.test('decode_payload', st => {
    st.test('extracts nonce, ciphertext, mac from valid payload', t => {
      // Create a valid payload manually:
      // version (1 byte) + nonce (32 bytes) + ciphertext (34+ bytes) + mac (32 bytes)
      // Minimum: 1 + 32 + 34 + 32 = 99 bytes
      const version    = new Uint8Array([2])
      const nonce      = new Uint8Array(32).fill(0x42)
      const ciphertext = new Uint8Array(34).fill(0x00) // 34 = min padded (32) + 2 length prefix
      const mac        = new Uint8Array(32).fill(0x01)

      // Combine all parts
      const combined = new Uint8Array(99)
      combined.set(version, 0)
      combined.set(nonce, 1)
      combined.set(ciphertext, 33)
      combined.set(mac, 67)

      const payload = base64urlnopad.encode(combined)
      const decoded = decode_payload(payload)

      t.ok(decoded.nonce instanceof Uint8Array, 'has nonce')
      t.equal(decoded.nonce.length, 32, 'nonce is 32 bytes')
      t.ok(decoded.ciphertext instanceof Uint8Array, 'has ciphertext')
      t.equal(decoded.ciphertext.length, 34, 'ciphertext is 34 bytes')
      t.ok(decoded.mac instanceof Uint8Array, 'has mac')
      t.equal(decoded.mac.length, 32, 'mac is 32 bytes')
      t.end()
    })

    st.test('throws on invalid payload length', t => {
      t.throws(() => decode_payload('short'), 'throws on too short')
      t.end()
    })

    st.test('throws on wrong version byte', t => {
      // Create a payload with wrong version (not 2)
      const version    = new Uint8Array([1]) // Wrong version
      const nonce      = new Uint8Array(32).fill(0x42)
      const ciphertext = new Uint8Array(34).fill(0x00)
      const mac        = new Uint8Array(32).fill(0x01)

      const combined = new Uint8Array(99)
      combined.set(version, 0)
      combined.set(nonce, 1)
      combined.set(ciphertext, 33)
      combined.set(mac, 67)

      const badPayload = base64urlnopad.encode(combined)

      t.throws(() => decode_payload(badPayload), 'throws on wrong version')
      t.end()
    })

    st.test('throws on invalid base64', t => {
      // Create a string that's the right length but invalid base64
      const invalid = '!' + 'A'.repeat(131)

      t.throws(() => decode_payload(invalid), 'throws on invalid base64')
      t.end()
    })

    st.end()
  })
}
