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
import { generate_label } from '@/lib/util.js'

export const CLIENT_CONFIG : NostrClientConfig = {
  ...SOCKET_CONFIG,
  cache_size : 500
}

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

  constructor (
    relays  : string[],
    options : Partial<NostrClientConfig> = {}
  ) {
    // Initialize the class.
    super()
    // Initialize the configuration.
    this._config  = { ...CLIENT_CONFIG, ...options }
    // For each relay url.
    for (const url of relays) {
      // Initialize a new socket for the relay.
      this.sockets.push(new NostrSocket(url, this.config))
    }
  }

  get config () {
    return this._config
  }

  get is_ready () {
    return this._init
  }

  get sockets () {
    return this._sockets
  }

  get subs () {
    return this._subs
  }

  public close () {
    // Close all sockets.
    this.sockets.forEach(socket => socket.close())
  }

  public async connect () : Promise<void> {
    // Return a promise that resolves when the first socket connects.
    return Promise.any(this.sockets.map(socket => socket.connect()))
  }

  public async publish (event : SignedEvent) : Promise<PublishResponse> {
    // Create a set of receipts.
    const receipts = this.sockets.map(socket => socket.publish(event))
    // Return a promise that resolves when the first receipt is received.
    return Promise.any(receipts)
  }

  public async query (
    filters   : EventFilter | EventFilter[],
    duration? : number
  ) : Promise<SignedEvent[]> {
    // Create a set of queries.
    const queries = this.sockets.map(socket => socket.query(filters, duration))
    // Return a promise that resolves when the first query is completed.
    return Promise.any(queries)
  }

  public async subscribe (filter : EventFilter | EventFilter[]) : Promise<SubscriptionManager> {
    const sub_id  = generate_label()
    // Create a set of subscriptions.
    const subs    = this.sockets.map(socket => new NostrSubscription(filter, socket, sub_id))
    // Create a new subscription manager.
    const manager = new SubscriptionManager(subs, this.config.cache_size)
    // Add the subscription manager to the subscriptions map.
    this._subs.set(sub_id, manager)
    // Return a promise that resolves when the first subscription is active.
    return manager.subscribe(this.config.sub_timeout)
  }
}
