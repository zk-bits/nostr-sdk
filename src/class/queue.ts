import { NostrSocket } from '@/class/socket.js'

import type { ClientMessage } from '@/types/index.js'

export class MessageQueue {

  private readonly _socket : NostrSocket

  private _queue : ClientMessage[]       = []
  private _timer : NodeJS.Timeout | null = null

  constructor (socket : NostrSocket) {
    // Initialize the socket.
    this._socket = socket
  }

  get entries () {
    return this._queue
  }

  get size () {
    return this._queue.length
  }

  private _schedule () {
    // If the queue has one entry or less,
    if (this.size <= 1) {
      // Clear the timeout if it exists.
      if (this._timer) clearTimeout(this._timer)
      // Set the timer to null.
      this._timer = null
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
    // Get the first message from the queue.
    const msg = this._queue.shift()
    // If the message is not defined, return.
    if (!msg) return
    // Send the message to the socket.
    this._socket.ws.send(JSON.stringify(msg))
  }

  public clear () {
    // Clear the queue.
    this._queue = []
    // Clear the timeout if it exists.
    if (this._timer) clearTimeout(this._timer)
    // Set the timer to null.
    this._timer = null
  }

  public push (msg : ClientMessage) : void {
    // Add the message to the queue.
    this._queue.push(msg)
    // Schedule the queue processing.
    this._schedule()
  }
}
