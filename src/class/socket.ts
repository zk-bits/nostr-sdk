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
  RelayNoticeMessage
} from '@/types/index.js'

export const SOCKET_CONFIG : NostrSocketConfig = {
  max_retries : 3,
  queue_ival  : 500,
  queue_limit : 10,
  msg_timeout : 5000,
  sub_timeout : 30000
}

export class NostrSocket extends EventEmitter <NostrSocketEvent> {
  private readonly _config : NostrSocketConfig
  private readonly _queue  : MessageQueue
  private readonly _subs   : Map<string, NostrSubscription> = new Map()
  private readonly _url    : string

  private _init : boolean = false
  private _ws   : WebSocket

  constructor (
    host_url : string,
    options  : Partial<NostrSocketConfig> = {}
  ) {
    // Initialize the class.
    super()
    // Initialize the configuration.
    this._config = { ...SOCKET_CONFIG, ...options }
    // Initialize the queue.
    this._queue  = new MessageQueue(this)
    // Initialize the socket.
    this._ws     = new WebSocket(host_url)
    // Define the socket URL.
    this._url    = host_url
    // Register an event listener for the open event.
    this.ws.addEventListener('open', () => this._open())
    // Register an event listener for the close event.
    this.ws.addEventListener('close', () => this._close())
    // Register an event listener for the error event.
    this.ws.addEventListener('error', (event) => this._error(event))
    // Register an event listener for the message event.
    this.ws.addEventListener('message', (event) => this._handler(event.data))
  }

  get config () {
    return this._config
  }

  get is_ready () {
    return this._init
  }

  get subs () {
    return this._subs
  }

  get url () {
    return this._url
  }

  get ws () {
    return this._ws
  }

  private _close () {
    // Unsubscribe from all subscriptions.
    this._subs.forEach(sub => void sub.unsubscribe())
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

  public close (delay : number = 100) {
    // Setup a timer to close the connection.
    setTimeout(() => { 
      // If the websocket connection is open,
      if (this.ws.readyState === WebSocket.OPEN) {
        // Close the websocket connection.
        this.ws.close()
      }
    }, delay)
  }

  public async connect () : Promise<void> {
    // If the socket is already connected, return.
    if (this.is_ready) return
    // Define the connection timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the connection.
    return new Promise((resolve, reject) => {
      // Set a timeout to reject the promise if the connection times out.
      const timer = setTimeout(() => reject('connection timeout'), timeout)
      // Connect the socket.
      this.within('ready', () => {
        // Clear the timeout.
        clearTimeout(timer)
        // Resolve the promise.
        resolve()
      }, timeout)
    })
  }

  // Return a promise to resolve the publish result.
  public async publish (event : SignedEvent) : Promise<PublishResponse> {
    // Make sure the socket is connected.
    await this.connect()
    // Define the relay URL.
    const relay = this.url
    // Define the timeout.
    const timeout = this.config.msg_timeout
    // Create a promise to resolve the publish result.
    return new Promise((resolve, reject) => {
      // Set a timeout to reject the promise if the request times out.
      const timer = setTimeout(() => reject('timeout'), timeout)
      // Subscribe to the receipt event.
      this.within('receipt', (msg : RelayReceiptMessage) => {
        // Unpack the receipt message.
        const [ _, event_id, ok, reason ] = msg
        // If the event ID matches, resolve the promise.
        if (event_id === event.id) {
          // Clear the timeout.
          clearTimeout(timer)
          if (ok) resolve({ ok : true, event_id, relay })
          // If the publish failed, reject the promise.
          else reject({ ok : false, event_id, relay, reason })
        }
      }, timeout)
      // Publish the event to the relay.
      this.send([ 'EVENT', event ])
    })
  }

  public async query (
    filters   : EventFilter | EventFilter[],
    duration? : number
  ) : Promise<SignedEvent[]> {
    // Make sure the socket is connected.
    await this.connect()
    // Create a new subscription.
    const sub = new NostrSubscription(filters, this)
    // Return the promise with the results.
    return sub.listen(duration).then((events) => {
      // Unsubscribe from the subscription.
      sub.unsubscribe()
      // Resolve the promise with the events.
      return events
    })
  }

  // Send a message to the relay.
  public send (msg : ClientMessage) {
    // Validate the message.
    validate_client_message(msg)
    // Add the message to the queue.
    this._queue.push(msg)
  }

  // Return a promise to resolve the subscription ID.
  public async subscribe (
    filters : EventFilter | EventFilter[]
  ) : Promise<NostrSubscription> {
    // Make sure the socket is connected.
    await this.connect()
    // Create a new subscription.
    const sub = new NostrSubscription(filters, this)
    // Add the subscription to the subscriptions map.
    this._subs.set(sub.id, sub)
    // Activate the subscription.
    return sub.subscribe()
  }
}
