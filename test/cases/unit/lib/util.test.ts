import { Test } from 'tape'

import {
  generate_hash,
  generate_label,
  exec,
  now,
  parse_error,
  sleep
} from '@/lib/util.js'

export default function util_tests (t: Test) {
  t.test('generate_hash', st => {
    st.test('generates 64-char hex string by default', t => {
      const hash = generate_hash()
      t.equal(typeof hash, 'string', 'returns string')
      t.equal(hash.length, 64, 'default 32 bytes = 64 hex chars')
      t.ok(/^[0-9a-f]+$/.test(hash), 'is valid hex')
      t.end()
    })

    st.test('generates custom size', t => {
      const hash16 = generate_hash(16)
      const hash8  = generate_hash(8)

      t.equal(hash16.length, 32, '16 bytes = 32 hex chars')
      t.equal(hash8.length, 16, '8 bytes = 16 hex chars')
      t.end()
    })

    st.test('generates unique hashes', t => {
      const hash1 = generate_hash()
      const hash2 = generate_hash()
      t.notEqual(hash1, hash2, 'different hashes generated')
      t.end()
    })

    st.end()
  })

  t.test('generate_label', st => {
    st.test('generates URL-safe string', t => {
      const label = generate_label()
      t.equal(typeof label, 'string', 'returns string')
      t.ok(label.length > 0, 'non-empty')
      // URL-safe base64 uses A-Za-z0-9_-
      t.ok(/^[A-Za-z0-9_-]+$/.test(label), 'is URL-safe')
      t.end()
    })

    st.test('generates custom size', t => {
      const label8  = generate_label(8)
      const label32 = generate_label(32)

      t.ok(label8.length > 0, '8 bytes produces non-empty')
      t.ok(label32.length > label8.length, '32 bytes produces longer string')
      t.end()
    })

    st.test('generates unique labels', t => {
      const label1 = generate_label()
      const label2 = generate_label()
      t.notEqual(label1, label2, 'different labels generated')
      t.end()
    })

    st.end()
  })

  t.test('exec', st => {
    st.test('returns success result for successful function', t => {
      const result = exec(() => 42)
      t.ok(result.ok, 'ok is true')
      t.equal(result.result, 42, 'result is return value')
      t.equal(result.error, null, 'error is null')
      t.end()
    })

    st.test('returns failure result for throwing function', t => {
      const result = exec(() => { throw new Error('test error') })
      t.notOk(result.ok, 'ok is false')
      t.equal(result.result, null, 'result is null')
      t.equal(result.error, 'test error', 'error contains message')
      t.end()
    })

    st.test('handles non-Error throws', t => {
      const result = exec(() => { throw 'string error' })
      t.notOk(result.ok, 'ok is false')
      t.equal(result.error, 'string error', 'error is stringified')
      t.end()
    })

    st.test('preserves return type', t => {
      const result = exec(() => ({ foo: 'bar' }))
      t.deepEqual(result.result, { foo: 'bar' }, 'complex object returned')
      t.end()
    })

    st.end()
  })

  t.test('now', st => {
    st.test('returns Unix timestamp in seconds', t => {
      const timestamp = now()
      t.equal(typeof timestamp, 'number', 'returns number')
      t.ok(Number.isInteger(timestamp), 'is integer')
      // Should be reasonable (after year 2020, before year 2100)
      t.ok(timestamp > 1577836800, 'after 2020')
      t.ok(timestamp < 4102444800, 'before 2100')
      t.end()
    })

    st.test('matches Date.now() / 1000', t => {
      const before = Math.floor(Date.now() / 1000)
      const result = now()
      const after  = Math.floor(Date.now() / 1000)

      t.ok(result >= before, 'result >= before')
      t.ok(result <= after, 'result <= after')
      t.end()
    })

    st.end()
  })

  t.test('parse_error', st => {
    st.test('extracts message from Error object', t => {
      const error  = new Error('test message')
      const result = parse_error(error)
      t.equal(result, 'test message', 'extracts error message')
      t.end()
    })

    st.test('converts string to itself', t => {
      const result = parse_error('string error')
      t.equal(result, 'string error', 'string passes through')
      t.end()
    })

    st.test('converts number to string', t => {
      const result = parse_error(42)
      t.equal(result, '42', 'number converted to string')
      t.end()
    })

    st.test('converts object to string', t => {
      const result = parse_error({ foo: 'bar' })
      t.equal(result, '[object Object]', 'object converted to string')
      t.end()
    })

    st.test('handles null', t => {
      const result = parse_error(null)
      t.equal(result, 'null', 'null converted to string')
      t.end()
    })

    st.test('handles undefined', t => {
      const result = parse_error(undefined)
      t.equal(result, 'undefined', 'undefined converted to string')
      t.end()
    })

    st.end()
  })

  t.test('sleep', st => {
    st.test('returns promise that resolves after delay', async t => {
      const start = Date.now()
      await sleep(50)
      const elapsed = Date.now() - start

      t.ok(elapsed >= 45, 'waited at least ~50ms')
      t.ok(elapsed < 150, 'did not wait too long')
      t.end()
    })

    st.test('resolves with undefined', async t => {
      const result = await sleep(10)
      t.equal(result, undefined, 'resolves with undefined')
      t.end()
    })

    st.test('handles zero delay', async t => {
      const start = Date.now()
      await sleep(0)
      const elapsed = Date.now() - start

      t.ok(elapsed < 50, 'zero delay resolves quickly')
      t.end()
    })

    st.end()
  })
}
