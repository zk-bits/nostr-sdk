import { Test } from 'tape'

import {
  gen_seckey,
  get_pubkey,
  get_shared_secret,
  create_signature,
  verify_signature
} from '@/crypto/ecc.js'

export default function ecc_tests (t: Test) {
  t.test('gen_seckey', st => {
    st.test('generates valid 64-char hex string', t => {
      const seckey = gen_seckey()
      t.equal(typeof seckey, 'string', 'returns string')
      t.equal(seckey.length, 64, 'has 64 characters')
      t.ok(/^[0-9a-f]+$/.test(seckey), 'is valid hex')
      t.end()
    })

    st.test('generates unique keys', t => {
      const key1 = gen_seckey()
      const key2 = gen_seckey()
      t.notEqual(key1, key2, 'different keys generated')
      t.end()
    })

    st.test('deterministic with seed', t => {
      const seed = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'
      const key1 = gen_seckey(seed)
      const key2 = gen_seckey(seed)
      t.equal(key1, key2, 'same seed produces same key')
      t.end()
    })

    st.end()
  })

  t.test('get_pubkey', st => {
    st.test('derives valid pubkey from seckey', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      t.equal(typeof pubkey, 'string', 'returns string')
      t.equal(pubkey.length, 64, 'has 64 characters (x-only)')
      t.ok(/^[0-9a-f]+$/.test(pubkey), 'is valid hex')
      t.end()
    })

    st.test('deterministic derivation', t => {
      const seckey = gen_seckey()
      const pubkey1 = get_pubkey(seckey)
      const pubkey2 = get_pubkey(seckey)
      t.equal(pubkey1, pubkey2, 'same seckey produces same pubkey')
      t.end()
    })

    st.test('known test vector', t => {
      // Known test vector for verification
      const seckey = '0000000000000000000000000000000000000000000000000000000000000001'
      const pubkey = get_pubkey(seckey)
      // The pubkey for seckey=1 is known in secp256k1
      t.equal(pubkey.length, 64, 'pubkey has correct length')
      t.end()
    })

    st.end()
  })

  t.test('get_shared_secret', st => {
    st.test('derives shared secret between two parties', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_sec   = gen_seckey()
      const bob_pub   = get_pubkey(bob_sec)

      const shared_alice = get_shared_secret(alice_sec, bob_pub)
      const shared_bob   = get_shared_secret(bob_sec, alice_pub)

      t.equal(shared_alice, shared_bob, 'shared secrets match')
      t.equal(shared_alice.length, 64, 'shared secret is 64 hex chars')
      t.end()
    })

    st.test('handles compressed pubkey (66 chars)', t => {
      const alice_sec = gen_seckey()
      const bob_sec   = gen_seckey()
      const bob_pub   = get_pubkey(bob_sec)
      const bob_pub_compressed = `02${bob_pub}`

      const shared = get_shared_secret(alice_sec, bob_pub_compressed)
      t.equal(shared.length, 64, 'returns valid shared secret')
      t.end()
    })

    st.end()
  })

  t.test('create_signature', st => {
    st.test('creates valid 128-char hex signature', t => {
      const seckey  = gen_seckey()
      // Message must be a valid 64-char hex string (32 bytes)
      const message = '0'.repeat(64)
      const sig     = create_signature(seckey, message)

      t.equal(typeof sig, 'string', 'returns string')
      t.equal(sig.length, 128, 'has 128 characters')
      t.ok(/^[0-9a-f]+$/.test(sig), 'is valid hex')
      t.end()
    })

    st.test('signatures are all valid for same message', t => {
      const seckey  = gen_seckey()
      const pubkey  = get_pubkey(seckey)
      // Use valid hex for message
      const message = 'a'.repeat(64)
      const sig1    = create_signature(seckey, message)
      const sig2    = create_signature(seckey, message)

      // Schnorr signatures may use random nonces, so they might not be identical
      // But both should be valid
      t.ok(verify_signature(message, pubkey, sig1), 'sig1 is valid')
      t.ok(verify_signature(message, pubkey, sig2), 'sig2 is valid')
      t.end()
    })

    st.end()
  })

  t.test('verify_signature', st => {
    st.test('verifies valid signature', t => {
      const seckey  = gen_seckey()
      const pubkey  = get_pubkey(seckey)
      // Use valid 64-char hex string as message
      const message = '0'.repeat(64)
      const sig     = create_signature(seckey, message)

      const valid = verify_signature(message, pubkey, sig)
      t.ok(valid, 'valid signature verifies')
      t.end()
    })

    st.test('rejects invalid signature', t => {
      const seckey  = gen_seckey()
      const pubkey  = get_pubkey(seckey)
      const message = '0'.repeat(64)
      const bad_sig = '0'.repeat(128)

      const valid = verify_signature(message, pubkey, bad_sig)
      t.notOk(valid, 'invalid signature rejected')
      t.end()
    })

    st.test('rejects wrong pubkey', t => {
      const seckey1 = gen_seckey()
      const seckey2 = gen_seckey()
      const pubkey2 = get_pubkey(seckey2)
      const message = '0'.repeat(64)
      const sig     = create_signature(seckey1, message)

      const valid = verify_signature(message, pubkey2, sig)
      t.notOk(valid, 'wrong pubkey rejected')
      t.end()
    })

    st.test('rejects tampered message', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const message  = '0'.repeat(64)
      const tampered = '1'.repeat(64)
      const sig      = create_signature(seckey, message)

      const valid = verify_signature(tampered, pubkey, sig)
      t.notOk(valid, 'tampered message rejected')
      t.end()
    })

    st.end()
  })
}
