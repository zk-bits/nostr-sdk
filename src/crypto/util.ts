import { Buff }           from '@vbyte/buff'
import { base64urlnopad } from '@scure/base'
import { hmac }           from '@noble/hashes/hmac.js'
import { sha256 }         from '@noble/hashes/sha2.js'
import { concatBytes }    from '@noble/hashes/utils.js'

import { extract, expand } from '@noble/hashes/hkdf.js'

const encoder = new TextEncoder()
const decoder = new TextDecoder()

const minPlaintextSize = 0x0001 // 1b msg => padded to 32b
const maxPlaintextSize = 0xffff // 65535 (64kb-1) => padded to 64kb

/**
 * Derives a shared conversation key from a secret using HKDF-SHA256 per NIP-44.
 * @param shared_secret  The shared secret as a hex string
 * @returns              The derived 32-byte conversation key
 */
export function get_conversation_key (shared_secret : string): Uint8Array {
  const secret = Buff.hex(shared_secret)
  return extract(sha256, secret, Buff.str('nip44-v2'))
}

/**
 * Derives ChaCha20 and HMAC keys from a conversation key and nonce.
 * @param convo_key  The 32-byte conversation key
 * @param nonce      The 32-byte nonce
 * @returns          Object containing chacha_key (32 bytes), chacha_nonce (12 bytes), and hmac_key (32 bytes)
 */
export function get_message_keys (
  convo_key : Uint8Array,
  nonce     : Uint8Array,
): { chacha_key: Uint8Array; chacha_nonce: Uint8Array; hmac_key: Uint8Array } {
  const keys = expand(sha256, convo_key, nonce, 76)
  return {
    chacha_key   : keys.subarray(0, 32),
    chacha_nonce : keys.subarray(32, 44),
    hmac_key     : keys.subarray(44, 76),
  }
}

/**
 * Calculates the padded length for plaintext per NIP-44 padding rules.
 * @param len  The unpadded plaintext length
 * @returns    The padded length
 * @throws     Error if len is not a positive integer
 */
export function calc_padded_len (len: number) : number {
  if (!Number.isSafeInteger(len) || len < 1) throw new Error('expected positive integer')
  if (len <= 32) return 32
  const nextPower = 1 << (Math.floor(Math.log2(len - 1)) + 1)
  const chunk = nextPower <= 256 ? 32 : nextPower / 8
  return chunk * (Math.floor((len - 1) / chunk) + 1)
}

/**
 * Writes a 16-bit unsigned integer in big-endian format.
 * @param num  The number to write (1 to 65535)
 * @returns    A 2-byte Uint8Array in big-endian format
 * @throws     Error if num is not between 1 and 65535
 */
export function write_u16_be (num: number) : Uint8Array {
  if (!Number.isSafeInteger(num) || num < minPlaintextSize || num > maxPlaintextSize)
    throw new Error('invalid plaintext size: must be between 1 and 65535 bytes')
  const arr = new Uint8Array(2)
  new DataView(arr.buffer).setUint16(0, num, false)
  return arr
}

/**
 * Pads plaintext with length prefix and null bytes per NIP-44.
 * @param plaintext  The plaintext string to pad
 * @returns          The padded message as a Uint8Array
 */
export function pad_message (plaintext: string) : Uint8Array {
  const unpadded    = encoder.encode(plaintext)
  const unpaddedLen = unpadded.length
  const prefix = write_u16_be(unpaddedLen)
  const suffix = new Uint8Array(calc_padded_len(unpaddedLen) - unpaddedLen)
  return concatBytes(prefix, unpadded, suffix)
}

/**
 * Removes padding from a decrypted message.
 * @param padded  The padded message as a Uint8Array
 * @returns       The unpadded plaintext string
 * @throws        Error if padding is invalid
 */
export function unpad_message (padded: Uint8Array) : string {
  const unpaddedLen = new DataView(padded.buffer).getUint16(0)
  const unpadded = padded.subarray(2, 2 + unpaddedLen)
  if (
    unpaddedLen < minPlaintextSize ||
    unpaddedLen > maxPlaintextSize ||
    unpadded.length !== unpaddedLen ||
    padded.length !== 2 + calc_padded_len(unpaddedLen)
  )
    throw new Error('invalid padding')
  return decoder.decode(unpadded)
}

/**
 * Computes HMAC-SHA256 with additional authenticated data.
 * @param key      The HMAC key
 * @param message  The message to authenticate
 * @param aad      The additional authenticated data (must be 32 bytes)
 * @returns        The HMAC digest
 * @throws         Error if AAD is not 32 bytes
 */
export function hmac_aad (
  key     : Uint8Array,
  message : Uint8Array,
  aad     : Uint8Array
) : Uint8Array {
  if (aad.length !== 32) throw new Error('AAD associated data must be 32 bytes')
  const combined = concatBytes(aad, message)
  return hmac(sha256, key, combined)
}

/**
 * Decodes a base64url-encoded NIP-44 payload into its components.
 * @param payload  The base64url-encoded payload string
 * @returns        Object containing nonce (32 bytes), ciphertext, and mac (32 bytes)
 * @throws         Error if payload is invalid or uses unknown encryption version
 */
export function decode_payload (
  payload: string
) : { nonce: Uint8Array; ciphertext: Uint8Array; mac: Uint8Array } {
  if (typeof payload !== 'string') throw new Error('payload must be a valid string')
  const plen = payload.length
  if (plen < 132 || plen > 87472) throw new Error(`invalid payload length: ${plen}`)
  if (payload[0] === '#') throw new Error('unknown encryption version')
  let data: Uint8Array
  try {
    data = base64urlnopad.decode(payload)
  } catch (error) {
    throw new Error(`invalid base64: ${(error as any).message}`)
  }
  const dlen = data.length
  if (dlen < 99 || dlen > 65603) throw new Error(`invalid data length: ${dlen}`)
  const vers = data[0]
  if (vers !== 2) throw new Error(`unknown encryption version ${vers}`)
  return {
    nonce: data.subarray(1, 33),
    ciphertext: data.subarray(33, -32),
    mac: data.subarray(-32),
  }
}
