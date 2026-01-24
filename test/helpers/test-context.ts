/**
 * Test Context for Integration Tests
 *
 * Provides isolated test environments with automatic port allocation
 * and resource tracking. Each test context is independent to prevent
 * cross-test interference.
 */
import { Test } from 'tape'
import { ResourceTracker } from './resource-tracker.js'
import { gen_seckey, get_pubkey } from '@/crypto/ecc.js'

import type { NostrRelay }  from '@/class/relay.js'
import type { NostrSocket } from '@/class/socket.js'
import type { NostrClient } from '@/class/client.js'
import type { NostrNode }   from '@/class/node.js'

/** Default timeout for test operations (ms) */
export const DEFAULT_TEST_TIMEOUT = 10000

/** Port range allocation for test contexts */
const PORT_RANGE_SIZE = 20

/**
 * Isolated test context with automatic resource management.
 */
export class TestContext {
  private readonly _tracker   : ResourceTracker
  private readonly _basePort  : number
  private _portOffset         : number = 0

  constructor(basePort: number) {
    this._basePort = basePort
    this._tracker  = new ResourceTracker()
  }

  /** Gets the next available port in this context's range */
  nextPort(): number {
    return this._basePort + (this._portOffset++)
  }

  /** Gets a URL for the next available port */
  nextUrl(): string {
    return `ws://localhost:${this.nextPort()}`
  }

  /** Gets multiple URLs */
  nextUrls(count: number): string[] {
    return Array.from({ length: count }, () => this.nextUrl())
  }

  /** Resource tracker for this context */
  get tracker(): ResourceTracker {
    return this._tracker
  }

  /** Creates and tracks a relay */
  async createRelay(port?: number): Promise<NostrRelay> {
    return this._tracker.createRelay(port ?? this.nextPort())
  }

  /** Creates and tracks a socket */
  async createSocket(url?: string, options = {}): Promise<NostrSocket> {
    return this._tracker.createSocket(url ?? this.nextUrl(), options)
  }

  /** Creates and tracks a client */
  async createClient(urls?: string[], options = {}): Promise<NostrClient> {
    return this._tracker.createClient(urls ?? [this.nextUrl()], options)
  }

  /** Creates and tracks a node */
  async createNode(
    peers   : string[],
    urls?   : string[],
    seckey? : string,
    options  = {}
  ): Promise<NostrNode> {
    return this._tracker.createNode(
      peers,
      urls ?? [this.nextUrl()],
      seckey ?? gen_seckey(),
      options
    )
  }

  /** Generates a keypair */
  createKeypair(): { seckey: string, pubkey: string } {
    const seckey = gen_seckey()
    return { seckey, pubkey: get_pubkey(seckey) }
  }

  /** Cleans up all resources in this context */
  async cleanup(): Promise<void> {
    await this._tracker.cleanup()
  }
}

/** Global port counter to ensure unique ports across all contexts */
let globalPortCounter = 9200

/**
 * Creates an isolated test context with unique port range.
 * Each call allocates a new port range to prevent conflicts.
 */
export function createTestContext(): TestContext {
  const basePort = globalPortCounter
  globalPortCounter += PORT_RANGE_SIZE
  return new TestContext(basePort)
}

/**
 * Resets the global port counter.
 * Call this at the start of a test suite to reset port allocation.
 */
export function resetPortCounter(startPort = 9200): void {
  globalPortCounter = startPort
}

/**
 * Wraps an async test function with automatic context cleanup.
 * Use this to ensure resources are always cleaned up, even on failure.
 *
 * @example
 * ```typescript
 * st.test('my test', withContext(async (t, ctx) => {
 *   const relay = await ctx.createRelay()
 *   const socket = await ctx.createSocket(`ws://localhost:${relay.port}`)
 *   // ... test code ...
 * }))
 * ```
 */
export function withContext(
  fn: (t: Test, ctx: TestContext) => Promise<void>
): (t: Test) => Promise<void> {
  return async (t: Test) => {
    const ctx = createTestContext()
    try {
      await fn(t, ctx)
    } finally {
      await ctx.cleanup()
      t.end()
    }
  }
}

/**
 * Wraps an async function with a timeout.
 * Rejects if the function doesn't complete within the specified time.
 */
export function withTimeout<T>(
  fn: () => Promise<T>,
  ms: number = DEFAULT_TEST_TIMEOUT,
  message = 'Operation timed out'
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`${message} after ${ms}ms`))
    }, ms)

    fn()
      .then(result => {
        clearTimeout(timer)
        resolve(result)
      })
      .catch(err => {
        clearTimeout(timer)
        reject(err)
      })
  })
}

/**
 * Creates a deferred promise that can be resolved/rejected externally.
 * Useful for coordinating async test scenarios.
 */
export function createDeferred<T = void>(): {
  promise : Promise<T>
  resolve : (value: T) => void
  reject  : (error: Error) => void
} {
  let resolve!: (value: T) => void
  let reject!: (error: Error) => void

  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject  = rej
  })

  return { promise, resolve, reject }
}
