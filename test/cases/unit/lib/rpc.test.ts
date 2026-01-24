import { Test } from 'tape'

import {
  create_request_message,
  create_accept_message,
  create_reject_message,
  create_event_message,
  wrap_rpc_message,
  unwrap_rpc_message,
  parse_rpc_message,
  gen_message_id,
  validate_request_template,
  validate_event_template,
  validate_request_message,
  validate_event_message,
  validate_accept_message,
  validate_reject_message
} from '@/lib/rpc.js'

import { gen_seckey, get_pubkey } from '@/crypto/ecc.js'
import { PROTOCOL_VERSION }       from '@/const.js'

import type { RequestRpcMessage, RpcMessageEnvelope } from '@/types/rpc.js'

export default function rpc_tests (t: Test) {
  t.test('gen_message_id', st => {
    st.test('generates string ID', t => {
      const id = gen_message_id()

      t.equal(typeof id, 'string', 'returns string')
      t.ok(id.length > 0, 'ID is not empty')
      t.end()
    })

    st.test('generates unique IDs', t => {
      const id1 = gen_message_id()
      const id2 = gen_message_id()

      t.notEqual(id1, id2, 'different IDs generated')
      t.end()
    })

    st.end()
  })

  t.test('create_request_message', st => {
    st.test('creates valid request with method and params', t => {
      const message = create_request_message({
        method : 'test_method',
        params : ['arg1', 'arg2']
      })

      t.equal(message.method, 'test_method', 'has method')
      t.deepEqual(message.params, ['arg1', 'arg2'], 'has params')
      t.equal(message.type, 'request', 'type is request')
      t.equal(message.version, PROTOCOL_VERSION, 'has protocol version')
      t.end()
    })

    st.test('auto-generates ID if not provided', t => {
      const message = create_request_message({
        method : 'test_method'
      })

      t.ok(typeof message.id === 'string', 'has ID')
      t.ok(message.id.length > 0, 'ID is not empty')
      t.end()
    })

    st.test('uses provided ID', t => {
      const message = create_request_message({
        id     : 'custom-id',
        method : 'test_method'
      })

      t.equal(message.id, 'custom-id', 'uses provided ID')
      t.end()
    })

    st.test('defaults params to empty array', t => {
      const message = create_request_message({
        method : 'test_method'
      })

      t.deepEqual(message.params, [], 'params defaults to empty array')
      t.end()
    })

    st.test('defaults peers to empty array', t => {
      const message = create_request_message({
        method : 'test_method'
      })

      t.deepEqual(message.peers, [], 'peers defaults to empty array')
      t.end()
    })

    st.end()
  })

  t.test('create_accept_message', st => {
    st.test('creates response with status: true', t => {
      const request = create_request_message({ method: 'test' })
      const accept  = create_accept_message(request, { result: 'success' })

      t.equal(accept.status, true, 'status is true')
      t.equal(accept.type, 'accept', 'type is accept')
      t.end()
    })

    st.test('preserves request ID', t => {
      const request = create_request_message({ id: 'req-123', method: 'test' })
      const accept  = create_accept_message(request, { result: 'ok' })

      t.equal(accept.id, 'req-123', 'preserves request ID')
      t.end()
    })

    st.test('includes payload data', t => {
      const request = create_request_message({ method: 'test' })
      const payload = { foo: 'bar', num: 42 }
      const accept  = create_accept_message(request, payload)

      t.deepEqual(accept.data, payload, 'includes payload data')
      t.end()
    })

    st.end()
  })

  t.test('create_reject_message', st => {
    st.test('creates response with status: false', t => {
      const request = create_request_message({ method: 'test' })
      const reject  = create_reject_message(request, 'error occurred')

      t.equal(reject.status, false, 'status is false')
      t.equal(reject.type, 'reject', 'type is reject')
      t.end()
    })

    st.test('includes rejection reason', t => {
      const request = create_request_message({ method: 'test' })
      const reject  = create_reject_message(request, 'invalid input')

      t.equal(reject.reason, 'invalid input', 'includes reason')
      t.end()
    })

    st.test('preserves request ID', t => {
      const request = create_request_message({ id: 'req-456', method: 'test' })
      const reject  = create_reject_message(request, 'failed')

      t.equal(reject.id, 'req-456', 'preserves request ID')
      t.end()
    })

    st.end()
  })

  t.test('create_event_message', st => {
    st.test('creates event message with topic and data', t => {
      const message = create_event_message({
        topic : 'user/online',
        data  : { userId: '123' }
      })

      t.equal(message.topic, 'user/online', 'has topic')
      t.deepEqual(message.data, { userId: '123' }, 'has data')
      t.equal(message.type, 'event', 'type is event')
      t.equal(message.version, PROTOCOL_VERSION, 'has protocol version')
      t.end()
    })

    st.test('auto-generates ID if not provided', t => {
      const message = create_event_message({
        topic : 'test',
        data  : {}
      })

      t.ok(typeof message.id === 'string', 'has ID')
      t.ok(message.id.length > 0, 'ID is not empty')
      t.end()
    })

    st.test('uses provided ID', t => {
      const message = create_event_message({
        id    : 'event-id',
        topic : 'test',
        data  : {}
      })

      t.equal(message.id, 'event-id', 'uses provided ID')
      t.end()
    })

    st.end()
  })

  t.test('wrap_rpc_message / unwrap_rpc_message', st => {
    st.test('round-trip preserves message content', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_sec   = gen_seckey()
      const bob_pub   = get_pubkey(bob_sec)

      const message = create_request_message({
        method : 'test_method',
        params : ['arg1']
      })

      const wrapped   = wrap_rpc_message(
        { kind: 25000, pubkey: alice_pub },
        message,
        bob_pub,
        alice_sec
      )
      const unwrapped = unwrap_rpc_message(wrapped, bob_sec) as RpcMessageEnvelope<RequestRpcMessage>

      t.equal(unwrapped.method, message.method, 'method preserved')
      t.deepEqual(unwrapped.params, message.params, 'params preserved')
      t.equal(unwrapped.type, message.type, 'type preserved')
      t.end()
    })

    st.test('creates valid signed event', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_pub   = get_pubkey(gen_seckey())

      const message = create_request_message({ method: 'test' })
      const wrapped = wrap_rpc_message(
        { kind: 25000, pubkey: alice_pub },
        message,
        bob_pub,
        alice_sec
      )

      t.ok(wrapped.id, 'has event ID')
      t.ok(wrapped.sig, 'has signature')
      t.equal(wrapped.pubkey, alice_pub, 'pubkey is sender')
      t.equal(wrapped.kind, 25000, 'has correct kind')
      t.end()
    })

    st.test('encrypted content not readable without key', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_pub   = get_pubkey(gen_seckey())
      const eve_sec   = gen_seckey()

      const message = create_request_message({ method: 'secret' })
      const wrapped = wrap_rpc_message(
        { kind: 25000, pubkey: alice_pub },
        message,
        bob_pub,
        alice_sec
      )

      t.throws(
        () => unwrap_rpc_message(wrapped, eve_sec),
        'eve cannot decrypt message'
      )
      t.end()
    })

    st.test('includes recipient in p tag', t => {
      const alice_sec = gen_seckey()
      const alice_pub = get_pubkey(alice_sec)
      const bob_pub   = get_pubkey(gen_seckey())

      const message = create_request_message({ method: 'test' })
      const wrapped = wrap_rpc_message(
        { kind: 25000, pubkey: alice_pub },
        message,
        bob_pub,
        alice_sec
      )

      const pTag = wrapped.tags.find(tag => tag[0] === 'p')
      t.ok(pTag, 'has p tag')
      t.equal(pTag?.[1], bob_pub, 'p tag contains recipient pubkey')
      t.end()
    })

    st.end()
  })

  t.test('parse_rpc_message', st => {
    st.test('parses valid request message', t => {
      const original = create_request_message({
        method : 'test',
        params : ['a', 'b']
      })
      const json   = JSON.stringify(original)
      const parsed = parse_rpc_message(json)

      t.equal(parsed.type, 'request', 'type preserved')
      t.equal((parsed as any).method, original.method, 'method preserved')
      t.deepEqual((parsed as any).params, original.params, 'params preserved')
      t.end()
    })

    st.test('parses valid event message', t => {
      const original = create_event_message({
        topic : 'test',
        data  : { foo: 'bar' }
      })
      const json   = JSON.stringify(original)
      const parsed = parse_rpc_message(json)

      t.equal(parsed.type, 'event', 'type preserved')
      t.equal((parsed as any).topic, original.topic, 'topic preserved')
      t.end()
    })

    st.test('parses valid accept message', t => {
      const request  = create_request_message({ method: 'test' })
      const original = create_accept_message(request, { result: 'ok' })
      const json     = JSON.stringify(original)
      const parsed   = parse_rpc_message(json)

      t.equal(parsed.type, 'accept', 'type preserved')
      t.equal((parsed as any).status, true, 'status preserved')
      t.end()
    })

    st.test('parses valid reject message', t => {
      const request  = create_request_message({ method: 'test' })
      const original = create_reject_message(request, 'failed')
      const json     = JSON.stringify(original)
      const parsed   = parse_rpc_message(json)

      t.equal(parsed.type, 'reject', 'type preserved')
      t.equal((parsed as any).status, false, 'status preserved')
      t.equal((parsed as any).reason, 'failed', 'reason preserved')
      t.end()
    })

    st.test('throws on invalid JSON', t => {
      t.throws(
        () => parse_rpc_message('not valid json'),
        'throws on invalid JSON'
      )
      t.end()
    })

    st.test('throws on schema validation failure', t => {
      const invalidMessage = JSON.stringify({
        type   : 'unknown_type',
        method : 'test'
      })

      t.throws(
        () => parse_rpc_message(invalidMessage),
        'throws on invalid schema'
      )
      t.end()
    })

    st.end()
  })

  t.test('validate_request_template', st => {
    st.test('accepts valid template', t => {
      t.doesNotThrow(() => {
        validate_request_template({ method: 'test' })
      }, 'valid template accepted')
      t.end()
    })

    st.test('throws on invalid template', t => {
      t.throws(() => {
        validate_request_template({} as any)
      }, 'missing method throws')
      t.end()
    })

    st.end()
  })

  t.test('validate_event_template', st => {
    st.test('accepts valid template', t => {
      t.doesNotThrow(() => {
        validate_event_template({ topic: 'test', data: {} })
      }, 'valid template accepted')
      t.end()
    })

    st.test('throws on invalid template', t => {
      t.throws(() => {
        validate_event_template({ topic: 'test' } as any)
      }, 'missing data throws')
      t.end()
    })

    st.end()
  })

  t.test('validate_request_message', st => {
    st.test('accepts valid message', t => {
      const message = create_request_message({ method: 'test' })
      t.doesNotThrow(() => {
        validate_request_message(message)
      }, 'valid message accepted')
      t.end()
    })

    st.test('throws on invalid message', t => {
      t.throws(() => {
        validate_request_message({ type: 'request' } as any)
      }, 'incomplete message throws')
      t.end()
    })

    st.end()
  })

  t.test('validate_event_message', st => {
    st.test('accepts valid message', t => {
      const message = create_event_message({ topic: 'test', data: {} })
      t.doesNotThrow(() => {
        validate_event_message(message)
      }, 'valid message accepted')
      t.end()
    })

    st.test('throws on invalid message', t => {
      t.throws(() => {
        validate_event_message({ type: 'event' } as any)
      }, 'incomplete message throws')
      t.end()
    })

    st.end()
  })

  t.test('validate_accept_message', st => {
    st.test('accepts valid message', t => {
      const request = create_request_message({ method: 'test' })
      const accept  = create_accept_message(request, { result: 'ok' })
      t.doesNotThrow(() => {
        validate_accept_message(accept)
      }, 'valid message accepted')
      t.end()
    })

    st.test('throws on invalid message', t => {
      t.throws(() => {
        validate_accept_message({ status: true } as any)
      }, 'incomplete message throws')
      t.end()
    })

    st.end()
  })

  t.test('validate_reject_message', st => {
    st.test('accepts valid message', t => {
      const request = create_request_message({ method: 'test' })
      const reject  = create_reject_message(request, 'error')
      t.doesNotThrow(() => {
        validate_reject_message(reject)
      }, 'valid message accepted')
      t.end()
    })

    st.test('throws on invalid message', t => {
      t.throws(() => {
        validate_reject_message({ status: false } as any)
      }, 'incomplete message throws')
      t.end()
    })

    st.end()
  })
}
