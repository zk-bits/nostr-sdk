import { Test } from 'tape'

import { EventEmitter } from '@/class/emitter.js'

type TestEvents = {
  message : [ string ]
  data    : [ number, string ]
  empty   : []
}

export default function emitter_tests (t: Test) {
  t.test('EventEmitter', st => {

    st.test('on - registers handler', t => {
      const emitter = new EventEmitter<TestEvents>()
      let received  = ''

      emitter.on('message', (msg) => { received = msg })
      emitter.emit('message', 'hello')

      t.equal(received, 'hello', 'handler received message')
      t.end()
    })

    st.test('on - registers multiple handlers', t => {
      const emitter  = new EventEmitter<TestEvents>()
      const messages: string[] = []

      emitter.on('message', (msg) => messages.push('a:' + msg))
      emitter.on('message', (msg) => messages.push('b:' + msg))
      emitter.emit('message', 'test')

      t.deepEqual(messages, ['a:test', 'b:test'], 'both handlers called')
      t.end()
    })

    st.test('on - handles multiple arguments', t => {
      const emitter = new EventEmitter<TestEvents>()
      let num = 0
      let str = ''

      emitter.on('data', (n, s) => { num = n; str = s })
      emitter.emit('data', 42, 'hello')

      t.equal(num, 42, 'received number')
      t.equal(str, 'hello', 'received string')
      t.end()
    })

    st.test('off - removes specific handler', t => {
      const emitter  = new EventEmitter<TestEvents>()
      const messages: string[] = []

      const handler1 = (msg: string) => messages.push('a:' + msg)
      const handler2 = (msg: string) => messages.push('b:' + msg)

      emitter.on('message', handler1)
      emitter.on('message', handler2)
      emitter.off('message', handler1)
      emitter.emit('message', 'test')

      t.deepEqual(messages, ['b:test'], 'only remaining handler called')
      t.end()
    })

    st.test('off - handles non-existent handler gracefully', t => {
      const emitter = new EventEmitter<TestEvents>()
      const handler = () => {}

      t.doesNotThrow(
        () => emitter.off('message', handler),
        'removing non-existent handler does not throw'
      )
      t.end()
    })

    st.test('once - handler called only once', t => {
      const emitter = new EventEmitter<TestEvents>()
      let count     = 0

      emitter.once('message', () => { count++ })
      emitter.emit('message', 'first')
      emitter.emit('message', 'second')
      emitter.emit('message', 'third')

      t.equal(count, 1, 'handler called only once')
      t.end()
    })

    st.test('once - can be removed before firing', t => {
      const emitter = new EventEmitter<TestEvents>()
      let called    = false

      const handler = () => { called = true }
      emitter.once('message', handler)
      emitter.off('message', handler)
      emitter.emit('message', 'test')

      t.notOk(called, 'handler not called after removal')
      t.end()
    })

    st.test('within - handler fires once during timeout', async t => {
      const emitter  = new EventEmitter<TestEvents>()
      const messages: string[] = []

      // within is like "once with timeout" - fires once then removes handler
      emitter.within('message', (msg) => messages.push(msg), 100)
      emitter.emit('message', 'immediate')

      await new Promise(r => setTimeout(r, 50))
      emitter.emit('message', 'during')

      // Only first event is captured, handler is removed after first call
      t.deepEqual(messages, ['immediate'], 'handler called once during timeout')
      t.end()
    })

    st.test('within - handler removed after timeout', async t => {
      const emitter  = new EventEmitter<TestEvents>()
      const messages: string[] = []

      emitter.within('message', (msg) => messages.push(msg), 50)

      await new Promise(r => setTimeout(r, 100))
      emitter.emit('message', 'after')

      t.deepEqual(messages, [], 'handler not called after timeout')
      t.end()
    })

    st.test('emit - calls all handlers', t => {
      const emitter  = new EventEmitter<TestEvents>()
      const received: string[] = []

      emitter.on('message', (msg) => received.push('1:' + msg))
      emitter.on('message', (msg) => received.push('2:' + msg))
      emitter.emit('message', 'test')

      t.equal(received.length, 2, 'all handlers called')
      t.end()
    })

    st.test('emit - handles async handlers', async t => {
      const emitter  = new EventEmitter<TestEvents>()
      let completed  = false

      emitter.on('message', async () => {
        await new Promise(r => setTimeout(r, 10))
        completed = true
      })

      emitter.emit('message', 'test')
      // emit doesn't wait for async handlers
      t.notOk(completed, 'async handler not completed immediately')

      await new Promise(r => setTimeout(r, 50))
      t.ok(completed, 'async handler eventually completes')
      t.end()
    })

    st.test('all - wildcard handler receives all events', t => {
      const emitter  = new EventEmitter<TestEvents>()
      const received: Array<[string, any[]]> = []

      emitter.all((topic, ...args) => received.push([topic as string, args]))
      emitter.emit('message', 'hello')
      emitter.emit('data', 42, 'world')

      t.equal(received.length, 2, 'wildcard called for each event')
      t.deepEqual(received[0], ['message', ['hello']], 'message event captured')
      t.deepEqual(received[1], ['data', [42, 'world']], 'data event captured')
      t.end()
    })

    st.test('has - checks for registered handlers', t => {
      const emitter = new EventEmitter<TestEvents>()

      t.notOk(emitter.has('message'), 'no handlers initially')

      emitter.on('message', () => {})
      t.ok(emitter.has('message'), 'has handler after registration')
      t.end()
    })

    st.test('has - returns false after handler removed', t => {
      const emitter = new EventEmitter<TestEvents>()
      const handler = () => {}

      emitter.on('message', handler)
      emitter.off('message', handler)

      t.notOk(emitter.has('message'), 'no handlers after removal')
      t.end()
    })

    st.test('emit - does not throw for no handlers', t => {
      const emitter = new EventEmitter<TestEvents>()
      t.doesNotThrow(
        () => emitter.emit('message', 'test'),
        'emitting with no handlers does not throw'
      )
      t.end()
    })

    st.test('handlers isolated between events', t => {
      const emitter  = new EventEmitter<TestEvents>()
      let msgCalled  = false
      let dataCalled = false

      emitter.on('message', () => { msgCalled = true })
      emitter.on('data', () => { dataCalled = true })
      emitter.emit('message', 'test')

      t.ok(msgCalled, 'message handler called')
      t.notOk(dataCalled, 'data handler not called')
      t.end()
    })

    st.end()
  })
}
