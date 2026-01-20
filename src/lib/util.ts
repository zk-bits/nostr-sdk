import { Buff }          from '@vbyte/buff'
import { encode_b64url } from '@/crypto/encode.js'

import type { RelayFailure, Result } from '@/types/index.js'

/**
 * Generates a random hex-encoded hash.
 * @param size  Number of random bytes (default: 32)
 * @returns     Hex-encoded random string
 */
export function generate_hash (size : number = 32) {
  return Buff.random(size).hex
}

/**
 * Generates a random URL-safe base64 label.
 * @param size  Number of random bytes (default: 16)
 * @returns     URL-safe base64 encoded string
 */
export function generate_label (size : number = 16) {
  return encode_b64url(Buff.random(size))
}

/**
 * Executes a function and wraps the result in a Result object.
 * @param fn  Function to execute
 * @returns   Result object with ok, result, and error properties
 */
export function exec <T = any> (fn : () => T) : Result<T> {
  try {
    const data = fn()
    return { ok : true, result: data, error : null }
  } catch (error) {
    return { ok : false, result : null, error : parse_error(error) }
  }
}

/**
 * Returns the current Unix timestamp in seconds.
 * @returns  Unix timestamp
 */
export function now () {
  return Math.floor(Date.now() / 1000)
}

/**
 * Extracts error message from an unknown error value.
 * @param error  The error to parse
 * @returns      Error message string
 */
export function parse_error (error : unknown) : string {
  return (error instanceof Error) ? error.message : String(error)
}

/**
 * Returns a promise that resolves after the specified delay.
 * @param ms  Delay in milliseconds
 * @returns   Promise that resolves after the delay
 */
export function sleep (ms : number) : Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Like Promise.any(), but wraps AggregateError with context about which relays failed.
 * @param promises   Array of promises to race
 * @param operation  Name of the operation (e.g., 'connect', 'publish', 'query')
 * @param sockets    Optional array of sockets with url property for failure context
 * @returns          Promise that resolves with the first successful result
 * @throws           Error with detailed failure information if all promises reject
 */
export async function promise_any_with_context<T> (
  promises  : Promise<T>[],
  operation : string,
  sockets?  : { url: string }[]
) : Promise<T> {
  try {
    return await Promise.any(promises)
  } catch (err) {
    if (err instanceof AggregateError) {
      const failures : RelayFailure[] = err.errors.map((e, i) => ({
        relay  : sockets?.[i]?.url ?? `relay ${i}`,
        reason : parse_error(e)
      }))
      // Count occurrences of each error reason.
      const counts = new Map<string, number>()
      for (const f of failures) {
        const key = f.reason
        counts.set(key, (counts.get(key) ?? 0) + 1)
      }
      // Format error summary.
      const summary = Array.from(counts.entries())
        .map(([ reason, count ]) => `${count}x ${reason}`)
        .join(', ')
      const error = new Error(
        `${operation} failed: all ${failures.length} relays rejected (${summary})`
      )
      ;(error as any).failures = failures
      throw error
    }
    throw err
  }
}
