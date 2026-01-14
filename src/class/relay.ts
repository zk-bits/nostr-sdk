import { EventCache }   from '@/class/cache.js'
import { EventEmitter } from '@/class/emitter.js'
import { RELAY_PORT }   from '@/const.js'

import {
  WebSocket,
  WebSocketServer
} from 'ws'

import {
  generate_hash,
  parse_client_message,
  validate_relay_message,
  verify_event,
  match_filter,
  parse_error
} from '@/lib/index.js'

import {
  ClientCloseMessage,
  ClientEventMessage,
  ClientRequestMessage,
  EventFilter,
  RelayConfig,
  RelayMessage,
  SignedEvent
} from '@/types/index.js'


export const RELAY_CONFIG : RelayConfig = {
  debug      : false,
  max_events : 1000,
  purge_ival : null,
  timeout    : 5000,
  verbose    : false
}

/* ================ [ Server Class ] ================ */

export class NostrRelay extends EventEmitter<{
  closed : [ void ],
  ready  : [ void ]
}> {
  private readonly _cache    : EventCache
  private readonly _config   : RelayConfig
  private readonly _filters  : Map<string, EventFilter[]> = new Map()
  private readonly _sessions : Map<string, ClientSession> = new Map()
  private readonly _subs     : Map<string, string>        = new Map()

  private _ready : boolean = false
  private _timer : NodeJS.Timeout  | undefined
  private _wss   : WebSocketServer | null = null

  constructor (options : Partial<RelayConfig> = {}) {
    super()

    this._config = { ...RELAY_CONFIG, ...options }
    this._cache  = new EventCache()
    this._subs   = new Map()
    this._wss    = null
  }

  get cache () {
    return this._cache
  }

  get config () {
    return this._config
  }

  get ready () {
    return this._ready
  }

  get sessions () {
    return this._sessions
  }

  get subs () {
    return this._subs
  }

  get wss () {
    if (this._wss === null) {
      throw new Error('websocket server not initialized')
    }
    return this._wss
  }

  get log () {
    return {
      debug : (...msg : any[]) => this.config.debug   && console.log('[ relay ]', ...msg),
      info  : (...msg : any[]) => this.config.verbose && console.log('[ relay ]', ...msg),
    }
  }

  _close () {
    // For each active session:
    for (const [ _, session ] of this.sessions) {
      // Close the session.
      session.socket.close()
    }
    // Clear the sessions.
    this._sessions.clear()
    // Clear the subscriptions.
    this._subs.clear()
    // Clear the filters.
    this._filters.clear()
    // Clear the cache.
    this._cache.clear()
    // Clear the timer.
    clearInterval(this._timer)
    // Clear the websocket server.
    this._wss   = null
    // Set the relay to not ready.
    this._ready = false
    // Emit the close event.
    this.emit('closed')
    // Print the close message.
    this.log.info('relay closed')
  }

  _error (err : Error) {
    // Print the error message.
    this.log.info('websocket server encountered an error:\n\n', parse_error(err))
    // If debug mode is enabled, log the error to console.
    if (this.config.debug) console.error(err)
  }

  _init () {
    // Define the purge interval.
    const purge_ival = this.config.purge_ival
    // If purge interval is set,
    if (purge_ival !== null) {
      // Clear the existing timer if it exists.
      clearInterval(this._timer)
      // Set a new timer to purge the cache.
      this._timer = setInterval(() => this.cache.clear(), purge_ival * 1000).unref()
      // Print the purge interval.
      this.log.info(`purging events every ${purge_ival} seconds`)
    }
    // Set the relay to initialized.
    this._ready = true
    // Print the relay ready message.
    this.log.info('relay is listening...')
    // Emit the ready event.
    this.emit('ready')
  }

  _create_session (socket : WebSocket) {
    // Generate a new client ID.
    const client_id = generate_hash(8)
    // Create a new client session.
    const session = new ClientSession(this, client_id, socket)
    // Add the session to the map.
    this._sessions.set(client_id, session)
  }

  _startup (options : Partial<WebSocket.ServerOptions> = {}) {
    // Get the server configuration.
    const config = create_server_config(options)
    // Create a new websocket server.
    this._wss = new WebSocketServer(config)
    // On connection, create a new client session.
    this.wss.on('connection', socket => this._create_session(socket))
    // On listening, initialize the relay.
    this.wss.once('listening', () => this._init())
    // On error, close the relay.
    this.wss.on('error', err => this._error(err))
    // On close, close the relay.
    this.wss.on('close', () => this._close())
    // Print the relay startup message.
    this.log.info('relay starting up...')
  }

  disconnect (client_id : string) {
    // Delete the session.
    this._sessions.delete(client_id)
    // For each subscription:
    for (const [ sub_id, session_id ] of this._subs) {
      // If the session ID matches the client ID:
      if (session_id === client_id) {
        // Delete the subscription filters.
        this._filters.delete(sub_id)
        // Delete the subscription references.
        this._subs.delete(sub_id)
      }
    }
    // Send a receipt message.
    this.log.info('client disconnected:', client_id)
  }

  publish (event : SignedEvent) {
    // Cache the event.
    this.cache.add(event)
    // For each subscription:
    for (const [ sub_id, filters ] of this._filters) {
      // Get the client ID for the subscription.
      const client_id = this._subs.get(sub_id)
      // If the client ID is not found, continue.
      if (!client_id) continue
      // Get the session for the client ID.
      const session = this._sessions.get(client_id)
      // If the session is not found, continue.
      if (!session) continue
      // Get the events from the cache.
      if (match_filter(event, filters)) {
        // Send the event to the client.
        session.send([ 'EVENT', sub_id, event ])
      }
    }
  }
  
  async start (options : Partial<WebSocket.ServerOptions> = {}) : Promise<void> {
    // Return a promise to resolve the startup.
    return new Promise<void>((resolve, reject) => {
      // Set a timeout to reject the promise if the startup times out.
      const timer = setTimeout(() => reject('startup timeout'), this.config.timeout)
      // On ready, resolve the promise.
      this.once('ready', () => { clearTimeout(timer); resolve() })
      // On closed, reject the promise.
      this.once('closed', reason => { clearTimeout(timer); reject(reason) })
      // Start the relay.
      this._startup(options)
    }).catch(err => { throw new Error(err) })
  }

  stop () {
    // If the relay is not ready, return.
    if (!this.ready) return
    // Print the stop message.
    this.log.info('relay stopping...')
    // Close the websocket server.
    this.wss.close()
  }

  subscribe (client_id : string, sub_id : string, filters : EventFilter[]) {
    // If the client is not found, return.
    if (!this._sessions.has(client_id)) return
    // Add the subscription filters to the filters map.
    this._filters.set(sub_id, filters)
    // Add the subscription ID to the subscriptions map.
    this._subs.set(sub_id, client_id)
  }

  unsubscribe (sub_id : string) {
    // Delete the subscription filters.
    this._filters.delete(sub_id)
    // Delete the subscription references.
    this._subs.delete(sub_id)
  }
}

export class ClientSession {

  private readonly _id     : string
  private readonly _relay  : NostrRelay
  private readonly _socket : WebSocket

  constructor (
    relay     : NostrRelay,
    client_id : string,
    socket    : WebSocket
  ) {
    this._id     = client_id
    this._relay  = relay
    this._socket = socket

    this.socket.on('message', msg => this._handler(msg.toString()))
    this.socket.on('error',   err => this._on_error(err))
    this.socket.on('close',   _   => this._relay.disconnect(this.id))
    
    this.log.info('client connected:', this.id, socket.url)
  }

  get id () {
    return this._id
  }

  get relay () {
    return this._relay
  }

  get socket () {
    return this._socket
  }

  _handler (message : unknown) {
    try {
      // Log the message.
      this.log.debug('received message:', message)
      // Parse the message.
      const parsed = parse_client_message(message)
      // If the message is not valid, return a notice.
      if (!parsed.ok) {
        // If debug mode is enabled, log the error.
        if (this.relay.config.debug) console.error(parsed.error)
        // Send a notice.
        return this.send(['NOTICE', 'unable to parse message'])
      }
      // Handle the message based on the type.
      switch (parsed.result[0]) {
        case 'REQ':
          return this._on_request(parsed.result)
        case 'EVENT':
          return this._on_event(parsed.result)
        case 'CLOSE':
          return this._on_unsub(parsed.result)
        default:
          this.log.info('unable to handle message type:', parsed.result[0])
          return this.send([ 'NOTICE', 'invalid message type' ])
      }
    } catch (err) {
      // If debug mode is enabled, log the error.
      if (this.relay.config.debug) console.error(err)
      // Send a notice to the client.
      return this.send([ 'NOTICE', 'server encountered an error' ])
    }
  }

  _on_unsub (message : ClientCloseMessage) {
    // Destructure the message.
    const [ _, sub_id ] = message
    // Remove the subscription.
    this.relay.unsubscribe(sub_id)
    // Log the closed subscription.
    this.log.info('closed subscription:', sub_id)
    // Send a receipt message.
    this.send([ 'CLOSED', sub_id, 'subscription closed' ])
  }

  _on_error (err : Error) {
    this.log.info('socket encountered an error:\n\n', parse_error(err))
    if (this.relay.config.debug) console.error(err)
  }

  _on_event (message : ClientEventMessage) {
    // Destructure the message.
    const [ _, event ] = message
    // Verify the event.
    const err = verify_event(event)
    // If the event is valid,
    if (err === null) {
      // Send a receipt message.
      this.send([ 'OK', event.id, true, '' ])
      // Publish the event to the relay.
      this.relay.publish(event)
    } else {
      // Send a receipt message.
      this.send([ 'OK', event.id, false, err ])
    }
  }

  _on_request (message : ClientRequestMessage) : void {
    // Destructure the message.
    const [ _, sub_id, ...filters ] = message
    // Subscribe to the subscription.
    this.relay.subscribe(this.id, sub_id, filters)
    // Get the events from the cache.
    const events = this.relay.cache.filter(filters)
    // For each event:
    for (const event of events) {
      // Send the event to the client.
      this.send([ 'EVENT', sub_id, event ])
    }
    // Send an end of subscription event.
    this.send(['EOSE', sub_id ])
  }

  get log () {
    return {
      debug : (...msg : any[]) => this._relay.config.debug   && console.log(`[ session/${this.id} ]`, ...msg),
      info  : (...msg : any[]) => this._relay.config.verbose && console.log(`[ session/${this.id} ]`, ...msg),
    }
  }

  send (message : RelayMessage) {
    // Log the message.
    this.log.debug('sending message:', message)
    // Validate the message.
    validate_relay_message(message)
    // Send the message.
    this._socket.send(JSON.stringify(message))
  }
}

function create_server_config (
  options : Partial<WebSocket.ServerOptions> = {}
) : WebSocket.ServerOptions {
  // If neither port nor server is provided,
  if (options.port === undefined && options.server === undefined) {
    // Set the port to the default port.
    options.port = RELAY_PORT
  }
  // Return the options.
  return options
}
