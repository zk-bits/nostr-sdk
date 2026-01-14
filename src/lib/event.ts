import { Buff } from '@vbyte/buff'
import { now }  from '@/lib/index.js'

import {
  hash_message,
  create_signature,
  verify_signature
} from '@/crypto/index.js'

import type {
  EventConfig,
  EventTemplate,
  SignedEvent
} from '@/types/index.js'

import * as Schema from '@/schema/index.js'

/**
 * Creates a note template from a configuration object.
 * @param config   Note configuration
 * @returns        Note template
 */
export function create_event (config : EventConfig) : EventTemplate {
  return Schema.EVENT.template.parse({
    ...config,
    created_at : config.created_at ?? now(),
    tags       : config.tags       ?? [],
  })
}

/**
 * Calculates a unique event ID based on the event template properties.
 * Creates a hash of the stringified array containing event details.
 * @param template  Nostr event template containing event properties
 * @returns        Hexadecimal hash string representing the event ID
 */
export function get_event_id (template : EventTemplate) : string {
  const preimg = JSON.stringify([
    0,
    template.pubkey,
    template.created_at,
    template.kind,
    template.tags,
    template.content,
  ])
  const bytes = Buff.str(preimg)
  return hash_message(bytes)
}

/**
 * Signs a Nostr event with the provided secret key.
 * @param seckey    Secret key in hex format
 * @param template  Event template to sign
 * @returns         Signed event with ID and signature
 */
export function sign_event (
  template : EventTemplate,
  seckey   : string
) : SignedEvent {
  const id  = get_event_id(template)
  const sig = create_signature(seckey, id)
  return { ...template, id, sig }
}

/**
 * Verifies a signed Nostr event's integrity and signature.
 * @param event    Signed event to verify
 * @returns        Error message if validation fails, null if valid
 */
export function verify_event (event : SignedEvent) : string | null {
  const { id, sig, ...template } = event
  const parsed = Schema.EVENT.signed.safeParse(event)
  const chk_id = get_event_id(template)
  if (!parsed.success) {
    return 'note failed schema validation'
  } else if (id !== chk_id) {
    return 'note id mismatch'
  } else if (!verify_signature(id, event.pubkey, sig)) {
    return 'invalid note signature'
  } else {
    return null
  }
}

/**
 * Returns the first tag of a specific type from an event.
 * @param note  Note template to search for tags
 * @param tag   Tag identifier to filter by (e.g., 'p' for pubkey tags)
 * @returns     First matching tag entry
 */
export function get_event_tag (
  event : EventTemplate,
  tag   : string
) : string[] | undefined {
  return event.tags.find(e => e.at(0) === tag)
}

/**
 * Filters and returns all tags of a specific type from an event.
 * @param note  Note template to search for tags
 * @param tag   Tag identifier to filter by (e.g., 'p' for pubkey tags)
 * @returns     Array of matching tag entries
 */
export function filter_event_tags (
  event : EventTemplate,
  tag   : string
) : string[][] {
  return event.tags.filter(e => e.at(0) === tag)
}

/**
 * Checks if a specific pubkey is a recipient of an event.
 * Verifies if the pubkey exists in the event's 'p' tags.
 * @param note    Signed note to check
 * @param pubkey  Public key to look for
 * @returns       True if pubkey is a recipient, false otherwise
 */
export function is_event_recipient (
  event  : SignedEvent,
  pubkey : string
) {
  // verify event is directed at you.
  const peers = filter_event_tags(event, 'p')
  // check if pubkey exists
  return peers.some(e => e[1] === pubkey)
}

/**
 * Checks if a signed Nostr event has expired.
 * @param event    Signed event to check
 * @param current  Current timestamp
 * @returns        True if event has expired, false otherwise
 */
export function is_event_expired (
  event   : SignedEvent,
  current : number = now()
) : boolean {
  const tag     = get_event_tag(event, 'expiration') ?? []
  const label   = tag.at(0)
  const expires = Number(tag.at(1))
  if (label !== 'expiration') return false
  if (Number.isNaN(expires))  return false
  if (expires > current)      return false
  return true
}