import { NostrSocket } from '@/class/socket.js'

import type { ClientMessage } from '@/types/index.js'

/**
 * Rate-limited message queue for sending messages to a relay.
 * Batches messages and sends them at a configurable interval to avoid flooding.
 */
export class MessageQueue {

  private readonly _socket : NostrSocket

  private _queue : ClientMessage[] = []
  private _timer : NodeJS.Timeout | undefined

  /**
   * Creates a new message queue.
   * @param socket  The NostrSocket to send messages through
   */
  constructor (socket : NostrSocket) {
    // Initialize the socket.
    this._socket = socket
  }

  /** Array of queued messages. */
  get entries () {
    return this._queue
  }

  /** Number of messages in the queue. */
  get size () {
    return this._queue.length
  }

  private _schedule () {
    // If the queue has one entry or less,
    if (this.size <= 1) {
      // Clear the timeout if it exists.
      clearTimeout(this._timer)
    } else {
      // Get the queue interval.
      const ival = this._socket.config.queue_ival
      // Set a new timeout.
      this._timer = setTimeout(() => this._schedule(), ival)
    }
    // Process the queue.
    this._process()
  }

  private _process () {
    // If the queue is empty, return.
    if (this.size === 0) return
    // Check WebSocket is open before sending.
    if (this._socket.ws.readyState !== WebSocket.OPEN) return
    // Get the first message from the queue.
    const msg = this._queue.shift()
    // If the message is not defined, return.
    if (!msg) return
    // Send the message to the socket.
    try {
      this._socket._send(msg)
    } catch {
      // Re-queue the message on failure.
      this._queue.unshift(msg)
    }
  }

  /** Clears all pending messages from the queue. */
  public clear () {
    // Clear the queue.
    this._queue = []
    // Clear the timeout if it exists.
    clearTimeout(this._timer)
  }

  /**
   * Adds a message to the queue for sending.
   * @param msg  The client message to queue
   */
  public push (msg : ClientMessage) : void {
    // Add the message to the queue.
    this._queue.push(msg)
    // Schedule the queue processing.
    this._schedule()
  }
}
