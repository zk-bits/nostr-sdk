import { Buff }          from '@vbyte/buff'
import { encode_b64url } from '@/crypto/encode.js'

import type { Result } from '@/types/index.js'

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
