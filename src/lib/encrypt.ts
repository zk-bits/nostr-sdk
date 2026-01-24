import { Buff }       from '@vbyte/buff'
import { cbc }        from '@noble/ciphers/aes.js'
import { chacha20 }   from '@noble/ciphers/chacha.js'
import { equalBytes } from '@noble/ciphers/utils.js'

import {
  decode_b64url,
  decode_payload,
  encode_b64url,
  get_conversation_key,
  get_message_keys,
  hmac_aad,
  pad_message,
  unpad_message
} from '@/crypto/index.js'

import {
  concatBytes,
  randomBytes
} from '@noble/hashes/utils.js'

/**
 * Encrypts content using AES-CBC mode (NIP-04).
 * @deprecated NIP-04 is deprecated. Use nip44_encrypt() instead.
 * @param secret    Encryption key in hex format
 * @param content   Content to encrypt
 * @param iv        Optional initialization vector in hex format
 * @returns         Encrypted content in base64url format with IV
 */
export function nip04_encrypt (
  secret  : string,
  content : string,
  iv?     : string
) {
  const cbytes = Buff.str(content)
  const sbytes = Buff.hex(secret)
  const vector = (iv !== undefined)
    ? Buff.hex(iv, 16)
    : Buff.random(16)
  const encrypted   = cbc(sbytes, vector).encrypt(cbytes)
  const enc_message = encode_b64url(encrypted)
  const enc_vector  = encode_b64url(vector)
  return `${enc_message}?iv=${enc_vector}`
}

/**
 * Decrypts AES-GCM encrypted content using provided secret.
 * @param secret    Decryption key in hex format
 * @param content   Encrypted content in base64url format with IV
 * @returns         Decrypted content as string
 */
export function nip04_decrypt (
  secret  : string,
  content : string
) {
  const [ encrypted, iv ] = content.split('?iv=')
  const cbytes = decode_b64url(encrypted)
  const sbytes = Buff.hex(secret)
  const vector = decode_b64url(iv)
  const decrypted = cbc(sbytes, vector).decrypt(cbytes)
  return new Buff(decrypted).str
}

/**
 * Encrypts content using the NIP-44 encryption scheme.
 * @param secret The encryption key in hex format
 * @param plaintext The content to encrypt
 * @param nonce The nonce for the encryption (default is a random 32-byte array)
 * @returns The encrypted content in base64url format with the nonce and MAC  
 */
export function nip44_encrypt (
  secret    : string,
  plaintext : string, 
  nonce     : Uint8Array = randomBytes(32)): string {
  const convo_key  = get_conversation_key(secret)
  const ctx        = get_message_keys(convo_key, nonce)
  const padded     = pad_message(plaintext)
  const ciphertext = chacha20(ctx.chacha_key, ctx.chacha_nonce, padded)
  const mac        = hmac_aad(ctx.hmac_key, ciphertext, nonce)
  return encode_b64url(concatBytes(new Uint8Array([2]), nonce, ciphertext, mac))
}

/**
 * Decrypts encrypted content using the provided secret.
 * @param secret  Decryption key in hex format
 * @param payload Encrypted content in base64url format
 * @returns       Decrypted content as string
 */
export function nip44_decrypt (
  secret  : string,
  payload : string
): string {
  const { nonce, ciphertext, mac } = decode_payload(payload)
  const convo_key      = get_conversation_key(secret)
  const ctx            = get_message_keys(convo_key, nonce)
  const calculated_mac = hmac_aad(ctx.hmac_key, ciphertext, nonce)
  if (!equalBytes(calculated_mac, mac)) throw new Error('invalid MAC')
  const padded = chacha20(ctx.chacha_key, ctx.chacha_nonce, ciphertext)
  return unpad_message(padded)
}
