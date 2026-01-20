import { Test } from 'tape'

import {
  validate_client_message,
  validate_relay_message,
  parse_client_message,
  parse_relay_message
} from '@/lib/validate.js'

import { createTestEvent } from '#/helpers/index.js'

export default function validate_tests (t: Test) {
  t.test('validate_client_message', st => {
    st.test('validates EVENT message', t => {
      const event = createTestEvent()
      t.doesNotThrow(
        () => validate_client_message(['EVENT', event]),
        'valid EVENT message passes'
      )
      t.end()
    })

    st.test('validates REQ message', t => {
      t.doesNotThrow(
        () => validate_client_message(['REQ', 'sub123', { kinds: [1] }]),
        'valid REQ message passes'
      )
      t.end()
    })

    st.test('validates REQ with multiple filters', t => {
      // Authors must be valid 64-char hex pubkeys
      const validPubkey = '0'.repeat(64)
      t.doesNotThrow(
        () => validate_client_message(['REQ', 'sub123', { kinds: [1] }, { authors: [validPubkey] }]),
        'REQ with multiple filters passes'
      )
      t.end()
    })

    st.test('validates CLOSE message', t => {
      t.doesNotThrow(
        () => validate_client_message(['CLOSE', 'sub123']),
        'valid CLOSE message passes'
      )
      t.end()
    })

    st.test('throws for invalid message type', t => {
      t.throws(
        () => validate_client_message(['INVALID', 'data']),
        /invalid/i,
        'invalid type throws'
      )
      t.end()
    })

    st.test('throws for malformed message', t => {
      t.throws(
        () => validate_client_message('not an array'),
        /invalid/i,
        'non-array throws'
      )
      t.end()
    })

    st.end()
  })

  t.test('validate_relay_message', st => {
    st.test('validates EVENT message', t => {
      const event = createTestEvent()
      t.doesNotThrow(
        () => validate_relay_message(['EVENT', 'sub123', event]),
        'valid EVENT message passes'
      )
      t.end()
    })

    st.test('validates OK message (success)', t => {
      // Event ID must be valid 64-char hex (a-f, 0-9 only)
      const validEventId = 'a'.repeat(64)
      t.doesNotThrow(
        () => validate_relay_message(['OK', validEventId, true, '']),
        'valid OK success message passes'
      )
      t.end()
    })

    st.test('validates OK message (failure)', t => {
      const validEventId = 'b'.repeat(64)
      t.doesNotThrow(
        () => validate_relay_message(['OK', validEventId, false, 'error reason']),
        'valid OK failure message passes'
      )
      t.end()
    })

    st.test('validates EOSE message', t => {
      t.doesNotThrow(
        () => validate_relay_message(['EOSE', 'sub123']),
        'valid EOSE message passes'
      )
      t.end()
    })

    st.test('validates NOTICE message', t => {
      t.doesNotThrow(
        () => validate_relay_message(['NOTICE', 'some notice text']),
        'valid NOTICE message passes'
      )
      t.end()
    })

    st.test('validates CLOSED message', t => {
      t.doesNotThrow(
        () => validate_relay_message(['CLOSED', 'sub123', 'reason']),
        'valid CLOSED message passes'
      )
      t.end()
    })

    st.test('throws for invalid message type', t => {
      t.throws(
        () => validate_relay_message(['INVALID', 'data']),
        /invalid/i,
        'invalid type throws'
      )
      t.end()
    })

    st.end()
  })

  t.test('parse_client_message', st => {
    st.test('parses string message', t => {
      const msg    = JSON.stringify(['REQ', 'sub123', { kinds: [1] }])
      const result = parse_client_message(msg)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result?.[0], 'REQ', 'correct message type')
      t.end()
    })

    st.test('parses object message', t => {
      const msg    = ['REQ', 'sub123', { kinds: [1] }]
      const result = parse_client_message(msg)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result?.[0], 'REQ', 'correct message type')
      t.end()
    })

    st.test('returns error for invalid JSON string', t => {
      const result = parse_client_message('not json')

      t.notOk(result.ok, 'parsing failed')
      t.equal(result.result, null, 'result is null')
      t.ok(result.error, 'has error message')
      t.end()
    })

    st.test('returns error for invalid message', t => {
      const result = parse_client_message(['INVALID', 'data'])

      t.notOk(result.ok, 'validation failed')
      t.equal(result.result, null, 'result is null')
      t.end()
    })

    st.test('parses EVENT message', t => {
      const event  = createTestEvent()
      const result = parse_client_message(['EVENT', event])

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.[0], 'EVENT', 'correct type')
      t.end()
    })

    st.test('parses CLOSE message', t => {
      const result = parse_client_message(['CLOSE', 'sub123'])

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.[0], 'CLOSE', 'correct type')
      t.equal(result.result?.[1], 'sub123', 'correct sub_id')
      t.end()
    })

    st.end()
  })

  t.test('parse_relay_message', st => {
    st.test('parses string message', t => {
      const msg    = JSON.stringify(['EOSE', 'sub123'])
      const result = parse_relay_message(msg)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result?.[0], 'EOSE', 'correct message type')
      t.end()
    })

    st.test('parses object message', t => {
      const msg    = ['NOTICE', 'hello']
      const result = parse_relay_message(msg)

      t.ok(result.ok, 'parsing succeeded')
      t.deepEqual(result.result?.[0], 'NOTICE', 'correct message type')
      t.end()
    })

    st.test('returns error for invalid JSON string', t => {
      const result = parse_relay_message('not json')

      t.notOk(result.ok, 'parsing failed')
      t.equal(result.result, null, 'result is null')
      t.ok(result.error, 'has error message')
      t.end()
    })

    st.test('parses EVENT message', t => {
      const event  = createTestEvent()
      const result = parse_relay_message(['EVENT', 'sub123', event])

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.[0], 'EVENT', 'correct type')
      t.end()
    })

    st.test('parses OK message', t => {
      // Use valid hex characters only (a-f, 0-9)
      const eventId = 'a'.repeat(64)
      const result  = parse_relay_message(['OK', eventId, true, ''])

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.[0], 'OK', 'correct type')
      t.equal(result.result?.[2], true, 'correct ok status')
      t.end()
    })

    st.test('parses CLOSED message', t => {
      const result = parse_relay_message(['CLOSED', 'sub123', 'reason'])

      t.ok(result.ok, 'parsing succeeded')
      t.equal(result.result?.[0], 'CLOSED', 'correct type')
      t.end()
    })

    st.end()
  })
}
