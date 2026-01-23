import { EventEmitter }      from '@/class/emitter.js'
import { MessageQueue }      from '@/class/queue.js'
import { NostrSubscription } from '@/class/sub.js'

import {
  parse_relay_message,
  validate_client_message
} from '@/lib/index.js'

import type {
  ClientMessage,
  EventFilter,
  NostrSocketConfig,
  SignedEvent,
  PublishResponse,
  RelayReceiptMessage,
  NostrSocketEvent,
  RelayNoticeMessage,
  RelayEventMessage
} from '@/types/index.js'

/** Default configuration for NostrSocket instances. */
export const SOCKET_CONFIG : NostrSocketConfig = {
  max_retries : 3,
  queue_ival  : 500,
  queue_limit : 10,
  msg_timeout : 5000,
  sub_timeout : 30000
}

/**
 * WebSocket connection to a single Nostr relay.
 * Handles message parsing, event publishing, and subscription management.
 * @emits ready    When the WebSocket connection is established
 * @emits closed   When the WebSocket connection is closed
 * @emits error    When a WebSocket error occurs
 * @emits message  When a valid relay message is received
 * @emits notice   When a NOTICE message is received from the relay
 * @emits receipt  When an OK receipt is received for a published event
 * @emits reject   When an invalid message is received
 */
export class NostrSocket extends EventEmitter <NostrSocketEvent> {
  private readonly _config : NostrSocketConfig
  private readonly _queue  : MessageQueue
  private readonly _subs   : Map<string, NostrSubscription> = new Map()
  private readonly _url    : string

  private _closeTimer : NodeJS.Timeout | undefined
  private _init       : boolean = false
  private _ws         : WebSocket

  /**
   * Creates a new NostrSocket connection to a relay.
   * @param relay    WebSocket URL (ws:// or wss://) or existing WebSocket instance
   * @param options  Optional configuration overrides
   * @throws Error   If URL is not a valid WebSocket URL
   */
  constructor (
    relay   : string | WebSocket,
    options : Partial<NostrSocketConfig> = {}
  ) {
    // Initialize the class.
    super()
    // Initialize the configuration.
    this._config = { ...SOCKET_CONFIG, ...options }
    // Initialize the queue.
    this._queue  = new MessageQueue(this)
    // Handle string URL vs WebSocket instance.
    if (typeof relay === 'string') {
      // Validate the WebSocket URL.
      if (!relay.startsWith('ws://') && !relay.startsWith('wss://')) {
        throw new Error(`invalid WebSocket URL: ${relay}`)
      }
      this._url = relay
      this._ws  = new WebSocket(relay)
    } else {
      // Use provided WebSocket directly.
      this._url = relay.url
      this._ws  = relay
    }
    // Register an event listener for the open event.
    this.ws.addEventListener('open', () => this._open())
    // Register an event listener for the close event.
    this.ws.addEventListener('close', () => this._close())
    // Register an event listener for the error event.
    this.ws.addEventListener('error', (event) => this._error(event))
    // Register an event listener for the message event.
    this.ws.addEventListener('message', (event) => this._handler(event.data))
  }

  /** Current socket configuration. */
  get config () {
    return this._config
  }

  /** Whether the WebSocket connection is established and ready. */
  get is_ready () {
    return this._init
  }

  /** Map of active subscriptions by subscription ID. */
  get subs () {
    return this._subs
  }

  /** The relay WebSocket URL. */
  get url () {
    return this._url
  }

  /** The underlying WebSocket instance. */
  get ws () {
    return this._ws
  }

  private _close () {
    // Clear the close timer if it exists.
    clearTimeout(this._closeTimer)
    // Clear the message queue.
    this._queue.clear()
    // Unsubscribe from all subscriptions.
    this._subs.forEach(sub => void sub.cancel())
    // Clear the subscriptions map.
    this._subs.clear()
    // Set the socket to not initialized.
    this._init = false
    // Emit a closed event.
    this.emit('closed', this)
  }

  private _error (error : unknown) {
    // Log the error to console.
    console.error(error)
    // Emit an error event.
    this.emit('error', null, String(error))
  }

  private _event (msg : RelayEventMessage) {
    // Emit an event event.
    this.emit('event', msg)
  }

  // Handle websocket messages from the relay.
  private _handler (message : unknown) {
    // Parse the message.
    try {
      // Parse the relay message.
      const parsed = parse_relay_message(message)
      // If the message is not valid, emit a reject event.
      if (!parsed.ok) return this.emit('reject', message, 'invalid message')
      // Emit a message event.
      this.emit('message', parsed.result)
      // Handle the message.
      switch (parsed.result[0]) {
        case 'EVENT'  : this._event(parsed.result);   break
        case 'NOTICE' : this._notice(parsed.result);  break
        case 'OK'     : this._receipt(parsed.result); break
      }
    } catch (err : unknown) {
      // Handle the error.
      this._error(err)
    }
  }

  private _notice (msg : RelayNoticeMessage) {
    // Emit a notice event.
    this.emit('notice', msg[1])
  }

  private _open () {
    // If the socket is already initialized, return.
    if (this.is_ready) return
    // Set the socket to initialized.
    this._init = true
    // Emit a ready event.
    this.emit('ready', this)
  }

  private _receipt (msg : RelayReceiptMessage) {
    // Emit a receipt event.
    this.emit('receipt', msg)
  }

  public _send (msg : ClientMessage) {
    // Validate the message.
    validate_client_message(msg)
    // Add the message to the queue.
    this.ws.send(JSON.stringify(msg))
  }

  /**
   * Closes the WebSocket connection after a delay.
   * @param delay  Delay in ms before closing (default: 100)
   */
  public close (delay : number = 100) {
    // Clear any existing close timer to prevent multiple close attempts.
    clearTimeout(this._closeTimer)
    // Setup a timer to close the connection.
    this._closeTimer = setTimeout(() => {
      // If the websocket connection is open,
      if (this.ws.readyState === WebSocket.OPEN) {
        // Close the websocket connection.
        this.ws.close()
      }
    }, delay)
  }

  /**
   * Waits for the WebSocket connection to be established.
   * @returns  Promise that resolves when connected
   * @throws   Error if connection times out
   */
  public async connect () : Promise<void> {
    // If the socket is already connected, return.
    if (this.is_ready) return
    // Define the connection timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the connection.
    return new Promise((resolve, reject) => {
      // Set a timeout to reject the promise if the connection times out.
      const timer = setTimeout(() => reject(new Error(`connection timeout for ${this.url}`)), timeout)
      // Connect the socket.
      this.within('ready', () => {
        // Clear the timeout.
        clearTimeout(timer)
        // Resolve the promise.
        resolve()
      }, timeout)
    })
  }

  /**
   * Publishes a signed event to the relay.
   * @param event  The signed event to publish
   * @returns      Promise that resolves with the publish response
   * @throws       Error if publish times out or is rejected by the relay
   */
  public async publish (event : SignedEvent) : Promise<PublishResponse> {
    // Make sure the socket is connected.
    await this.connect()
    // Define the relay URL.
    const relay = this.url
    // Define the timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the publish result.
    return new Promise((resolve, reject) => {
      // Track whether promise has been settled to prevent double resolution.
      let settled = false
      // Cleanup function to remove handler.
      const cleanup = () => { this.off('receipt', handler) }
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error(`publish timeout for ${this.url}`))
      }, timeout)
      // Handler for receipt events.
      const handler = (msg : RelayReceiptMessage) => {
        // Unpack the receipt message.
        const [ _, event_id, ok, reason ] = msg
        // If the event ID matches, resolve the promise.
        if (event_id === event.id) {
          if (settled) return
          settled = true
          // Clear the timeout.
          clearTimeout(timer)
          // Remove the handler.
          cleanup()
          if (ok) resolve({ ok : true, event_id, relay })
          // If the publish failed, reject the promise.
          else reject({ ok : false, event_id, relay, reason })
        }
      }
      // Subscribe to the receipt event.
      this.on('receipt', handler)
      // Publish the event to the relay.
      this.send([ 'EVENT', event ])
    })
  }

  /**
   * Queries the relay for events matching the filters.
   * Creates a temporary subscription that closes after receiving events.
   * @param filters   Event filter(s) to match
   * @param duration  Optional duration in ms to collect events
   * @returns         Promise that resolves with matching events
   */
  public async query (
    filters   : EventFilter | EventFilter[],
    duration? : number
  ) : Promise<SignedEvent[]> {
    // Ensure socket is connected before querying.
    await this.connect()
    // Create a new subscription.
    const sub = new NostrSubscription(filters, this)
    // Return the promise with the results.
    return sub.listen(duration).then((events) => {
      // Unsubscribe from the subscription.
      sub.cancel()
      // Resolve the promise with the events.
      return events
    })
  }

  /**
   * Sends a message to the relay via the message queue.
   * @param msg  The client message to send
   * @throws     Error if the message fails validation
   */
  public send (msg : ClientMessage) {
    // Validate the message.
    validate_client_message(msg)
    // Add the message to the queue.
    this._queue.push(msg)
  }

  /**
   * Creates a persistent subscription to the relay.
   * @param filters  Event filter(s) to subscribe to
   * @returns        Promise that resolves with the active subscription
   * @throws         Error if subscription times out
   */
  public subscribe (
    filters : EventFilter | EventFilter[]
  ) : NostrSubscription {
    // Create a new subscription.
    const sub = new NostrSubscription(filters, this)
    // Add the subscription to the subscriptions map.
    this._subs.set(sub.sub_id, sub)
    // Activate the subscription.
    return sub
  }
}
