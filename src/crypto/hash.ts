import { Buff }   from '@vbyte/buff'
import { sha256 } from '@noble/hashes/sha2.js'

import type { Bytes } from '@vbyte/buff'

/**
 * Hashes a list of messages using SHA-256.
 * @param messages  List of messages to hash
 * @returns         SHA-256 hash of the concatenated messages
 */
export function hash_message (
  ...messages : Bytes[]
) : string {
  const bytes = Buff.join(messages)
  return new Buff(sha256(bytes)).hex
}
