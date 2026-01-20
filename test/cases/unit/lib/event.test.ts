import { Test } from 'tape'

import {
  create_event,
  get_event_id,
  sign_event,
  verify_event,
  get_event_tag,
  filter_event_tags,
  is_event_recipient,
  is_event_expired
} from '@/lib/event.js'

import { gen_seckey, get_pubkey } from '@/crypto/ecc.js'
import { now } from '@/lib/util.js'

export default function event_tests (t: Test) {
  t.test('create_event', st => {
    st.test('creates event with required fields', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })

      t.equal(event.content, 'test', 'has content')
      t.equal(event.kind, 1, 'has kind')
      t.equal(event.pubkey, pubkey, 'has pubkey')
      t.ok(typeof event.created_at === 'number', 'has created_at')
      t.ok(Array.isArray(event.tags), 'has tags array')
      t.end()
    })

    st.test('uses provided created_at', t => {
      const pubkey = get_pubkey(gen_seckey())
      const ts     = 1234567890
      const event  = create_event({
        content    : 'test',
        kind       : 1,
        pubkey,
        created_at : ts
      })

      t.equal(event.created_at, ts, 'uses provided timestamp')
      t.end()
    })

    st.test('defaults created_at to now', t => {
      const pubkey = get_pubkey(gen_seckey())
      const before = now()
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })
      const after = now()

      t.ok(event.created_at >= before, 'created_at >= before')
      t.ok(event.created_at <= after, 'created_at <= after')
      t.end()
    })

    st.test('preserves tags', t => {
      const pubkey = get_pubkey(gen_seckey())
      const tags   = [['e', 'abc'], ['p', 'def']]
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags
      })

      t.deepEqual(event.tags, tags, 'preserves provided tags')
      t.end()
    })

    st.test('defaults tags to empty array', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })

      t.deepEqual(event.tags, [], 'defaults to empty tags')
      t.end()
    })

    st.end()
  })

  t.test('get_event_id', st => {
    st.test('returns 64-char hex string', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })

      const id = get_event_id(event)
      t.equal(typeof id, 'string', 'returns string')
      t.equal(id.length, 64, 'has 64 characters')
      t.ok(/^[0-9a-f]+$/.test(id), 'is valid hex')
      t.end()
    })

    st.test('deterministic for same event', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content    : 'test',
        kind       : 1,
        pubkey,
        created_at : 1234567890
      })

      const id1 = get_event_id(event)
      const id2 = get_event_id(event)
      t.equal(id1, id2, 'same event produces same id')
      t.end()
    })

    st.test('different events produce different ids', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event1 = create_event({
        content    : 'test1',
        kind       : 1,
        pubkey,
        created_at : 1234567890
      })
      const event2 = create_event({
        content    : 'test2',
        kind       : 1,
        pubkey,
        created_at : 1234567890
      })

      t.notEqual(get_event_id(event1), get_event_id(event2), 'different content = different id')
      t.end()
    })

    st.end()
  })

  t.test('sign_event', st => {
    st.test('returns signed event with id and sig', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })

      const signed = sign_event(template, seckey)
      t.ok(signed.id, 'has id')
      t.ok(signed.sig, 'has sig')
      t.equal(signed.id.length, 64, 'id is 64 chars')
      t.equal(signed.sig.length, 128, 'sig is 128 chars')
      t.end()
    })

    st.test('preserves template properties', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content    : 'test content',
        kind       : 1,
        pubkey,
        created_at : 12345,
        tags       : [['e', 'abc']]
      })

      const signed = sign_event(template, seckey)
      t.equal(signed.content, template.content, 'preserves content')
      t.equal(signed.kind, template.kind, 'preserves kind')
      t.equal(signed.pubkey, template.pubkey, 'preserves pubkey')
      t.equal(signed.created_at, template.created_at, 'preserves created_at')
      t.deepEqual(signed.tags, template.tags, 'preserves tags')
      t.end()
    })

    st.end()
  })

  t.test('verify_event', st => {
    st.test('returns null for valid event', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })
      const signed = sign_event(template, seckey)

      const result = verify_event(signed)
      t.equal(result, null, 'valid event returns null')
      t.end()
    })

    st.test('returns error for tampered content', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })
      const signed   = sign_event(template, seckey)
      const tampered = { ...signed, content: 'tampered' }

      const result = verify_event(tampered)
      t.ok(result !== null, 'tampered event returns error')
      t.end()
    })

    st.test('returns error for invalid signature', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })
      const signed  = sign_event(template, seckey)
      const invalid = { ...signed, sig: '0'.repeat(128) }

      const result = verify_event(invalid)
      t.ok(result !== null, 'invalid signature returns error')
      t.end()
    })

    st.test('returns error for wrong pubkey', t => {
      const seckey1  = gen_seckey()
      const seckey2  = gen_seckey()
      const pubkey1  = get_pubkey(seckey1)
      const pubkey2  = get_pubkey(seckey2)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey  : pubkey1
      })
      const signed = sign_event(template, seckey1)
      const wrong  = { ...signed, pubkey: pubkey2 }

      const result = verify_event(wrong)
      t.ok(result !== null, 'wrong pubkey returns error')
      t.end()
    })

    st.end()
  })

  t.test('get_event_tag', st => {
    st.test('returns first matching tag', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['e', 'event1'], ['p', 'pubkey1'], ['e', 'event2']]
      })

      const tag = get_event_tag(event, 'e')
      t.deepEqual(tag, ['e', 'event1'], 'returns first e tag')
      t.end()
    })

    st.test('returns undefined for missing tag', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['e', 'event1']]
      })

      const tag = get_event_tag(event, 'p')
      t.equal(tag, undefined, 'returns undefined for missing tag')
      t.end()
    })

    st.test('returns undefined for empty tags', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : []
      })

      const tag = get_event_tag(event, 'e')
      t.equal(tag, undefined, 'returns undefined for empty tags')
      t.end()
    })

    st.end()
  })

  t.test('filter_event_tags', st => {
    st.test('returns all matching tags', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['e', 'event1'], ['p', 'pubkey1'], ['e', 'event2']]
      })

      const tags = filter_event_tags(event, 'e')
      t.deepEqual(tags, [['e', 'event1'], ['e', 'event2']], 'returns all e tags')
      t.end()
    })

    st.test('returns empty array for no matches', t => {
      const pubkey = get_pubkey(gen_seckey())
      const event  = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['e', 'event1']]
      })

      const tags = filter_event_tags(event, 'p')
      t.deepEqual(tags, [], 'returns empty array for no matches')
      t.end()
    })

    st.end()
  })

  t.test('is_event_recipient', st => {
    st.test('returns true when pubkey in p tags', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const target   = get_pubkey(gen_seckey())
      const template = create_event({
        content : 'test',
        kind    : 4,
        pubkey,
        tags    : [['p', target]]
      })
      const signed = sign_event(template, seckey)

      t.ok(is_event_recipient(signed, target), 'returns true for recipient')
      t.end()
    })

    st.test('returns false when pubkey not in p tags', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const other    = get_pubkey(gen_seckey())
      const template = create_event({
        content : 'test',
        kind    : 4,
        pubkey,
        tags    : [['p', get_pubkey(gen_seckey())]]
      })
      const signed = sign_event(template, seckey)

      t.notOk(is_event_recipient(signed, other), 'returns false for non-recipient')
      t.end()
    })

    st.end()
  })

  t.test('is_event_expired', st => {
    st.test('returns false when no expiration tag', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey
      })
      const signed = sign_event(template, seckey)

      t.notOk(is_event_expired(signed), 'no expiration tag = not expired')
      t.end()
    })

    st.test('returns false when expiration is in future', t => {
      const seckey     = gen_seckey()
      const pubkey     = get_pubkey(seckey)
      const futureTime = now() + 3600 // 1 hour from now
      const template   = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['expiration', String(futureTime)]]
      })
      const signed = sign_event(template, seckey)

      t.notOk(is_event_expired(signed), 'future expiration = not expired')
      t.end()
    })

    st.test('returns true when expiration is in past', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const pastTime = now() - 3600 // 1 hour ago
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['expiration', String(pastTime)]]
      })
      const signed = sign_event(template, seckey)

      t.ok(is_event_expired(signed), 'past expiration = expired')
      t.end()
    })

    st.test('returns false for invalid expiration value', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['expiration', 'invalid']]
      })
      const signed = sign_event(template, seckey)

      t.notOk(is_event_expired(signed), 'invalid expiration = not expired')
      t.end()
    })

    st.test('uses custom current time', t => {
      const seckey   = gen_seckey()
      const pubkey   = get_pubkey(seckey)
      const expires  = 1000000
      const template = create_event({
        content : 'test',
        kind    : 1,
        pubkey,
        tags    : [['expiration', String(expires)]]
      })
      const signed = sign_event(template, seckey)

      t.notOk(is_event_expired(signed, 500000), 'before expiration = not expired')
      t.ok(is_event_expired(signed, 1500000), 'after expiration = expired')
      t.end()
    })

    st.end()
  })
}
