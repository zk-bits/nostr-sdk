import { Buff }          from '@vbyte/buff'
import { encode_b64url } from '@/crypto/encode.js'

import type { Result } from '@/types/index.js'

export function generate_hash (size : number = 32) {
  return Buff.random(size).hex
}

export function generate_label (size : number = 16) {
  return encode_b64url(Buff.random(size))
}

export function exec <T = any> (fn : () => T) : Result<T> {
  try {
    const data = fn()
    return { ok : true, result: data, error : null }
  } catch (error) {
    return { ok : false, result : null, error : parse_error(error) }
  }
}

export function now () {
  return Math.floor(Date.now() / 1000)
}

export function parse_error (error : unknown) : string {
  return (error instanceof Error) ? error.message : String(error)
}

export function sleep (ms : number) : Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
