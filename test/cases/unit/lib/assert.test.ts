import { Test } from 'tape'

import {
  assert_ok,
  assert_exists,
  assert_base64
} from '@/lib/assert.js'

export default function assert_tests (t: Test) {
  t.test('assert_ok', st => {
    st.test('passes for true', t => {
      t.doesNotThrow(() => assert_ok(true), 'true passes')
      t.end()
    })

    st.test('passes for truthy values', t => {
      t.doesNotThrow(() => assert_ok(1), 'number 1 passes')
      t.doesNotThrow(() => assert_ok('hello'), 'non-empty string passes')
      t.doesNotThrow(() => assert_ok({}), 'empty object passes')
      t.doesNotThrow(() => assert_ok([]), 'empty array passes')
      t.end()
    })

    st.test('throws for false', t => {
      t.throws(
        () => assert_ok(false),
        /Assertion failed/,
        'false throws default message'
      )
      t.end()
    })

    st.test('throws with custom message', t => {
      t.throws(
        () => assert_ok(false, 'custom error'),
        /custom error/,
        'uses custom message'
      )
      t.end()
    })

    st.test('throws for falsy values', t => {
      t.throws(() => assert_ok(0), /Assertion failed/, '0 throws')
      t.throws(() => assert_ok(null), /Assertion failed/, 'null throws')
      t.throws(() => assert_ok(undefined), /Assertion failed/, 'undefined throws')
      t.end()
    })

    st.test('throws for empty string', t => {
      t.throws(() => assert_ok(''), /Assertion failed/, 'empty string throws')
      t.end()
    })

    st.end()
  })

  t.test('assert_exists', st => {
    st.test('passes for defined values', t => {
      t.doesNotThrow(() => assert_exists(0), '0 passes')
      t.doesNotThrow(() => assert_exists(''), 'empty string passes')
      t.doesNotThrow(() => assert_exists(false), 'false passes')
      t.doesNotThrow(() => assert_exists({}), 'object passes')
      t.end()
    })

    st.test('throws for null', t => {
      t.throws(
        () => assert_exists(null),
        /null or undefined/,
        'null throws'
      )
      t.end()
    })

    st.test('throws for undefined', t => {
      t.throws(
        () => assert_exists(undefined),
        /null or undefined/,
        'undefined throws'
      )
      t.end()
    })

    st.test('throws with custom message', t => {
      t.throws(
        () => assert_exists(null, 'value required'),
        /value required/,
        'uses custom message'
      )
      t.end()
    })

    st.test('narrows type correctly', t => {
      const maybeString: string | undefined = 'hello'
      assert_exists(maybeString)
      // TypeScript should now know maybeString is string
      t.equal(maybeString.toUpperCase(), 'HELLO', 'type narrowed correctly')
      t.end()
    })

    st.end()
  })

  t.test('assert_base64', st => {
    st.test('passes for valid base64', t => {
      t.doesNotThrow(() => assert_base64('aGVsbG8='), 'valid base64 passes')
      t.doesNotThrow(() => assert_base64('YWJj'), 'no padding passes')
      t.doesNotThrow(() => assert_base64('YWI='), 'single padding passes')
      t.doesNotThrow(() => assert_base64('YQ=='), 'double padding passes')
      t.end()
    })

    st.test('passes for empty string', t => {
      // Empty string is technically valid base64 (encodes empty data)
      // But the regex requires at least one character before optional padding
      t.throws(() => assert_base64(''), /not a valid base64/, 'empty string fails')
      t.end()
    })

    st.test('throws for non-string', t => {
      t.throws(
        () => assert_base64(123 as any),
        /not a string/,
        'number throws'
      )
      t.throws(
        () => assert_base64(null as any),
        /not a string/,
        'null throws'
      )
      t.throws(
        () => assert_base64(undefined as any),
        /not a string/,
        'undefined throws'
      )
      t.end()
    })

    st.test('throws for invalid base64 characters', t => {
      t.throws(
        () => assert_base64('hello!'),
        /not a valid base64/,
        '! is invalid'
      )
      t.throws(
        () => assert_base64('hello world'),
        /not a valid base64/,
        'space is invalid'
      )
      t.throws(
        () => assert_base64('hello@world'),
        /not a valid base64/,
        '@ is invalid'
      )
      t.end()
    })

    st.test('throws for invalid padding', t => {
      t.throws(
        () => assert_base64('YWJj==='),
        /not a valid base64/,
        'triple padding invalid'
      )
      t.throws(
        () => assert_base64('=YWJj'),
        /not a valid base64/,
        'leading padding invalid'
      )
      t.end()
    })

    st.test('accepts uppercase and lowercase', t => {
      t.doesNotThrow(() => assert_base64('ABCD'), 'uppercase passes')
      t.doesNotThrow(() => assert_base64('abcd'), 'lowercase passes')
      t.doesNotThrow(() => assert_base64('AbCd'), 'mixed case passes')
      t.end()
    })

    st.test('accepts + and / characters', t => {
      t.doesNotThrow(() => assert_base64('a+b/c='), 'special chars pass')
      t.end()
    })

    st.end()
  })
}
