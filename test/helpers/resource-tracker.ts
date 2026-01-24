/**
 * Resource Tracker for Integration Tests
 *
 * Tracks all test resources (relays, sockets, nodes, clients) and ensures
 * proper cleanup to prevent lingering async operations and port conflicts.
 */
import { NostrRelay }  from '@/class/relay.js'
import { NostrSocket } from '@/class/socket.js'
import { NostrClient } from '@/class/client.js'
import { NostrNode }   from '@/class/node.js'

/** Cleanup delay between resource types (ms) */
const CLEANUP_DELAY = 150

/** Types of resources that can be tracked */
type TrackableResource = NostrNode | NostrClient | NostrSocket | NostrRelay

/**
 * Tracks test resources and ensures proper cleanup order.
 * Resources are cleaned up in reverse order of dependency:
 * Nodes -> Clients -> Sockets -> Relays
 */
export class ResourceTracker {
  private readonly _nodes   : Set<NostrNode>   = new Set()
  private readonly _clients : Set<NostrClient> = new Set()
  private readonly _sockets : Set<NostrSocket> = new Set()
  private readonly _relays  : Set<NostrRelay>  = new Set()

  /**
   * Tracks a resource for automatic cleanup.
   * @param resource  The resource to track
   * @returns         The same resource (for chaining)
   */
  track<T extends TrackableResource>(resource: T): T {
    if (resource instanceof NostrNode) {
      this._nodes.add(resource)
    } else if (resource instanceof NostrClient) {
      this._clients.add(resource)
    } else if (resource instanceof NostrSocket) {
      this._sockets.add(resource)
    } else if (resource instanceof NostrRelay) {
      this._relays.add(resource)
    }
    return resource
  }

  /**
   * Creates and tracks a relay.
   * @param port  Port number for the relay
   * @returns     Started relay instance
   */
  async createRelay(port: number): Promise<NostrRelay> {
    const relay = new NostrRelay()
    this._relays.add(relay)
    await relay.start({ port })
    return relay
  }

  /**
   * Creates and tracks a socket.
   * @param url      WebSocket URL
   * @param options  Socket options
   * @returns        Connected socket instance
   */
  async createSocket(url: string, options = {}): Promise<NostrSocket> {
    const socket = new NostrSocket(url, options)
    this._sockets.add(socket)
    await socket.connect()
    return socket
  }

  /**
   * Creates and tracks a client.
   * @param urls     Array of relay URLs
   * @param options  Client options
   * @returns        Connected client instance
   */
  async createClient(urls: string[], options = {}): Promise<NostrClient> {
    const client = new NostrClient(urls, options)
    this._clients.add(client)
    await client.connect()
    return client
  }

  /**
   * Creates and tracks a node.
   * @param peers    Array of peer public keys
   * @param urls     Array of relay URLs
   * @param seckey   Node's secret key
   * @param options  Node options
   * @returns        Connected node instance
   */
  async createNode(
    peers   : string[],
    urls    : string[],
    seckey  : string,
    options = {}
  ): Promise<NostrNode> {
    const node = new NostrNode(peers, urls, seckey, options)
    this._nodes.add(node)
    await node.connect()
    return node
  }

  /**
   * Cleans up all tracked resources in proper order.
   * Waits between each resource type to allow close frames to propagate.
   */
  async cleanup(): Promise<void> {
    // Close nodes first (they depend on clients/sockets)
    for (const node of this._nodes) {
      try { node.close() } catch { /* ignore */ }
    }
    this._nodes.clear()

    if (this._clients.size > 0 || this._sockets.size > 0) {
      await sleep(CLEANUP_DELAY)
    }

    // Close clients (they manage sockets)
    for (const client of this._clients) {
      try { client.close() } catch { /* ignore */ }
    }
    this._clients.clear()

    if (this._sockets.size > 0) {
      await sleep(CLEANUP_DELAY)
    }

    // Close standalone sockets
    for (const socket of this._sockets) {
      try { socket.close() } catch { /* ignore */ }
    }
    this._sockets.clear()

    if (this._relays.size > 0) {
      await sleep(CLEANUP_DELAY)
    }

    // Stop relays last
    for (const relay of this._relays) {
      try { relay.stop() } catch { /* ignore */ }
    }
    this._relays.clear()

    // Final wait to ensure all cleanup completes
    await sleep(CLEANUP_DELAY)
  }

  /** Number of tracked resources */
  get count(): number {
    return this._nodes.size + this._clients.size +
           this._sockets.size + this._relays.size
  }
}

/** Simple sleep helper */
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/** Global resource tracker instance */
let globalTracker: ResourceTracker | null = null

/**
 * Gets or creates the global resource tracker.
 * Use this for simple test cases that don't need isolated contexts.
 */
export function getGlobalTracker(): ResourceTracker {
  if (!globalTracker) {
    globalTracker = new ResourceTracker()
  }
  return globalTracker
}

/**
 * Cleans up the global tracker and resets it.
 */
export async function cleanupGlobalTracker(): Promise<void> {
  if (globalTracker) {
    await globalTracker.cleanup()
    globalTracker = null
  }
}
