import { Test } from 'tape'

import { KeyCache, EventCache } from '@/class/cache.js'
import { createTestEvent }      from '#/helpers/index.js'
import { create_event, sign_event } from '@/lib/event.js'
import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { now } from '@/lib/util.js'

export default function cache_tests (t: Test) {
  t.test('KeyCache', st => {
    st.test('constructor throws for invalid limit', t => {
      t.throws(() => new KeyCache(0), /invalid cache limit/, 'zero throws')
      t.throws(() => new KeyCache(-1), /invalid cache limit/, 'negative throws')
      t.throws(() => new KeyCache(Infinity), /invalid cache limit/, 'infinity throws')
      t.throws(() => new KeyCache(NaN), /invalid cache limit/, 'NaN throws')
      t.end()
    })

    st.test('constructor accepts valid limit', t => {
      t.doesNotThrow(() => new KeyCache(1), 'limit 1 ok')
      t.doesNotThrow(() => new KeyCache(100), 'limit 100 ok')
      t.doesNotThrow(() => new KeyCache(1000000), 'large limit ok')
      t.end()
    })

    st.test('add - stores key', t => {
      const cache = new KeyCache(10)
      cache.add('key1')
      t.ok(cache.has('key1'), 'key stored')
      t.end()
    })

    st.test('add - handles duplicate keys', t => {
      const cache = new KeyCache(10)
      cache.add('key1')
      cache.add('key1')
      t.ok(cache.has('key1'), 'key still present')
      t.end()
    })

    st.test('has - returns false for missing key', t => {
      const cache = new KeyCache(10)
      t.notOk(cache.has('nonexistent'), 'missing key returns false')
      t.end()
    })

    st.test('FIFO eviction when at capacity', t => {
      // The cache evicts when size >= limit, so with limit 3:
      // After adding 'a', 'b', 'c' (size=3), adding 'd' triggers eviction
      const cache = new KeyCache(3)
      cache.add('a')
      cache.add('b')
      cache.add('c') // size=3, triggers eviction of 'a'

      // The eviction happens when size >= limit, so 'a' is evicted before 'd' is even added
      t.notOk(cache.has('a'), 'oldest key evicted on reaching limit')
      t.ok(cache.has('b'), 'b still present')
      t.ok(cache.has('c'), 'c added')
      t.end()
    })

    st.test('clear - removes all keys', t => {
      const cache = new KeyCache(10)
      cache.add('a')
      cache.add('b')
      cache.add('c')
      cache.clear()

      t.notOk(cache.has('a'), 'a removed')
      t.notOk(cache.has('b'), 'b removed')
      t.notOk(cache.has('c'), 'c removed')
      t.end()
    })

    st.end()
  })

  t.test('EventCache', st => {
    st.test('add - stores regular events', t => {
      const cache = new EventCache()
      const event = createTestEvent({ kind: 1 })

      cache.add(event)
      t.ok(cache.cache.has(event.id), 'event stored by id')
      t.end()
    })

    st.test('add - stores replaceable events by pubkey:kind', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({ content: '', kind: 0, pubkey }),
        seckey
      )
      const cache = new EventCache()

      cache.add(event)
      t.ok(cache.cache.has(`${pubkey}:0`), 'replaceable event stored by pubkey:kind')
      t.end()
    })

    st.test('add - does not store ephemeral events', t => {
      const event = createTestEvent({ kind: 20000 })
      const cache = new EventCache()

      cache.add(event)
      t.equal(cache.events.length, 0, 'ephemeral event not stored')
      t.end()
    })

    st.test('add - stores addressable events by pubkey:kind:d', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content : '',
          kind    : 30000,
          pubkey,
          tags    : [['d', 'my-id']]
        }),
        seckey
      )
      const cache = new EventCache()

      cache.add(event)
      t.ok(cache.cache.has(`${pubkey}:30000:my-id`), 'addressable event stored')
      t.end()
    })

    st.test('events - returns array of all events', t => {
      const cache  = new EventCache()
      const event1 = createTestEvent({ content: 'one' })
      const event2 = createTestEvent({ content: 'two' })

      cache.add(event1)
      cache.add(event2)

      t.equal(cache.events.length, 2, 'returns all events')
      t.end()
    })

    st.test('delete - removes event from cache', t => {
      const cache = new EventCache()
      const event = createTestEvent({ kind: 1 })

      cache.add(event)
      cache.delete(event)

      t.notOk(cache.cache.has(event.id), 'event removed')
      t.end()
    })

    st.test('clear - removes all events', t => {
      const cache = new EventCache()
      cache.add(createTestEvent())
      cache.add(createTestEvent())
      cache.add(createTestEvent())

      cache.clear()
      t.equal(cache.events.length, 0, 'all events cleared')
      t.end()
    })

    st.test('filter - returns matching events', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const cache  = new EventCache()

      const event1 = sign_event(
        create_event({ content: 'a', kind: 1, pubkey, created_at: 1000 }),
        seckey
      )
      const event2 = sign_event(
        create_event({ content: 'b', kind: 2, pubkey, created_at: 1000 }),
        seckey
      )
      cache.add(event1)
      cache.add(event2)

      const results = cache.filter([{ kinds: [1] }])
      t.equal(results.length, 1, 'returns matching event')
      t.equal(results[0].content, 'a', 'correct event returned')
      t.end()
    })

    st.test('filter - handles multiple filters', t => {
      const cache = new EventCache()
      const event1 = createTestEvent({ kind: 1 })
      const event2 = createTestEvent({ kind: 2 })
      cache.add(event1)
      cache.add(event2)

      const results = cache.filter([{ kinds: [1] }, { kinds: [2] }])
      t.equal(results.length, 2, 'returns events from both filters')
      t.end()
    })

    st.test('prune - removes expired events', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const cache  = new EventCache()

      const expired = sign_event(
        create_event({
          content : 'expired',
          kind    : 1,
          pubkey,
          tags    : [['expiration', '1000']]
        }),
        seckey
      )
      const valid = sign_event(
        create_event({
          content : 'valid',
          kind    : 1,
          pubkey,
          tags    : [['expiration', String(now() + 3600)]]
        }),
        seckey
      )

      cache.add(expired)
      cache.add(valid)
      cache.prune()

      t.equal(cache.events.length, 1, 'one event remaining')
      t.equal(cache.events[0].content, 'valid', 'valid event remains')
      t.end()
    })

    st.test('prune - accepts custom timestamp', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const cache  = new EventCache()

      const event = sign_event(
        create_event({
          content : 'test',
          kind    : 1,
          pubkey,
          tags    : [['expiration', '5000']]
        }),
        seckey
      )

      cache.add(event)
      cache.prune(4000) // Before expiration
      t.equal(cache.events.length, 1, 'event not pruned before expiration')

      cache.prune(6000) // After expiration
      t.equal(cache.events.length, 0, 'event pruned after expiration')
      t.end()
    })

    st.test('replaceable events replace older ones', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const cache  = new EventCache()

      const old = sign_event(
        create_event({ content: 'old', kind: 0, pubkey }),
        seckey
      )
      const newer = sign_event(
        create_event({ content: 'new', kind: 0, pubkey }),
        seckey
      )

      cache.add(old)
      cache.add(newer)

      t.equal(cache.events.length, 1, 'only one event')
      t.equal(cache.events[0].content, 'new', 'newer event stored')
      t.end()
    })

    st.end()
  })
}
