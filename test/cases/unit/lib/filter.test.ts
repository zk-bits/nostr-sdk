import { Test } from 'tape'

import {
  match_filter,
  match_any_filter,
  match_tags,
  get_tag_filters,
  get_event_cache_key,
  process_filters,
  is_kind_regular,
  is_kind_replace,
  is_kind_ephemeral,
  is_kind_address
} from '@/lib/filter.js'

import { create_event, sign_event } from '@/lib/event.js'
import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'

function createSignedEvent (opts: { kind?: number, pubkey?: string, tags?: string[][] } = {}) {
  const seckey = gen_seckey()
  const pubkey = opts.pubkey ?? get_pubkey(seckey)
  const event  = create_event({
    content    : 'test',
    kind       : opts.kind ?? 1,
    pubkey,
    tags       : opts.tags ?? [],
    created_at : 1000000
  })
  return sign_event(event, seckey)
}

export default function filter_tests (t: Test) {
  t.test('match_filter', st => {
    st.test('matches by id', t => {
      const event = createSignedEvent()
      t.ok(match_filter(event, { ids: [event.id] }), 'matches when id in list')
      t.notOk(match_filter(event, { ids: ['nonexistent'] }), 'no match for wrong id')
      t.end()
    })

    st.test('matches by author', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = createSignedEvent({ pubkey })

      t.ok(match_filter(event, { authors: [pubkey] }), 'matches when author in list')
      t.notOk(match_filter(event, { authors: ['other'] }), 'no match for wrong author')
      t.end()
    })

    st.test('matches by kind', t => {
      const event = createSignedEvent({ kind: 1 })
      t.ok(match_filter(event, { kinds: [1] }), 'matches when kind in list')
      t.ok(match_filter(event, { kinds: [1, 2, 3] }), 'matches when kind in multi-kind list')
      t.notOk(match_filter(event, { kinds: [2] }), 'no match for wrong kind')
      t.end()
    })

    st.test('matches by tag filter', t => {
      const event = createSignedEvent({ tags: [['e', 'event123'], ['p', 'pubkey456']] })

      t.ok(match_filter(event, { '#e': ['event123'] }), 'matches e tag')
      t.ok(match_filter(event, { '#p': ['pubkey456'] }), 'matches p tag')
      t.notOk(match_filter(event, { '#e': ['wrong'] }), 'no match for wrong tag value')
      t.end()
    })

    st.test('filters by since timestamp', t => {
      const event = createSignedEvent()
      // Event created_at is 1000000

      t.ok(match_filter(event, { kinds: [1], since: 999999 }), 'matches when after since')
      t.ok(match_filter(event, { kinds: [1], since: 1000000 }), 'matches when equal to since')
      t.notOk(match_filter(event, { kinds: [1], since: 1000001 }), 'no match when before since')
      t.end()
    })

    st.test('filters by until timestamp', t => {
      const event = createSignedEvent()
      // Event created_at is 1000000

      t.ok(match_filter(event, { kinds: [1], until: 1000001 }), 'matches when before until')
      t.ok(match_filter(event, { kinds: [1], until: 1000000 }), 'matches when equal to until')
      t.notOk(match_filter(event, { kinds: [1], until: 999999 }), 'no match when after until')
      t.end()
    })

    st.test('empty filter behavior', t => {
      const event = createSignedEvent()
      // Empty filter should not match anything by default (no positive match criteria)
      t.notOk(match_filter(event, {}), 'empty filter does not match')
      t.end()
    })

    st.end()
  })

  t.test('match_any_filter', st => {
    st.test('returns true if any filter matches', t => {
      const event = createSignedEvent({ kind: 1 })
      const filters = [
        { kinds: [2] },
        { kinds: [1] },
        { kinds: [3] }
      ]

      t.ok(match_any_filter(event, filters), 'matches when one filter matches')
      t.end()
    })

    st.test('returns false if no filter matches', t => {
      const event = createSignedEvent({ kind: 1 })
      const filters = [
        { kinds: [2] },
        { kinds: [3] }
      ]

      t.notOk(match_any_filter(event, filters), 'no match when no filter matches')
      t.end()
    })

    st.test('returns false for empty filters array', t => {
      const event = createSignedEvent()
      t.notOk(match_any_filter(event, []), 'no match for empty filters')
      t.end()
    })

    st.end()
  })

  t.test('match_tags', st => {
    st.test('matches tag by key and value', t => {
      const tags    = [['e', 'abc'], ['p', 'def']]
      const filters = [['e', 'abc']] as [string, string][]

      t.ok(match_tags(filters, tags), 'matches when tag present')
      t.end()
    })

    st.test('returns false for non-matching value', t => {
      const tags    = [['e', 'abc']]
      const filters = [['e', 'xyz']] as [string, string][]

      t.notOk(match_tags(filters, tags), 'no match for wrong value')
      t.end()
    })

    st.test('returns false for non-matching key', t => {
      const tags    = [['e', 'abc']]
      const filters = [['p', 'abc']] as [string, string][]

      t.notOk(match_tags(filters, tags), 'no match for wrong key')
      t.end()
    })

    st.test('returns false for empty tags', t => {
      const tags: string[][] = []
      const filters = [['e', 'abc']] as [string, string][]

      t.notOk(match_tags(filters, tags), 'no match for empty tags')
      t.end()
    })

    st.test('returns false for empty filters', t => {
      const tags    = [['e', 'abc']]
      const filters: [string, string][] = []

      t.notOk(match_tags(filters, tags), 'no match for empty filters')
      t.end()
    })

    st.end()
  })

  t.test('get_tag_filters', st => {
    st.test('extracts tag filters from filter object', t => {
      const filter = { '#e': ['event1'], '#p': ['pubkey1'], kinds: [1] }
      const tags   = get_tag_filters(filter)

      t.ok(tags.some(([k, v]) => k === 'e' && v === 'event1'), 'extracts e tag')
      t.ok(tags.some(([k, v]) => k === 'p' && v === 'pubkey1'), 'extracts p tag')
      t.end()
    })

    st.test('returns empty array for no tag filters', t => {
      const filter = { kinds: [1], authors: ['abc'] }
      const tags   = get_tag_filters(filter)

      t.deepEqual(tags, [], 'no tag filters')
      t.end()
    })

    st.test('ignores empty tag arrays', t => {
      const filter = { '#e': [], '#p': ['pubkey1'] }
      const tags   = get_tag_filters(filter)

      t.equal(tags.length, 1, 'ignores empty array')
      t.end()
    })

    st.end()
  })

  t.test('process_filters', st => {
    st.test('filters events by multiple filters', t => {
      const event1 = createSignedEvent({ kind: 1 })
      const event2 = createSignedEvent({ kind: 2 })
      const event3 = createSignedEvent({ kind: 3 })
      const events = [event1, event2, event3]

      const results = process_filters(events, [{ kinds: [1] }, { kinds: [3] }])
      t.equal(results.length, 2, 'returns matching events')
      t.ok(results.includes(event1), 'includes kind 1')
      t.ok(results.includes(event3), 'includes kind 3')
      t.end()
    })

    st.test('respects limit per filter', t => {
      const events = Array.from({ length: 10 }, () => createSignedEvent({ kind: 1 }))
      const results = process_filters(events, [{ kinds: [1], limit: 3 }])

      t.equal(results.length, 3, 'respects limit')
      t.end()
    })

    st.test('returns empty for no matches', t => {
      const event = createSignedEvent({ kind: 1 })
      const results = process_filters([event], [{ kinds: [2] }])

      t.deepEqual(results, [], 'no matches returns empty array')
      t.end()
    })

    st.end()
  })

  t.test('get_event_cache_key', st => {
    st.test('returns event id for regular events', t => {
      const event = createSignedEvent({ kind: 1 })
      const key   = get_event_cache_key(event)

      t.equal(key, event.id, 'uses event id')
      t.end()
    })

    st.test('returns pubkey:kind for replaceable events (kind 0)', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({ content: '', kind: 0, pubkey }),
        seckey
      )
      const key = get_event_cache_key(event)

      t.equal(key, `${pubkey}:0`, 'uses pubkey:kind format')
      t.end()
    })

    st.test('returns pubkey:kind for replaceable events (kind 10000-19999)', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({ content: '', kind: 10000, pubkey }),
        seckey
      )
      const key = get_event_cache_key(event)

      t.equal(key, `${pubkey}:10000`, 'uses pubkey:kind format')
      t.end()
    })

    st.test('returns null for ephemeral events (kind 20000-29999)', t => {
      const event = createSignedEvent({ kind: 20000 })
      const key   = get_event_cache_key(event)

      t.equal(key, null, 'returns null for ephemeral')
      t.end()
    })

    st.test('returns pubkey:kind:d for addressable events (kind 30000-39999)', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({ content: '', kind: 30000, pubkey, tags: [['d', 'identifier']] }),
        seckey
      )
      const key = get_event_cache_key(event)

      t.equal(key, `${pubkey}:30000:identifier`, 'uses pubkey:kind:d format')
      t.end()
    })

    st.test('handles missing d tag for addressable events', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({ content: '', kind: 30000, pubkey }),
        seckey
      )
      const key = get_event_cache_key(event)

      t.equal(key, `${pubkey}:30000:`, 'uses empty string for missing d tag')
      t.end()
    })

    st.end()
  })

  t.test('is_kind_regular', st => {
    st.test('returns true for kind 1', t => {
      t.ok(is_kind_regular(1), 'kind 1 is regular')
      t.end()
    })

    st.test('returns true for kind 2', t => {
      t.ok(is_kind_regular(2), 'kind 2 is regular')
      t.end()
    })

    st.test('returns true for kinds 4-44', t => {
      t.ok(is_kind_regular(4), 'kind 4 is regular')
      t.ok(is_kind_regular(44), 'kind 44 is regular')
      t.end()
    })

    st.test('returns true for kinds 1000-9999', t => {
      t.ok(is_kind_regular(1000), 'kind 1000 is regular')
      t.ok(is_kind_regular(9999), 'kind 9999 is regular')
      t.end()
    })

    st.test('returns false for kind 0', t => {
      t.notOk(is_kind_regular(0), 'kind 0 is not regular')
      t.end()
    })

    st.test('returns false for kind 3', t => {
      t.notOk(is_kind_regular(3), 'kind 3 is not regular')
      t.end()
    })

    st.end()
  })

  t.test('is_kind_replace', st => {
    st.test('returns true for kind 0', t => {
      t.ok(is_kind_replace(0), 'kind 0 is replaceable')
      t.end()
    })

    st.test('returns true for kind 3', t => {
      t.ok(is_kind_replace(3), 'kind 3 is replaceable')
      t.end()
    })

    st.test('returns true for kinds 4-44', t => {
      t.ok(is_kind_replace(4), 'kind 4 is replaceable')
      t.ok(is_kind_replace(44), 'kind 44 is replaceable')
      t.end()
    })

    st.test('returns true for kinds 10000-19999', t => {
      t.ok(is_kind_replace(10000), 'kind 10000 is replaceable')
      t.ok(is_kind_replace(19999), 'kind 19999 is replaceable')
      t.end()
    })

    st.test('returns false for kind 1', t => {
      t.notOk(is_kind_replace(1), 'kind 1 is not replaceable')
      t.end()
    })

    st.end()
  })

  t.test('is_kind_ephemeral', st => {
    st.test('returns true for kinds 20000-29999', t => {
      t.ok(is_kind_ephemeral(20000), 'kind 20000 is ephemeral')
      t.ok(is_kind_ephemeral(25000), 'kind 25000 is ephemeral')
      t.ok(is_kind_ephemeral(29999), 'kind 29999 is ephemeral')
      t.end()
    })

    st.test('returns false for kind 1', t => {
      t.notOk(is_kind_ephemeral(1), 'kind 1 is not ephemeral')
      t.end()
    })

    st.test('returns false for kind 30000', t => {
      t.notOk(is_kind_ephemeral(30000), 'kind 30000 is not ephemeral')
      t.end()
    })

    st.end()
  })

  t.test('is_kind_address', st => {
    st.test('returns true for kinds 30000-39999', t => {
      t.ok(is_kind_address(30000), 'kind 30000 is addressable')
      t.ok(is_kind_address(35000), 'kind 35000 is addressable')
      t.ok(is_kind_address(39999), 'kind 39999 is addressable')
      t.end()
    })

    st.test('returns false for kind 1', t => {
      t.notOk(is_kind_address(1), 'kind 1 is not addressable')
      t.end()
    })

    st.test('returns false for kind 29999', t => {
      t.notOk(is_kind_address(29999), 'kind 29999 is not addressable')
      t.end()
    })

    st.end()
  })
}
