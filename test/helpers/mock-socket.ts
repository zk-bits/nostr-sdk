type EventListener = (event: any) => void

/**
 * Mock WebSocket for unit testing socket-related code.
 * Simulates WebSocket behavior without actual network connections.
 */
export class MockWebSocket {
  static readonly CONNECTING = 0
  static readonly OPEN       = 1
  static readonly CLOSING    = 2
  static readonly CLOSED     = 3

  public readyState: number = MockWebSocket.CONNECTING
  public url: string
  public messages: string[] = []

  private readonly listeners: Map<string, Set<EventListener>> = new Map()

  constructor (url: string) {
    this.url = url
  }

  addEventListener (event: string, handler: EventListener): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)?.add(handler)
  }

  removeEventListener (event: string, handler: EventListener): void {
    this.listeners.get(event)?.delete(handler)
  }

  send (data: string): void {
    if (this.readyState !== MockWebSocket.OPEN) {
      throw new Error('WebSocket is not open')
    }
    this.messages.push(data)
  }

  close (): void {
    this.readyState = MockWebSocket.CLOSING
    setTimeout(() => {
      this.readyState = MockWebSocket.CLOSED
      this._emit('close', {})
    }, 0)
  }

  private _emit (event: string, data: unknown): void {
    this.listeners.get(event)?.forEach(handler => { handler(data) })
  }

  // Test simulation methods

  simulateOpen (): void {
    this.readyState = MockWebSocket.OPEN
    this._emit('open', {})
  }

  simulateMessage (data: unknown): void {
    this._emit('message', { data: JSON.stringify(data) })
  }

  simulateClose (): void {
    this.readyState = MockWebSocket.CLOSED
    this._emit('close', {})
  }

  simulateError (error: Error): void {
    this._emit('error', error)
  }

  clearMessages (): void {
    this.messages = []
  }

  getLastMessage (): string | undefined {
    return this.messages.at(-1)
  }

  getLastMessageParsed <T = unknown> (): T | undefined {
    const msg = this.getLastMessage()
    return msg ? JSON.parse(msg) : undefined
  }
}

/**
 * Creates a mock WebSocket that auto-opens after a delay.
 * @param url    WebSocket URL
 * @param delay  Delay in ms before opening (default: 10)
 * @returns      MockWebSocket instance
 */
export function createAutoOpenMockSocket (
  url: string,
  delay: number = 10
): MockWebSocket {
  const socket = new MockWebSocket(url)
  setTimeout(() => socket.simulateOpen(), delay)
  return socket
}
