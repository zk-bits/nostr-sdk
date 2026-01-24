import { Buff } from '@vbyte/buff'

import { secp256k1 } from '@noble/curves/secp256k1.js'
import { schnorr }   from '@noble/curves/secp256k1.js'

/**
 * Generates a new secret key for use with secp256k1.
 *
 * @param secret   Optional seed value to generate deterministic key.
 *                 WARNING: If provided, must contain at least 128 bits of
 *                 cryptographically random entropy. Low-entropy seeds
 *                 (passwords, timestamps, predictable data) produce insecure
 *                 keys vulnerable to brute-force attacks. When in doubt,
 *                 omit this parameter for secure random generation.
 * @returns        Secret key in hex format
 */
export function gen_seckey (
  secret ?: string
) : string {
  const sbig = (secret !== undefined)
    ? Buff.hex(secret).big
    : Buff.random(32).big
  const reduced = secp256k1.Point.Fn.create(sbig)
  return Buff.big(reduced, 32).hex
}

/**
 * Derives a public key from a secret key using schnorr.
 * @param seckey   Secret key in hex format
 * @returns        Public key in hex format
 */
export function get_pubkey (
  seckey : string
) : string {
  const pbytes = schnorr.getPublicKey(Buff.hex(seckey))
  return new Buff(pbytes).hex
}

/**
 * Computes a shared secret between two parties using ECDH.
 * @param seckey    Local party's secret key in hex format
 * @param peer_pk   Remote party's public key in hex format
 * @returns         Shared secret in hex format
 */
export function get_shared_secret (
  seckey  : string,
  peer_pk : string
) : string {
  const pubkey = (peer_pk.length === 66) ? peer_pk : `02${peer_pk}`
  const sbytes = secp256k1.getSharedSecret(Buff.hex(seckey), Buff.hex(pubkey), true)
  return new Buff(sbytes).slice(1).hex
}

/**
 * Signs a message using Schnorr signature scheme.
 * @param seckey    Secret key in hex format
 * @param message   Message to sign
 * @returns         Signature in hex format
 */
export function create_signature (
  seckey  : string,
  message : string
) {
  const sig = schnorr.sign(Buff.hex(message), Buff.hex(seckey))
  return new Buff(sig).hex
}

/**
 * Verifies a Schnorr signature for a message.
 * @param message    Original message that was signed
 * @param pubkey     Signer's public key in hex format
 * @param signature  Signature to verify in hex format
 * @returns         True if signature is valid, false otherwise
 */
export function verify_signature (
  message   : string,
  pubkey    : string,
  signature : string
) {
  return schnorr.verify(Buff.hex(signature), Buff.hex(message), Buff.hex(pubkey))
}
