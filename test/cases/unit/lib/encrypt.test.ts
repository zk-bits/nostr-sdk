import { Test } from 'tape'

import {
  nip04_encrypt,
  nip04_decrypt,
  nip44_encrypt,
  nip44_decrypt
} from '@/lib/encrypt.js'

import { gen_seckey, get_pubkey, get_shared_secret } from '@/crypto/ecc.js'

export default function encrypt_tests (t: Test) {
  t.test('nip04_encrypt', st => {
    st.test('returns base64url string with IV', t => {
      const secret    = gen_seckey()
      const content   = 'hello world'
      const encrypted = nip04_encrypt(secret, content)

      t.equal(typeof encrypted, 'string', 'returns string')
      t.ok(encrypted.includes('?iv='), 'contains IV separator')

      const [payload, iv] = encrypted.split('?iv=')
      t.ok(payload.length > 0, 'has payload')
      t.ok(iv.length > 0, 'has IV')
      t.end()
    })

    st.test('produces different output with different IV', t => {
      const secret     = gen_seckey()
      const content    = 'hello world'
      const encrypted1 = nip04_encrypt(secret, content)
      const encrypted2 = nip04_encrypt(secret, content)

      t.notEqual(encrypted1, encrypted2, 'different ciphertext each time')
      t.end()
    })

    st.test('produces same output with provided IV', t => {
      const secret  = gen_seckey()
      const content = 'hello world'
      const iv      = '000102030405060708090a0b0c0d0e0f' // 16 bytes in hex
      const encrypted1 = nip04_encrypt(secret, content, iv)
      const encrypted2 = nip04_encrypt(secret, content, iv)

      t.equal(encrypted1, encrypted2, 'same IV produces same ciphertext')
      t.end()
    })

    st.end()
  })

  t.test('nip04_decrypt', st => {
    st.test('round-trip preserves content', t => {
      const secret    = gen_seckey()
      const content   = 'hello world'
      const encrypted = nip04_encrypt(secret, content)
      const decrypted = nip04_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'decrypted matches original')
      t.end()
    })

    st.test('round-trip with unicode content', t => {
      const secret    = gen_seckey()
      const content   = 'hello \u{1F600} world \u{1F4BB}'
      const encrypted = nip04_encrypt(secret, content)
      const decrypted = nip04_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'unicode content preserved')
      t.end()
    })

    st.test('round-trip with empty content', t => {
      const secret    = gen_seckey()
      const content   = ''
      const encrypted = nip04_encrypt(secret, content)
      const decrypted = nip04_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'empty content preserved')
      t.end()
    })

    st.test('works with shared secret from keypairs', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_sec   = gen_seckey()
      const bob_pub   = get_pubkey(bob_sec)

      const shared_alice = get_shared_secret(alice_sec, bob_pub)
      const shared_bob   = get_shared_secret(bob_sec, alice_pub)

      const content   = 'secret message'
      const encrypted = nip04_encrypt(shared_alice, content)
      const decrypted = nip04_decrypt(shared_bob, encrypted)

      t.equal(decrypted, content, 'alice encrypts, bob decrypts')
      t.end()
    })

    st.end()
  })

  t.test('nip44_encrypt', st => {
    st.test('returns base64url encoded payload', t => {
      const secret    = gen_seckey()
      const content   = 'hello world'
      const encrypted = nip44_encrypt(secret, content)

      t.equal(typeof encrypted, 'string', 'returns string')
      t.ok(encrypted.length >= 132, 'minimum payload length')
      t.end()
    })

    st.test('produces different output each time', t => {
      const secret     = gen_seckey()
      const content    = 'hello world'
      const encrypted1 = nip44_encrypt(secret, content)
      const encrypted2 = nip44_encrypt(secret, content)

      t.notEqual(encrypted1, encrypted2, 'different nonce produces different ciphertext')
      t.end()
    })

    st.test('produces same output with provided nonce', t => {
      const secret  = gen_seckey()
      const content = 'hello world'
      const nonce   = new Uint8Array(32).fill(0x42)
      const encrypted1 = nip44_encrypt(secret, content, nonce)
      const encrypted2 = nip44_encrypt(secret, content, nonce)

      t.equal(encrypted1, encrypted2, 'same nonce produces same ciphertext')
      t.end()
    })

    st.end()
  })

  t.test('nip44_decrypt', st => {
    st.test('round-trip preserves content', t => {
      const secret    = gen_seckey()
      const content   = 'hello world'
      const encrypted = nip44_encrypt(secret, content)
      const decrypted = nip44_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'decrypted matches original')
      t.end()
    })

    st.test('round-trip with short message', t => {
      const secret    = gen_seckey()
      const content   = 'a'
      const encrypted = nip44_encrypt(secret, content)
      const decrypted = nip44_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'short message preserved')
      t.end()
    })

    st.test('round-trip with medium message', t => {
      const secret    = gen_seckey()
      const content   = 'a'.repeat(256)
      const encrypted = nip44_encrypt(secret, content)
      const decrypted = nip44_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'medium message preserved')
      t.end()
    })

    st.test('round-trip with large message', t => {
      const secret    = gen_seckey()
      const content   = 'a'.repeat(8192)
      const encrypted = nip44_encrypt(secret, content)
      const decrypted = nip44_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'large message preserved')
      t.end()
    })

    st.test('round-trip with unicode content', t => {
      const secret    = gen_seckey()
      const content   = 'hello \u{1F600} world \u{1F4BB}'
      const encrypted = nip44_encrypt(secret, content)
      const decrypted = nip44_decrypt(secret, encrypted)

      t.equal(decrypted, content, 'unicode content preserved')
      t.end()
    })

    st.test('works with shared secret from keypairs', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_sec   = gen_seckey()
      const bob_pub   = get_pubkey(bob_sec)

      const shared_alice = get_shared_secret(alice_sec, bob_pub)
      const shared_bob   = get_shared_secret(bob_sec, alice_pub)

      const content   = 'secret message'
      const encrypted = nip44_encrypt(shared_alice, content)
      const decrypted = nip44_decrypt(shared_bob, encrypted)

      t.equal(decrypted, content, 'alice encrypts, bob decrypts')
      t.end()
    })

    st.test('throws on wrong key', t => {
      const secret1   = gen_seckey()
      const secret2   = gen_seckey()
      const content   = 'hello world'
      const encrypted = nip44_encrypt(secret1, content)

      t.throws(
        () => nip44_decrypt(secret2, encrypted),
        'throws on wrong key'
      )
      t.end()
    })

    st.test('throws on invalid payload', t => {
      const secret = gen_seckey()

      t.throws(
        () => nip44_decrypt(secret, 'too-short'),
        'throws on invalid payload'
      )
      t.end()
    })

    st.end()
  })
}
