import { EventEmitter } from '@/class/emitter.js'

import {
  NostrSubscription,
  SubscriptionManager
} from '@/class/sub.js'

import {
  NostrSocket,
  SOCKET_CONFIG
} from '@/class/socket.js'

import type {
  EventFilter,
  SignedEvent,
  PublishResponse,
  NostrClientConfig
} from '@/types/index.js'

import {
  generate_label,
  promise_any_with_context
} from '@/lib/util.js'

/** Default configuration for NostrClient instances. */
export const CLIENT_CONFIG : NostrClientConfig = {
  ...SOCKET_CONFIG,
  cache_size : 500
}

/**
 * Multi-relay Nostr client that aggregates connections to multiple relays.
 * Provides unified interface for publishing, querying, and subscribing across relays.
 * @emits closed  When a socket connection is closed
 * @emits ready   When a socket connection is established
 * @emits notice  When a NOTICE message is received from a relay
 * @emits error   When a socket error occurs
 */
export class NostrClient extends EventEmitter <{
  closed : [ NostrSocket ],
  ready  : [ NostrSocket ],
  notice : [ string, NostrSocket ],
  error  : [ string, NostrSocket ]
}> {
  private readonly _config  : NostrClientConfig
  private readonly _sockets : NostrSocket[] = []
  private readonly _subs    : Map<string, SubscriptionManager> = new Map()

  private _init : boolean = false

  /**
   * Creates a new NostrClient connected to multiple relays.
   * @param relays   Array of relay WebSocket URLs
   * @param options  Optional configuration overrides
   * @throws Error   If relays array is empty
   */
  constructor (
    relays  : string[],
    options : Partial<NostrClientConfig> = {}
  ) {
    // Initialize the class.
    super()
    // Validate the relays array.
    if (!Array.isArray(relays) || relays.length === 0) {
      throw new Error('at least one relay URL is required')
    }
    // Initialize the configuration.
    this._config  = { ...CLIENT_CONFIG, ...options }
    // For each relay url.
    for (const url of relays) {
      // Initialize a new socket for the relay.
      this.sockets.push(new NostrSocket(url, this.config))
    }
  }

  /** Current client configuration. */
  get config () {
    return this._config
  }

  /** Whether any relay connection is ready. */
  get is_ready () {
    return this._init
  }

  /** Array of relay socket connections. */
  get sockets () {
    return this._sockets
  }

  /** Map of subscription managers by subscription ID. */
  get subs () {
    return this._subs
  }

  /** Closes all relay connections. */
  public close () {
    // Close all sockets.
    this.sockets.forEach(socket => void socket.close())
  }

  /**
   * Connects to all relays, resolving when the first one connects.
   * @returns  Promise that resolves when at least one relay connects
   */
  public async connect () : Promise<void> {
    // Return a promise that resolves when the first socket connects.
    return promise_any_with_context(
      this.sockets.map(socket => socket.connect()),
      'Connect',
      this.sockets
    )
  }

  /**
   * Publishes an event to all relays, resolving on first success.
   * @param event  The signed event to publish
   * @returns      Promise that resolves with the first successful response
   */
  public async publish (event : SignedEvent) : Promise<PublishResponse> {
    // Create a set of receipts.
    const receipts = this.sockets.map(socket => socket.publish(event))
    // Return a promise that resolves when the first receipt is received.
    return promise_any_with_context(receipts, 'Publish', this.sockets)
  }

  /**
   * Queries all relays for events, resolving on first response.
   * @param filters   Event filter(s) to match
   * @param duration  Optional duration in ms to collect events
   * @returns         Promise that resolves with the first relay's matching events
   */
  public async query (
    filters   : EventFilter | EventFilter[],
    duration? : number
  ) : Promise<SignedEvent[]> {
    // Create a set of queries.
    const queries = this.sockets.map(socket => socket.query(filters, duration))
    // Return a promise that resolves when the first query is completed.
    return promise_any_with_context(queries, 'Query', this.sockets)
  }

  /**
   * Creates a subscription across all relays with event deduplication.
   * @param filter  Event filter(s) to subscribe to
   * @returns       Promise that resolves with the subscription manager
   * @throws        Error if subscription times out on all relays
   */
  public async subscribe (filter : EventFilter | EventFilter[]) : Promise<SubscriptionManager> {
    const sub_id  = generate_label()
    // Create a set of subscriptions.
    const subs    = this.sockets.map(socket => new NostrSubscription(filter, socket, sub_id))
    // Create a new subscription manager.
    const manager = new SubscriptionManager(subs, this.config.cache_size)
    // Add the subscription manager to the subscriptions map.
    this._subs.set(sub_id, manager)
    // Return a promise that resolves when the first subscription is active.
    try {
      return await manager.subscribe()
    } catch (err) {
      // Clean up on failure
      this._subs.delete(sub_id)
      manager.unsubscribe()
      throw err
    }
  }
}
