/**
 * Test fixtures and utilities for integration tests.
 *
 * Provides factories for creating isolated test environments and
 * event-driven helpers to replace hard-coded delays.
 */
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { NostrClient } from '@/class/client.js'
import { NostrNode }   from '@/class/node.js'

import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'
import { now }                      from '@/lib/util.js'

import type { EventEmitter }          from '@/class/emitter.js'
import type { NostrSubscription }     from '@/class/sub.js'
import type { EventConfig, SignedEvent } from '@/types/index.js'

/** Default timeout for event-driven operations (ms) */
export const DEFAULT_TIMEOUT = 5000

/** Default cleanup delay after close operations (ms) */
export const CLEANUP_DELAY = 100

// ─────────────────────────────────────────────────────────────────
// Fixture Types
// ─────────────────────────────────────────────────────────────────

/** Single relay test environment */
export interface TestFixture {
  relay   : NostrRelay
  socket  : NostrSocket
  port    : number
  url     : string
  cleanup : () => Promise<void>
}

/** Multi-relay client test environment */
export interface MultiRelayFixture {
  relays  : NostrRelay[]
  client  : NostrClient
  ports   : number[]
  urls    : string[]
  cleanup : () => Promise<void>
}

/** P2P node test environment */
export interface NodeFixture {
  relays  : NostrRelay[]
  node1   : NostrNode
  node2   : NostrNode
  pubkey1 : string
  pubkey2 : string
  cleanup : () => Promise<void>
}

/** Performance measurement result */
export interface TimedResult<T> {
  result : T
  ms     : number
}

/** Event stream configuration */
export interface EventStreamConfig {
  kind?    : number
  content? : string
  pubkey?  : string
  seckey?  : string
}

// ─────────────────────────────────────────────────────────────────
// Fixture Factories
// ─────────────────────────────────────────────────────────────────

/**
 * Creates an isolated single-relay test environment.
 * @param port  Port number for the relay
 * @returns     TestFixture with relay, socket, and cleanup function
 */
export async function create_fixture (port: number): Promise<TestFixture> {
  const url    = `ws://localhost:${port}`
  const relay  = new NostrRelay()
  const socket = new NostrSocket(url)

  await relay.start({ port })
  await socket.connect()

  const cleanup = async () => {
    socket.close()
    await wait_ms(CLEANUP_DELAY)
    relay.stop()
    await wait_ms(CLEANUP_DELAY)
  }

  return { relay, socket, port, url, cleanup }
}

/**
 * Creates a multi-relay client test environment.
 * @param ports  Array of port numbers for relays
 * @returns      MultiRelayFixture with relays, client, and cleanup function
 */
export async function create_multi_relay_fixture (ports: number[]): Promise<MultiRelayFixture> {
  const urls   = ports.map(p => `ws://localhost:${p}`)
  const relays = ports.map(() => new NostrRelay())

  await Promise.all(relays.map((r, i) => r.start({ port: ports[i] })))

  const client = new NostrClient(urls)
  await client.connect()

  const cleanup = async () => {
    client.close()
    await wait_ms(CLEANUP_DELAY)
    for (const r of relays) r.stop()
    await wait_ms(CLEANUP_DELAY)
  }

  return { relays, client, ports, urls, cleanup }
}

/**
 * Creates a P2P node test environment with two nodes.
 * @param relay_ports  Ports for relay servers (e.g., [9150, 9151])
 * @returns            NodeFixture with two connected nodes and cleanup
 */
export async function create_node_fixture (relay_ports: number[]): Promise<NodeFixture> {
  const urls   = relay_ports.map(p => `ws://localhost:${p}`)
  const relays = relay_ports.map(() => new NostrRelay())

  await Promise.all(relays.map((r, i) => r.start({ port: relay_ports[i] })))

  const seckey1 = gen_seckey()
  const seckey2 = gen_seckey()
  const pubkey1 = get_pubkey(seckey1)
  const pubkey2 = get_pubkey(seckey2)

  // Each node knows about the other peer
  const node1 = new NostrNode([pubkey2], urls, seckey1)
  const node2 = new NostrNode([pubkey1], urls, seckey2)

  await Promise.all([node1.connect(), node2.connect()])

  const cleanup = async () => {
    node1.close()
    node2.close()
    await wait_ms(CLEANUP_DELAY)
    for (const r of relays) r.stop()
    await wait_ms(CLEANUP_DELAY)
  }

  return { relays, node1, node2, pubkey1, pubkey2, cleanup }
}

// ─────────────────────────────────────────────────────────────────
// Event-Driven Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Waits for a specific event to be emitted with optional timeout.
 * @param emitter   EventEmitter instance
 * @param event     Event name to wait for
 * @param timeout   Timeout in milliseconds (default: DEFAULT_TIMEOUT)
 * @returns         Promise that resolves with event payload or rejects on timeout
 */
export function wait_for_event<T extends Record<string, any[]>, K extends keyof T> (
  emitter : EventEmitter<T>,
  event   : K,
  timeout : number = DEFAULT_TIMEOUT
): Promise<T[K]> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      emitter.off(event, handler)
      reject(new Error(`Timeout waiting for event: ${String(event)}`))
    }, timeout)

    const handler = (...args: T[K]) => {
      clearTimeout(timer)
      resolve(args)
    }

    emitter.once(event, handler)
  })
}

/**
 * Waits for socket to become ready.
 * @param socket   NostrSocket instance
 * @param timeout  Timeout in milliseconds
 */
export async function wait_for_ready (
  socket  : NostrSocket,
  timeout : number = DEFAULT_TIMEOUT
): Promise<void> {
  if (socket.is_ready) return
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for socket ready'))
    }, timeout)
    socket.once('ready', () => { clearTimeout(timer); resolve() })
  })
}

/**
 * Waits for socket to close.
 * @param socket   NostrSocket instance
 * @param timeout  Timeout in milliseconds
 */
export async function wait_for_closed (
  socket  : NostrSocket,
  timeout : number = DEFAULT_TIMEOUT
): Promise<void> {
  if (!socket.is_ready) return
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error('Timeout waiting for socket close'))
    }, timeout)
    socket.once('closed', () => { clearTimeout(timer); resolve() })
  })
}

/**
 * Waits for subscription to receive EOSE.
 * @param sub      NostrSubscription instance
 * @param timeout  Timeout in milliseconds
 */
export async function wait_for_eose (
  sub     : NostrSubscription,
  timeout : number = DEFAULT_TIMEOUT
): Promise<void> {
  if (sub.state.eose) return
  await wait_for_event(sub, 'eose', timeout)
}

/**
 * Waits for relay to become ready.
 * @param relay    NostrRelay instance
 * @param timeout  Timeout in milliseconds
 */
export async function wait_for_relay_ready (
  relay   : NostrRelay,
  timeout : number = DEFAULT_TIMEOUT
): Promise<void> {
  if (relay.ready) return
  await wait_for_event(relay, 'ready', timeout)
}

/**
 * Waits for a NostrNode to become ready.
 * @param node     NostrNode instance
 * @param timeout  Timeout in milliseconds
 */
export async function wait_for_node_ready (
  node    : NostrNode,
  timeout : number = DEFAULT_TIMEOUT
): Promise<void> {
  if (node.is_ready) return
  await wait_for_event(node, 'ready', timeout)
}

/**
 * Simple delay helper - use sparingly, prefer event-driven waiting.
 * @param ms  Milliseconds to wait
 */
export function wait_ms (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

// ─────────────────────────────────────────────────────────────────
// Performance Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Measures execution time of an async function.
 * @param fn  Function to measure
 * @returns   Result with value and duration in ms
 */
export async function measure_time<T> (fn: () => Promise<T>): Promise<TimedResult<T>> {
  const start  = performance.now()
  const result = await fn()
  const ms     = performance.now() - start
  return { result, ms }
}

/**
 * Creates multiple signed events for batch testing.
 * @param count  Number of events to create
 * @param opts   Optional configuration overrides
 * @returns      Array of signed events
 */
export function create_event_stream (
  count : number,
  opts  : EventStreamConfig = {}
): SignedEvent[] {
  const seckey = opts.seckey ?? gen_seckey()
  const pubkey = opts.pubkey ?? get_pubkey(seckey)

  return Array.from({ length: count }, (_, i) => {
    const template: EventConfig = {
      content    : opts.content ?? `Stream event ${i}`,
      kind       : opts.kind ?? 1,
      pubkey     : pubkey,
      created_at : now() + i,
      tags       : []
    }
    return sign_event(create_event(template), seckey)
  })
}

/**
 * Creates a keypair for testing.
 * @returns  Object with seckey and pubkey
 */
export function create_keypair (): { seckey: string, pubkey: string } {
  const seckey = gen_seckey()
  const pubkey = get_pubkey(seckey)
  return { seckey, pubkey }
}

/**
 * Creates a single signed test event.
 * @param opts    Optional configuration overrides
 * @param seckey  Optional secret key (generates new if not provided)
 * @returns       Signed event
 */
export function create_test_event (
  opts   : Partial<EventConfig> = {},
  seckey?: string
): SignedEvent {
  const key    = seckey ?? gen_seckey()
  const pubkey = opts.pubkey ?? get_pubkey(key)

  const template = create_event({
    content    : opts.content ?? 'Test event',
    kind       : opts.kind ?? 1,
    pubkey     : pubkey,
    created_at : opts.created_at ?? now(),
    tags       : opts.tags ?? []
  })

  return sign_event(template, key)
}

// ─────────────────────────────────────────────────────────────────
// Assertion Helpers
// ─────────────────────────────────────────────────────────────────

/**
 * Asserts that a promise rejects within a timeout.
 * @param promise  Promise to test
 * @param timeout  Timeout in ms before force-failing
 * @returns        The rejection error
 */
export async function expect_rejection<T> (
  promise : Promise<T>,
  timeout : number = DEFAULT_TIMEOUT
): Promise<unknown> {
  const timer = new Promise<never>((_, reject) => {
    setTimeout(() => reject(new Error('Expected rejection but promise did not reject')), timeout)
  })

  try {
    await Promise.race([promise, timer])
    throw new Error('Expected rejection but promise resolved')
  } catch (err) {
    return err
  }
}

/**
 * Collects events from an emitter for a duration.
 * @param emitter   EventEmitter instance
 * @param event     Event name to collect
 * @param duration  Collection duration in ms
 * @returns         Array of collected event payloads
 */
export function collect_events<T extends Record<string, any[]>, K extends keyof T> (
  emitter  : EventEmitter<T>,
  event    : K,
  duration : number
): Promise<T[K][]> {
  return new Promise(resolve => {
    const collected: T[K][] = []

    const handler = (...args: T[K]) => {
      collected.push(args)
    }

    emitter.on(event, handler)

    setTimeout(() => {
      emitter.off(event, handler)
      resolve(collected)
    }, duration)
  })
}
