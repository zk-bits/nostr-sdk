import { KeyCache }     from '@/class/cache.js'
import { EventEmitter } from '@/class/emitter.js'
import { NostrSocket }  from '@/class/socket.js'

import { generate_label, now } from '@/lib/index.js'

import type {
  EventFilter,
  RelayClosedMessage,
  RelayEventMessage,
  RelayMessage,
  SignedEvent
} from '@/types/index.js'

export class NostrSubscription extends EventEmitter <{
  active : [ void ],
  closed : [ string ],
  eose   : [ void ],
  event  : [ SignedEvent ]
}> {

  private readonly _filters : EventFilter[]
  private readonly _id      : string
  private readonly _socket  : NostrSocket

  private _active  : boolean = false
  private _count   : number  = 0
  private _retries : number  = 0
  private _since   : number  = now()
  private _timer   : NodeJS.Timeout | undefined

  constructor (
    filters : EventFilter | EventFilter[],
    socket  : NostrSocket,
    sub_id? : string
  ) {
    // Initialize the class.
    super()
    // Initialize the filters.
    this._filters = Array.isArray(filters) ? filters : [ filters ]
    // Initialize the subscription ID.
    this._id = sub_id ?? generate_label()
    // Initialize the socket.
    this._socket = socket
    // Subscribe to the message event.
    this._socket.on('message', (msg) => this._handler(msg))
  }

  public get filters () {
    return this._filters
  }

  public get id () {
    return this._id
  }

  public get is_active () {
    return this._active
  }

  public get socket () {
    return this._socket
  }

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
    if (this.state.retries < this.socket.config.max_retries) {
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
    // Unsubscribe from the close event.
    this._socket.off('message', (msg) => this._handler(msg))
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
    const timeout = this.socket.config.sub_timeout
    // If the keep-alive timer exists, clear it.
    clearTimeout(this._timer)
    // Set a new timer to resubscribe.
    this._timer = setTimeout(() => this._subscribe(), timeout).unref()
  }

  private _subscribe () {
    // Send a subscription request to the relay.
    this.socket.send([ 'REQ', this.id, ...this.filters ])
  }

  public listen (duration? : number) : Promise<SignedEvent[]> {
    // If the subscription is not active, activate the subscription.
    if (!this.is_active) this._subscribe()
    // Initialize the results array.
    const results : SignedEvent[] = []
    // Define the timeout.
    const timeout = duration ?? this.socket.config.sub_timeout
    // Create a promise to resolve the events.
    return new Promise((resolve) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => resolve(results), timeout)
      // Subscribe to the event.
      this.within('event', (event : SignedEvent) => {
        // If a duration is not provided,
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

  public async subscribe () : Promise<NostrSubscription> {
    // If the subscription is already active, return the subscription.
    if (this.state.active) return this
    // Define the subscription timeout.
    const timeout = this.socket.config.sub_timeout
    // Create a promise to resolve the subscription.
    return new Promise<NostrSubscription>((resolve, reject) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => reject('timeout'), timeout)
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
        reject(reason)
      }, timeout)
      // Send the subscription request.
      this._subscribe()
    })
  }

  public unsubscribe () {
    // Close the subscription.
    this._close('unsubscribed')
    // Send a close message to the relay.
    this.socket.send([ 'CLOSE', this.id ])
  }
}

export class SubscriptionManager extends EventEmitter <{
  active : [ void ],
  closed : [ NostrSubscription, string? ],
  eose   : [ NostrSubscription ],
  event  : [ SignedEvent ]
}> {

  private readonly _cache : KeyCache
  private readonly _subs  : Map<string, NostrSubscription>

  private _active : boolean = false

  constructor (
    subscriptions : NostrSubscription[],
    cache_size    : number = 1000
  ) {
    super()
    // Initialize the cache.
    this._cache = new KeyCache(cache_size)
    // Initialize the subscriptions map.
    this._subs  = new Map(subscriptions.map(sub => [ sub.socket.url, sub ]))
    // Subscribe to the subscriptions.
    this._subs.forEach(sub => {
      sub.on('closed', (reason) => this._close(sub, reason))
      sub.on('eose',   ()       => this._eose(sub))
      sub.on('event',  (event)  => this._event(event))
    })
  }

  public get cache () {
    return this._cache
  }

  public get is_active () {
    return this._active
  }

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

  public async collect (duration? : number) : Promise<SignedEvent[]> {
    // Create a set of events.
    const events : Set<SignedEvent> = new Set()
    // Create a set of listen promises.
    const queries = this.subs.map(sub => sub.listen(duration))
    // Wait for all promises to complete.
    await Promise.allSettled(queries).then(results => {
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          result.value.forEach(event => events.add(event))
        }
      })
    })
    // Return the events.
    return Array.from(events)
  }

  public get (id : string) : NostrSubscription | undefined {
    return this._subs.get(id)
  }

  public async subscribe (timeout : number = 5000) : Promise<SubscriptionManager> {
    // Create a promise to resolve the subscription manager.
    return new Promise<SubscriptionManager>((resolve, reject) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => reject('timeout'), timeout)
      // For each subscription:
      this.within('eose', () => {
        // Clear the timeout.
        clearTimeout(timer)
        // Resolve the promise.
        resolve(this)
      }, timeout)
    })
  }

  public unsubscribe () {
    // Unsubscribe from all subscriptions.
    this.subs.forEach(sub => sub.unsubscribe())
    // Clear the subscriptions map.
    this._subs.clear()
    // Set the active state to false.
    this._active = false
  }
}
