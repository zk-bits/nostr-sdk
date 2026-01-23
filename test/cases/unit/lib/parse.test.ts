import { Test } from 'tape'
import { z }    from 'zod'

import { parse_content, parse_event, parse_query } from '@/lib/parse.js'
import { create_event, sign_event }                from '@/lib/event.js'
import { gen_seckey, get_pubkey }                  from '@/crypto/ecc.js'

import type { QueryResponse } from '@/types/index.js'

export default function parse_tests (t: Test) {
  t.test('parse_content', st => {
    st.test('parses valid JSON', t => {
      const content = JSON.stringify({ foo: 'bar', num: 42 })
      const result  = parse_content(content)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result, { foo: 'bar', num: 42 }, 'correct data')
      t.end()
    })

    st.test('returns error for invalid JSON', t => {
      const content = 'not valid json'
      const result  = parse_content(content)

      t.notOk(result.ok, 'parsing failed')
      t.equal(result.result, null, 'result is null')
      t.ok(typeof result.error === 'string', 'has error message')
      t.end()
    })

    st.test('validates with schema when provided', t => {
      const schema  = z.object({ name: z.string(), age: z.number() })
      const content = JSON.stringify({ name: 'Alice', age: 30 })
      const result  = parse_content(content, schema)

      t.ok(result.ok, 'schema validation passed')
      t.deepEqual(result.result, { name: 'Alice', age: 30 }, 'correct data')
      t.end()
    })

    st.test('returns error when schema validation fails', t => {
      const schema  = z.object({ name: z.string(), age: z.number() })
      const content = JSON.stringify({ name: 'Alice', age: 'thirty' })
      const result  = parse_content(content, schema)

      t.notOk(result.ok, 'schema validation failed')
      t.equal(result.result, null, 'result is null')
      t.end()
    })

    st.test('handles empty object', t => {
      const content = JSON.stringify({})
      const result  = parse_content(content)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result, {}, 'correct empty object')
      t.end()
    })

    st.test('handles array content', t => {
      const content = JSON.stringify([1, 2, 3])
      const result  = parse_content(content)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result, [1, 2, 3], 'correct array')
      t.end()
    })

    st.test('handles primitive values', t => {
      t.deepEqual(parse_content('"hello"').result, 'hello', 'string')
      t.deepEqual(parse_content('42').result, 42, 'number')
      t.deepEqual(parse_content('true').result, true, 'boolean')
      t.deepEqual(parse_content('null').result, null, 'null')
      t.end()
    })

    st.end()
  })

  t.test('parse_event', st => {
    st.test('parses event content as JSON', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content : JSON.stringify({ message: 'hello' }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const result = parse_event(event)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result?.data, { message: 'hello' }, 'correct data')
      t.equal(result.result?.id, event.id, 'preserves event id')
      t.end()
    })

    st.test('returns error for invalid JSON content', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content : 'not json',
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const result = parse_event(event)

      t.notOk(result.ok, 'parsing failed')
      t.equal(result.result, null, 'result is null')
      t.end()
    })

    st.test('validates with schema when provided', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const schema = z.object({ type: z.string() })
      const event  = sign_event(
        create_event({
          content : JSON.stringify({ type: 'note' }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const result = parse_event(event, schema)

      t.ok(result.ok, 'schema validation passed')
      t.deepEqual(result.result?.data, { type: 'note' }, 'correct data')
      t.end()
    })

    st.test('returns error when schema validation fails', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const schema = z.object({ type: z.number() })
      const event  = sign_event(
        create_event({
          content : JSON.stringify({ type: 'note' }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const result = parse_event(event, schema)

      t.notOk(result.ok, 'schema validation failed')
      t.end()
    })

    st.test('preserves all event fields', t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content    : JSON.stringify({ x: 1 }),
          kind       : 1,
          pubkey,
          tags       : [['t', 'test']],
          created_at : 12345
        }),
        seckey
      )

      const result = parse_event(event)

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.kind, 1, 'preserves kind')
      t.equal(result.result?.pubkey, pubkey, 'preserves pubkey')
      t.equal(result.result?.created_at, 12345, 'preserves created_at')
      t.deepEqual(result.result?.tags, [['t', 'test']], 'preserves tags')
      t.end()
    })

    st.end()
  })

  t.test('parse_query', st => {
    st.test('resolves with parsed events on success', async t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content : JSON.stringify({ message: 'hello' }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const queryResponse: QueryResponse = {
        ok     : true,
        events : [event]
      }

      const result = await parse_query(Promise.resolve(queryResponse))

      t.equal(result.length, 1, 'returns one event')
      t.deepEqual(result[0].data, { message: 'hello' }, 'parsed content')
      t.equal(result[0].id, event.id, 'preserves event id')
      t.end()
    })

    st.test('throws when query fails (res.ok = false)', async t => {
      const queryResponse: QueryResponse = {
        ok     : false,
        reason : 'connection failed'
      }

      try {
        await parse_query(Promise.resolve(queryResponse))
        t.fail('should have thrown')
      } catch (err) {
        t.equal(err, 'connection failed', 'throws the reason')
      }
      t.end()
    })

    st.test('throws when no events found', async t => {
      const queryResponse: QueryResponse = {
        ok     : true,
        events : []
      }

      try {
        await parse_query(Promise.resolve(queryResponse))
        t.fail('should have thrown')
      } catch (err) {
        t.ok((err as Error).message.includes('no events found'), 'throws no events error')
      }
      t.end()
    })

    st.test('throws when all events fail validation', async t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const event  = sign_event(
        create_event({
          content : 'not valid json',
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const queryResponse: QueryResponse = {
        ok     : true,
        events : [event]
      }

      try {
        await parse_query(Promise.resolve(queryResponse))
        t.fail('should have thrown')
      } catch (err) {
        t.ok((err as Error).message.includes('all events failed validation'), 'throws validation error')
      }
      t.end()
    })

    st.test('filters out invalid events, keeps valid ones', async t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)

      const validEvent = sign_event(
        create_event({
          content : JSON.stringify({ valid: true }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const invalidEvent = sign_event(
        create_event({
          content : 'not json',
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const queryResponse: QueryResponse = {
        ok     : true,
        events : [invalidEvent, validEvent]
      }

      const result = await parse_query(Promise.resolve(queryResponse))

      t.equal(result.length, 1, 'returns only valid event')
      t.deepEqual(result[0].data, { valid: true }, 'contains valid event data')
      t.end()
    })

    st.test('applies schema validation to each event', async t => {
      const seckey = gen_seckey()
      const pubkey = get_pubkey(seckey)
      const schema = z.object({ type: z.string() })

      const validEvent = sign_event(
        create_event({
          content : JSON.stringify({ type: 'note' }),
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const invalidSchemaEvent = sign_event(
        create_event({
          content : JSON.stringify({ type: 123 }), // wrong type
          kind    : 1,
          pubkey
        }),
        seckey
      )

      const queryResponse: QueryResponse = {
        ok     : true,
        events : [invalidSchemaEvent, validEvent]
      }

      const result = await parse_query(Promise.resolve(queryResponse), schema)

      t.equal(result.length, 1, 'returns only schema-valid event')
      t.deepEqual(result[0].data, { type: 'note' }, 'contains schema-valid data')
      t.end()
    })

    st.end()
  })
}
