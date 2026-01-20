/**
 * Type-safe event emitter that handles synchronous and asynchronous event subscriptions.
 * Provides a robust event system with support for one-time events, timeouts, and wildcard handlers.
 * @template T Record of event names mapped to their payload types (array of parameters)
 */
export class EventEmitter<T extends Record<string, any[]> = {}> {
  private readonly eventMap: Map<keyof T | '*', Set<Function>>
  /** Maps original handlers to their wrapper functions for once() cleanup. */
  private readonly wrapperMap: WeakMap<Function, Function>

  constructor() {
    this.eventMap = new Map()
    this.wrapperMap = new WeakMap()
  }

  /**
   * Gets or creates a Set of event handlers for the given event.
   * @private
   * @param eventName  Name of the event to get handlers for
   * @returns          Set of handler functions for the event
   */
  private getEventHandlers(eventName: string): Set<Function> {
    const handlers = this.eventMap.get(eventName)
    if (!handlers) {
      const newHandlers = new Set<Function>()
      this.eventMap.set(eventName, newHandlers)
      return newHandlers
    }
    return handlers
  }

  /**
   * Checks if an event has any active subscribers.
   * @param eventName  Name of the event to check
   * @returns         True if the event has subscribers, false otherwise
   */
  public has <K extends keyof T> (eventName : K) : boolean {
    const handlers = this.eventMap.get(eventName)
    return handlers !== undefined && handlers.size > 0
  }

  public all <K extends keyof T> (
    handler : (topic : keyof T, ...args: T[K]) => void | Promise<void>
  ) : void {
    this.getEventHandlers('*').add(handler)
  }

  /**
   * Subscribes a handler function to an event.
   * @param eventName  Name of the event to subscribe to
   * @param handler    Function to be called when event is emitted
   * @emits message   When the subscribed event is emitted
   */
  public on <K extends keyof T> (
    eventName : K,
    handler   : (...args: T[K]) => void | Promise<void>
  ): void {
    this.getEventHandlers(eventName as string).add(handler)
  }

  /**
   * Subscribes a one-time handler that automatically unsubscribes after first execution.
   * @param eventName  Name of the event to subscribe to
   * @param handler    Function to be called once when event is emitted
   * @emits message   When the subscribed event is emitted (only once)
   */
  public once <K extends keyof T> (
    eventName : K,
    handler   : (...args: T[K]) => void | Promise<void>
  ): void {
    const oneTimeHandler = (...args: T[K]): void => {
      this.wrapperMap.delete(handler)
      this.off(eventName, oneTimeHandler)
      void handler(...args)
    }
    // Store mapping so off() can remove the wrapper using the original handler
    this.wrapperMap.set(handler, oneTimeHandler)
    this.on(eventName, oneTimeHandler)
  }

  /**
   * Subscribes a handler that automatically unsubscribes after a specified timeout.
   * @param eventName  Name of the event to subscribe to
   * @param handler    Function to be called when event is emitted
   * @param timeoutMs  Time in milliseconds after which the handler is unsubscribed
   * @emits message   When the subscribed event is emitted (within timeout period)
   */
  public within <K extends keyof T> (
    eventName : K,
    handler   : (...args: T[K]) => void | Promise<void>,
    timeoutMs : number
  ): void {
    const timeoutHandler = (...args: T[K]): void => {
      void handler(...args)
    }

    const timer = setTimeout(() => {
      this.off(eventName, timeoutHandler)
    }, timeoutMs)
    if (typeof timer.unref === 'function') timer.unref()

    this.on(eventName, timeoutHandler)
  }

  /**
   * Emits an event with the given parameters to all subscribers.
   * Handles both synchronous and asynchronous event handlers.
   * @param eventName  Name of the event to emit
   * @param args       Parameters to be passed to event handlers
   * @emits *         Also triggers wildcard handlers with event name and parameters
   */
  public emit <K extends keyof T> (
    eventName : K,
    ...args   : T[K]
  ): void {
    const promises: Promise<any>[] = []

    // Call wildcard handlers
    this.getEventHandlers('*').forEach(handler => {
      const result = handler(eventName, ...args)
      if (result instanceof Promise) {
        promises.push(result)
      }
    })

    // Call specific event handlers
    this.getEventHandlers(eventName as string).forEach(handler => {
      const result = handler(...args)
      if (result instanceof Promise) {
        promises.push(result)
      }
    });

    void Promise.allSettled(promises)
  }

  /**
   * Removes a specific handler from an event's subscriber list.
   * @param eventName  Name of the event to unsubscribe from
   * @param handler    Handler function to remove
   */
  public off <K extends keyof T> (
    eventName : K,
    handler   : (...args: T[K]) => void | Promise<void>
  ) : void {
    const handlers = this.getEventHandlers(eventName as string)
    // Try to remove the handler directly
    if (handlers.delete(handler)) return
    // If not found, check if it's a wrapped handler (from once())
    const wrapper = this.wrapperMap.get(handler)
    if (wrapper) {
      handlers.delete(wrapper)
      this.wrapperMap.delete(handler)
    }
  }
}
