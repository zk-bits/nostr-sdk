import { gen_seckey, get_pubkey }   from '@/crypto/ecc.js'
import { create_event, sign_event } from '@/lib/event.js'
import { now }                      from '@/lib/util.js'

import type { EventConfig, EventFilter, SignedEvent } from '@/types/index.js'

/**
 * Generates a test keypair for signing events.
 * @returns Object with seckey (hex) and pubkey (hex)
 */
export function generateTestKeypair (): { seckey: string, pubkey: string } {
  const seckey = gen_seckey()
  const pubkey = get_pubkey(seckey)
  return { seckey, pubkey }
}

/**
 * Creates a signed test event with sensible defaults.
 * @param overrides  Partial event properties to override defaults
 * @param seckey     Optional secret key (generates new keypair if not provided)
 * @returns          Signed event
 */
export function createTestEvent (
  overrides: Partial<EventConfig> = {},
  seckey?: string
): SignedEvent {
  const keypair = seckey ? { seckey, pubkey: get_pubkey(seckey) } : generateTestKeypair()

  const template = create_event({
    content    : 'Test content',
    kind       : 1,
    pubkey     : keypair.pubkey,
    created_at : now(),
    tags       : [],
    ...overrides,
    pubkey     : overrides.pubkey ?? keypair.pubkey
  })

  return sign_event(template, keypair.seckey)
}

/**
 * Creates a test filter with sensible defaults.
 * @param overrides  Partial filter properties to override defaults
 * @returns          Event filter
 */
export function createTestFilter (overrides: Partial<EventFilter> = {}): EventFilter {
  return {
    kinds : [ 1 ],
    ...overrides
  }
}

/**
 * Returns a promise that resolves after the specified delay.
 * @param ms  Delay in milliseconds
 * @returns   Promise that resolves after the delay
 */
export function waitFor (ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Known test vector for deterministic testing.
 * Uses a fixed secret key to generate predictable pubkey.
 */
export const TEST_VECTOR = {
  seckey : '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef',
  pubkey : get_pubkey('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef')
}

/**
 * Creates multiple test events for batch testing.
 * @param count  Number of events to create
 * @param opts   Optional overrides for all events
 * @returns      Array of signed events
 */
export function createTestEvents (
  count: number,
  opts: Partial<EventConfig> = {}
): SignedEvent[] {
  const { seckey, pubkey } = generateTestKeypair()
  return Array.from({ length: count }, (_, i) =>
    createTestEvent({
      content: `Test content ${i}`,
      pubkey,
      ...opts
    }, seckey)
  )
}
