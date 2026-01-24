/**
 * Connection helper utilities for WebSocket connections.
 * Provides reusable patterns for connection waiting and timeout handling.
 */

export interface WaitForReadyOptions {
  timeout     : number
  ready_event : string
  error_event : string | undefined
  timeout_msg : string
  error_msg   : (err : unknown) => string
}

/** Minimal emitter interface for wait_for_ready. */
interface MinimalEmitter {
  on     : (event : any, handler : any) => void
  off    : (event : any, handler : any) => void
  within : (event : any, handler : any, timeout : number) => void
}

/**
 * Waits for a ready event with timeout and error handling.
 * Cleans up listeners automatically on resolution/rejection.
 * @param emitter  The event emitter to listen on
 * @param options  Configuration for timeout and event names
 * @returns        Promise that resolves when ready or rejects on timeout/error
 */
export function wait_for_ready (
  emitter : MinimalEmitter,
  options : WaitForReadyOptions
) : Promise<void> {
  const { timeout, ready_event, error_event, timeout_msg, error_msg } = options

  return new Promise<void>((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer)
      if (error_event) emitter.off(error_event, onError)
    }
    const onError = (err : unknown) => {
      cleanup()
      reject(new Error(error_msg(err)))
    }
    const timer = setTimeout(() => {
      cleanup()
      reject(new Error(timeout_msg))
    }, timeout)

    if (error_event) emitter.on(error_event, onError)
    emitter.within(ready_event, () => { cleanup(); resolve() }, timeout)
  })
}
