/**
 * P2P communication node for encrypted RPC messaging over Nostr.
 * Provides one-to-one (request/respond) and one-to-many (cast/announce) patterns.
 * Currently in development - not yet ready for production.
 * @emits bounced  When an event fails decryption or filtering
 * @emits closed   When the node connection is closed
 * @emits error    When an error occurs
 * @emits message  When a valid RPC message is received
 * @emits notice   When a NOTICE is received from a relay
 * @emits ready    When the node is connected and subscribed
 * @emits send     When an event is sent
 */
import { EventEmitter }        from '@/class/emitter.js'
import { SubscriptionManager } from '@/class/sub.js'
import { get_pubkey }          from '@/crypto/ecc.js'

import {
  CLIENT_CONFIG,
  NostrClient
} from '@/class/client.js'

import {
  create_accept_message,
  create_event_message,
  create_reject_message,
  create_request_message,
  generate_label,
  is_pubkey_mentioned,
  parse_error,
  unwrap_rpc_message,
  validate_event_template,
  validate_request_message,
  validate_request_template,
  wrap_rpc_message
} from '@/lib/index.js'

import type {
  EventRpcTemplate,
  NostrNodeConfig,
  PublishResponse,
  RequestRpcMessage,
  RequestRpcTemplate,
  RpcFilterOptions,
  RpcMessageData,
  RpcMessageEnvelope,
  RpcMessageFilter,
  RpcMessagePayload,
  RpcRequestOptions,
  RpcResponseMethod,
  SignedEvent
} from '@/types/index.js'

const NODE_CONFIG : () => NostrNodeConfig = () => {
  return {
    ...CLIENT_CONFIG(),
    rpc_kind : 20000,
    sub_id   : generate_label(32)
  }
}

export class NostrNode extends EventEmitter<{
  bounced : [ SignedEvent, string ],
  closed  : [ NostrNode ]
  error   : [ string, unknown ],
  message : [ RpcMessageData ],
  notice  : [ string ],
  ready   : [ NostrNode ],
  send    : [ SignedEvent ],
}> {
  private readonly _config : NostrNodeConfig
  private readonly _client : NostrClient
  private readonly _peers  : Set<string> = new Set()

  private readonly _pubkey : string
  private readonly _seckey : string

  private _active : boolean = false
  private _init   : boolean = false
  private _sub    : SubscriptionManager | null = null
  private _timer  : NodeJS.Timeout | undefined

  /**
   * Creates a new NostrNode for P2P communication.
   * @param peers    Array of peer public keys
   * @param relays   Array of relay WebSocket URLs
   * @param seckey   Secret key for signing messages
   * @param options  Optional configuration overrides
   */
  constructor (
    peers   : string[],
    relays  : string[],
    seckey  : string,
    options : Partial<NostrNodeConfig> = {}
  ) {
    // Initialize the class.
    super()
    // Initialize the configuration.
    this._config = { ...NODE_CONFIG(), ...options }
    // Initialize the client.
    this._client = new NostrClient(relays, this.config)
    // Initialize the peers.
    this._peers = new Set(peers)
    // Initialize the secret key.
    this._seckey = seckey
    // Initialize the public key.
    this._pubkey = get_pubkey(seckey)
    // Subscribe to the client event bus.
    this._client.on('notice', (msg) => this.emit('notice', msg))
    this._client.on('closed', ()    => this._close())
  }

  /** Current node configuration. */
  get config() {
    return this._config
  }

  /** The underlying NostrClient instance. */
  get client() {
    return this._client
  }

  /** Set of peer public keys. */
  get peers () {
    return this._peers
  }

  /** This node's public key. */
  get pubkey() {
    return this._pubkey
  }

  /** Whether the node is connected and subscription is active. */
  get ready() {
    return this._init && this._active
  }

  /**
   * The active subscription manager.
   * @throws Error if subscription is not active
   */
  get sub () {
    // If the subscription is not active, throw an error.
    if (!this._sub) throw new Error('subscription not active')
    // Return the subscription.
    return this._sub
  }

  private _close () {
    // Clear the peers map.
    this._peers.clear()
    // Clear the client.
    this.client.close()
    // Set the ready state to false.
    this._active = false
    // Emit the closed event.
    this.emit('closed', this)
  }

  private _filter (event : SignedEvent) : boolean {
    // If the peer is not in the list, return false.
    if (!this.peers.has(event.pubkey)) return false
    // Bounce if the recipient is not mentioned in the event.
    if (!is_pubkey_mentioned(event, this.pubkey)) return false
    // Else, pass the event through.
    return true
  }

  private async _listen (filter : RpcMessageFilter) : Promise<RpcMessageData[]> {
    // If the subscription is not active, subscribe to the EOSE event.
    if (!this._sub) await this._subscribe()
    // Create a set of messages.
    const messages = new Set<RpcMessageData>()
    // Define the timeout.
    const timeout = filter.timeout ?? this.config.sub_timeout
    // Create a promise to resolve the responses.
    return new Promise((resolve, reject) => {
      // Message handler function.
      const handler = (message : RpcMessageData) => {
        // If the request_id is not the same, return.
        if (message.id !== filter.request_id) return
        // If the peer is in the list, add the message to the set.
        if (filter.peers.includes(message.event.pubkey)) messages.add(message)
        // If the threshold is reached, resolve the promise.
        if (filter.threshold && messages.size >= filter.threshold) resolver()
        // If all peers responded, resolve the promise.
        if (messages.size === filter.peers.length) resolver()
      }
      // Cleanup function to remove listener and clear timeout.
      const cleanup = () => { clearTimeout(timer); this.off('message', handler) }
      // Resolver function that cleans up and resolves with the collected messages.
      const resolver = () => { cleanup(); resolve(Array.from(messages)) }
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => { cleanup(); reject(new Error('request timed out')) }, timeout)
      // Subscribe to the message event.
      this.on('message', handler)
    })
  }

  private _on_active () {
    // Set the ready state to true.
    this._active = true
    // Set the initialization state to true.
    if (!this._init) {
      // Set the initialization state to true.
      this._init = true
      // Emit the ready event.
      this.emit('ready', this)
    }
  }

  private _on_cancel () {
    // Clear the timeout.
    clearTimeout(this._timer)
    // Set a timeout to close the node if it is not active.
    this._timer = setTimeout(() => { if (!this._active) this._close() }, this.config.sub_timeout)
    // Prevent timer from blocking process exit in Node.js.
    if (typeof this._timer.unref === 'function') this._timer.unref()
  }

  private _on_event (event : SignedEvent) {
    try {
      // Bounce if the event doesn't match our filter.
      if (!this._filter(event)) return
      // Unwrap the event to get the rpc message.
      const message = unwrap_rpc_message(event, this._seckey)
      // Emit message event to subscribers.
      this.emit('message', message)
    } catch (err) {
      // Emit bounced event to subscribers.
      this.emit('bounced', event, parse_error(err))
    }
  }

  private _send_accept (
    request : RpcMessageEnvelope<RequestRpcMessage>,
    data    : unknown
  ) : Promise<PublishResponse> {
    // Validate the request message.
    validate_request_message(request)
    // Create the accept message.
    const response = create_accept_message(request, data)
    // Send the message.
    return this._send_message(response, request.event.pubkey)
  }

  private _send_reject (
    request : RpcMessageEnvelope<RequestRpcMessage>,
    reason  : string
  ) : Promise<PublishResponse> {
    // Validate the request message.
    validate_request_message(request)
    // Create the reject message.
    const response = create_reject_message(request, reason)
    // Send the message.
    return this._send_message(response, request.event.pubkey)
  }

  private _send_message (
    message   : RpcMessagePayload,
    recipient : string
  ) : Promise<PublishResponse> {
    // Create the event config.
    const config = { kind : this.config.rpc_kind, pubkey : this.pubkey }
    // Wrap the message.
    const event  = wrap_rpc_message(config, message, recipient, this._seckey)
    // Publish the event.
    return this.client.publish(event)
  }

  private async _subscribe () : Promise<void> {
    // Connect to the client.
    await this.client.connect()
    // If already subscribed, return early.
    if (this._sub) return
    // Create a list of authors to subscribe to.
    const authors = Array.from(this.peers)
    // Create a filter for the subscription.
    const filter = { authors, kinds : [ this.config.rpc_kind ] }
    // Subscribe to the filters.
    this._sub = this.client.subscribe(filter)
    // Subscribe to the subscription event bus.
    this.sub.on('active', ()      => this._on_active())
    this.sub.on('event',  (event) => this._on_event(event))
    this.sub.on('cancel', ()      => this._on_cancel())
    // Activate the subscription.
    return this.sub.activate().then(() => void 0)
  }

  /** Closes the connection and stops listening for messages. */
  public close () {
    // Close the client.
    this._close()
  }

  /** Connects to relays and starts listening for messages. */
  public connect () : Promise<void> {
    // If the node is already ready, return a resolved promise.
    if (this.ready) return Promise.resolve()
    // Otherwise, return a promise that resolves when the node is ready.
    return new Promise((resolve, reject) => {
      // Cleanup function to clear timeout and remove error listener.
      const cleanup = () => { clearTimeout(timer); this.off('error', on_err) }
      // Error handler function.
      const on_err  = (err : unknown) => { cleanup(); reject(err) }
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => { cleanup(); reject(new Error('connection timed out')) }, this.config.msg_timeout)
      // Subscribe to the ready event.
      this.once('ready', () => { cleanup(); resolve() })
      // Subscribe to the error event.
      this.on('error', on_err)
      // Subscribe to the subscription event.
      this._subscribe().catch(on_err)
    })
  }

  /** Broadcasts an event message to peers without waiting for responses. */
  public announce (
    template : EventRpcTemplate,
    peers    : string | string[]
  ) : Promise<PublishResponse>[] {
    // Validate the template.
    validate_event_template(template)
    // Normalize the peers into an array.
    peers = Array.isArray(peers) ? peers : [ peers ]
    // Create the event message.
    const payload = create_event_message(template)
    // Create a set of responses.
    return peers.map(peer => this._send_message(payload, peer))
  }

  /** Broadcasts a request to multiple peers and collects responses. */
  async cast (
    template : RequestRpcTemplate,
    peers    : string | string[],
    options  : RpcFilterOptions = {}
  ) : Promise<RpcMessageData[]> {
    // Validate the template.
    validate_request_template(template)
    // Normalize the peers into an array.
    peers = Array.isArray(peers) ? peers : [ peers ]
    // Create the request message.
    const payload = create_request_message(template)
    // Create a filter for the cast.
    const filter = { request_id : payload.id, peers, ...options }
    // Listen for the messages.
    const listener = this._listen(filter)
    // Send the messages to the peers.
    peers.forEach(peer => this._send_message(payload, peer))
    // Return the listener.
    return listener
  }

  /** Sends a request to a single peer and waits for a response. */
  async request (
    template : RequestRpcTemplate,
    peer     : string,
    options  : RpcRequestOptions = {}
  ) : Promise<RpcMessageData> {
    // Validate the template.
    validate_request_template(template)
    // Create the request message.
    const payload = create_request_message(template)
    // Create a filter for the cast.
    const filter = { request_id : payload.id, peers : [ peer ], ...options }
    // Listen for the messages.
    const listener = this._listen(filter)
    // Send the messages to the peers.
    this._send_message(payload, peer)
    // Return the listener.
    return listener.then(messages => messages[0])
  }

  /** Creates response methods (accept/reject) for an incoming RPC request. */
  respond (request : RpcMessageEnvelope<RequestRpcMessage>) : RpcResponseMethod {
    return {
      accept : (data : unknown)  => this._send_accept(request, data),
      reject : (reason : string) => this._send_reject(request, reason)
    }
  }

  /** Sends an RPC message directly to a peer. */
  send (
    message : RpcMessagePayload,
    peer    : string
  ) : Promise<PublishResponse> {
    return this._send_message(message, peer)
  }

}
