import { KeyCache }     from '@/class/cache.js'
import { EventEmitter } from '@/class/emitter.js'
import { NostrSocket }  from '@/class/socket.js'

import { assert_ok, generate_label, now } from '@/lib/index.js'

import type {
  EventFilter,
  NostrSocketConfig,
  RelayClosedMessage,
  RelayEventMessage,
  RelayMessage,
  SignedEvent
} from '@/types/index.js'

/**
 * Subscription to a single Nostr relay.
 * Handles REQ/CLOSE protocol, automatic resubscription, and event emission.
 * @emits active  When the subscription receives its first EOSE
 * @emits closed  When the subscription is closed (with reason)
 * @emits eose    When an End-Of-Stored-Events message is received
 * @emits event   When an event matching the filters is received
 */
export class NostrSubscription extends EventEmitter <{
  active : [ void ],
  closed : [ string ],
  eose   : [ void ],
  event  : [ SignedEvent ]
}> {

  private readonly _config  : NostrSocketConfig
  private readonly _filters : EventFilter[]
  private readonly _id      : string
  private readonly _socket  : NostrSocket
  /** Bound handler reference for proper cleanup. */
  private readonly _msgHandler : (msg: RelayMessage) => void

  private _active  : boolean = false
  private _count   : number  = 0
  private _retries : number  = 0
  private _since   : number  = now()
  private _timer   : NodeJS.Timeout | undefined

  /**
   * Creates a new subscription to a relay.
   * @param filters  Event filter(s) for the subscription
   * @param socket   The NostrSocket to subscribe through
   * @param sub_id   Optional subscription ID (auto-generated if not provided)
   */
  constructor (
    filters : EventFilter | EventFilter[],
    socket  : NostrSocket,
    sub_id? : string
  ) {
    // Initialize the class.
    super()
    // Initialize the configuration.
    this._config  = socket.config
    // Initialize the filters.
    this._filters = Array.isArray(filters) ? filters : [ filters ]
    // Initialize the subscription ID.
    this._id = sub_id ?? generate_label()
    // Initialize the socket.
    this._socket = socket
    // Create bound handler reference for cleanup.
    this._msgHandler = (msg: RelayMessage) => this._handler(msg)
    // Subscribe to the message event.
    this._socket.on('message', this._msgHandler)
  }

  /** Subscription configuration inherited from the socket. */
  public get config () {
    return this._config
  }

  /** Event filters for this subscription. */
  public get filters () {
    return this._filters
  }

  /** Unique subscription ID. */
  public get id () {
    return this._id
  }

  /** Whether the subscription is active (has received EOSE). */
  public get is_active () {
    return this._active
  }

  /** The socket this subscription is connected through. */
  public get socket () {
    return this._socket
  }

  /** Current subscription state including event count and retry info. */
  public get state () {
    return {
      active  : this._active,
      count   : this._count,
      retries : this._retries,
      since   : this._since
    }
  }

  private _cancel (msg : RelayClosedMessage) {
    // If the subscription is not active, return.
    if (!this.state.active) return
    // If the subscription is initialized and there are retries left,
    if (this.state.retries < this.config.max_retries) {
      // Update the retry count.
      this._retries += 1
    } else {
      // Close the subscription.
      this._close(msg[2])
    }
  }

  private _close (reason : string) {
    // Reset the subscription state.
    this._active  = false
    this._count   = 0
    this._retries = 0
    this._since   = now()
    // Clear the keep-alive timer.
    clearTimeout(this._timer)
    // Unsubscribe from the socket message event.
    this._socket.off('message', this._msgHandler)
    // Emit the closed event.
    this.emit('closed', reason)
  }

  private _eose () {
    // Emit the eose event.
    this.emit('eose')
    // Update the retry count.
    this._retries = 0
    // Update the keep-alive timer.
    this._keep_alive()
    // If the subscription is not active,
    if (!this.state.active) {
      // Set the active state to true.
      this._active = true
      // Emit the active event.
      this.emit('active')
    }
  }

  private _event (msg : RelayEventMessage) {
    // Update the event count.
    this._count += 1
    // Update the keep-alive timer.
    this._keep_alive()
    // Emit the event.
    this.emit('event', msg[2])
  }

  private _handler (msg : RelayMessage) {
    // Unpack the message.
    const [ type, sub_id ] = msg
    // If the subscription ID does not match, return.
    if (sub_id !== this.id) return
    // Update the since timestamp.
    this._since = now()
    // Handle the message based on the type.
    switch (type) {
      case 'CLOSED' : this._cancel(msg) ;break
      case 'EOSE'   : this._eose()      ;break
      case 'EVENT'  : this._event(msg)  ;break
    }
  }

  private _keep_alive () {
    // Define the subscription timeout.
    const timeout = this.config.sub_timeout
    // If the keep-alive timer exists, clear it.
    clearTimeout(this._timer)
    // Set a new timer to resubscribe.
    this._timer = setTimeout(() => this._subscribe(), timeout)
    // Prevent timer from blocking process exit in Node.js.
    if (typeof this._timer.unref === 'function') this._timer.unref()
  }

  private _subscribe () {
    // Send a subscription request to the relay.
    this.socket.send([ 'REQ', this.id, ...this.filters ])
  }

  /**
   * Listens for events on the subscription.
   * If duration is provided, collects events for that duration.
   * If duration is undefined, resolves immediately on first event or after msg_timeout.
   * @param duration  Optional duration in ms to collect events
   * @returns         Promise that resolves with collected events
   */
  public listen (duration? : number) : Promise<SignedEvent[]> {
    // Initialize the results array.
    const results : SignedEvent[] = []
    // Define the timeout.
    const timeout = duration ?? this.config.msg_timeout
    // If the subscription is not active, subscribe to the EOSE event.
    if (!this.is_active) this._subscribe()
    // Create a promise to resolve the events.
    return new Promise((resolve) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => resolve(results), timeout)
      // Subscribe to the event.
      this.within('event', (event : SignedEvent) => {
        // If a duration is not provided, resolve on first event.
        if (!duration) {
          // Clear the timeout.
          clearTimeout(timer)
          // Resolve the promise.
          resolve([ event ])
        } else {
          // Add the event to the results.
          results.push(event)
        }
      }, timeout)
    })
  }

  /**
   * Activates the subscription and waits for EOSE.
   * @returns  Promise that resolves with this subscription when active
   * @throws   Error if subscription times out or is closed by the relay
   */
  public async subscribe () : Promise<NostrSubscription> {
    // If the subscription is already active, return the subscription.
    if (this.state.active) return this
    // Define the subscription timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the subscription.
    return new Promise<NostrSubscription>((resolve, reject) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => reject(new Error('subscription timeout')), timeout)
      // Subscribe to the EOSE event.
      this.within('eose', () => {
        // Clear the timeout.
        clearTimeout(timer)
        // Resolve the promise.
        resolve(this)
      }, timeout)
      // Subscribe to the closed event.
      this.within('closed', (reason : string) => {
        // Clear the timeout.
        clearTimeout(timer)
        // Reject the promise.
        reject(new Error(`subscription closed: ${reason}`))
      }, timeout)
      // Send the subscription request.
      this._subscribe()
    })
  }

  /** Closes the subscription and sends CLOSE message to the relay. */
  public unsubscribe () {
    // Close the subscription.
    this._close('unsubscribed')
    // Send a close message to the relay.
    this.socket.send([ 'CLOSE', this.id ])
  }
}

/**
 * Manages subscriptions across multiple relays with event deduplication.
 * Aggregates events from all subscriptions and emits them through a single interface.
 * @emits active  When at least one subscription is active
 * @emits closed  When a subscription is closed (with subscription and reason)
 * @emits eose    When a subscription receives EOSE (with subscription)
 * @emits event   When a deduplicated event is received
 */
export class SubscriptionManager extends EventEmitter <{
  active : [ void ],
  closed : [ NostrSubscription, string? ],
  eose   : [ NostrSubscription ],
  event  : [ SignedEvent ]
}> {

  private readonly _cache  : KeyCache
  private readonly _config : NostrSocketConfig
  private readonly _subs   : Map<string, NostrSubscription>

  private _active : boolean = false

  /**
   * Creates a new subscription manager.
   * @param subscriptions  Array of NostrSubscription instances to manage
   * @param cache_size     Size of the deduplication cache (default: 1000)
   * @throws Error         If subscriptions array is empty
   */
  constructor (
    subscriptions : NostrSubscription[],
    cache_size    : number = 1000
  ) {
    // Assert that the subscriptions array is not empty.
    assert_ok(subscriptions.length > 0, 'subscriptions are required')
    // Initialize the class.
    super()
    // Initialize the cache.
    this._cache  = new KeyCache(cache_size)
    // Initialize the configuration.
    this._config = subscriptions[0].socket.config
    // Initialize the subscriptions map.
    this._subs   = new Map(subscriptions.map(sub => [ sub.socket.url, sub ]))
    // Subscribe to the subscriptions.
    this._subs.forEach(sub => {
      sub.on('closed', (reason) => this._close(sub, reason))
      sub.on('eose',   ()       => this._eose(sub))
      sub.on('event',  (event)  => this._event(event))
    })
  }

  /** Event deduplication cache. */
  public get cache () {
    return this._cache
  }

  /** Configuration inherited from the first subscription. */
  public get config () {
    return this._config
  }

  /** Whether at least one subscription is active. */
  public get is_active () {
    return this._active
  }

  /** Array of managed subscriptions. */
  public get subs () {
    return Array.from(this._subs.values())
  }

  private _close (sub : NostrSubscription, reason? : string) {
    // Emit the closed event.
    this.emit('closed', sub, reason)
    // Set the active state to false.
    this._active = this.subs.some(sub => sub.state.active)
  }

  _eose (sub : NostrSubscription) {
    // Emit the eose event.
    this.emit('eose', sub)
    // If the subscription is not active,
    if (!this._active) {
      // Set the active state to true.
      this._active = true
      // Emit the active event.
      this.emit('active')
    }
  }

  _event (event : SignedEvent) {
    // If the event is already in the cache, return.
    if (this.cache.has(event.id)) return
    // Add the event to the cache.
    this._cache.add(event.id)
    // Emit the event.
    this.emit('event', event)
  }

  /**
   * Collects events from all subscriptions for a given duration.
   * Each subscription listens independently; results are deduplicated.
   * @param duration  Optional duration in ms to collect events (each sub uses its own timeout)
   * @returns         Promise that resolves with deduplicated events from all subscriptions
   */
  public async collect (duration? : number) : Promise<SignedEvent[]> {
    // Create a set of events.
    const events : Set<SignedEvent> = new Set()
    // Create a set of listen promises.
    const queries = this.subs.map(sub => sub.listen(duration))
    // Wait for all promises to complete.
    await Promise.allSettled(queries).then(results => {
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach(event => void events.add(event))
        }
      })
    })
    // Return the events.
    return Array.from(events)
  }

  /**
   * Gets a subscription by relay URL.
   * @param id  The relay URL
   * @returns   The subscription or undefined if not found
   */
  public get (id : string) : NostrSubscription | undefined {
    return this._subs.get(id)
  }

  /**
   * Activates all subscriptions and waits for the first EOSE.
   * @returns  Promise that resolves with this manager when first subscription is active
   * @throws   Error if all subscriptions timeout
   */
  public async subscribe () : Promise<SubscriptionManager> {
    // Define the timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the subscription manager.
    return new Promise<SubscriptionManager>((resolve, reject) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => reject(new Error('subscription manager timeout')), timeout)
      // For each subscription:
      this.within('eose', () => {
        // Clear the timeout.
        clearTimeout(timer)
        // Resolve the promise.
        resolve(this)
      }, timeout)
    })
  }

  /** Closes all subscriptions and clears the manager state. */
  public unsubscribe () {
    // Unsubscribe from all subscriptions.
    this.subs.forEach(sub => void sub.unsubscribe())
    // Clear the subscriptions map.
    this._subs.clear()
    // Set the active state to false.
    this._active = false
  }
}
