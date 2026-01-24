/**
 * Shared utilities for the demo CLI.
 */

import * as fs from 'node:fs'
import * as path from 'node:path'

import { gen_seckey, get_pubkey } from '../src/crypto/ecc.js'
import { CREDENTIALS_DIR } from './config.js'

import type { SignedEvent } from '../src/types/index.js'

/* ================ [ Types ] ================ */

export interface DemoArgs {
  name    : string
  port    : number
  relays  : string[]
  verbose : boolean
}

export interface StoredCredential {
  name   : string
  seckey : string
  pubkey : string
}

/* ================ [ Argument Parsing ] ================ */

/**
 * Parses command line arguments.
 * @param args  Command line arguments
 * @returns     Parsed arguments
 */
export function parse_args (args: string[]): DemoArgs {
  const result: DemoArgs = {
    name    : '',
    port    : 8080,
    relays  : [],
    verbose : false
  }

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    switch (arg) {
      case '--name':
      case '-n':
        result.name = args[++i] ?? ''
        break
      case '--port':
      case '-p':
        result.port = parseInt(args[++i] ?? '8080', 10)
        break
      case '--relay':
      case '-r':
        result.relays.push(args[++i] ?? '')
        break
      case '--verbose':
      case '-v':
        result.verbose = true
        break
    }
  }

  return result
}

/* ================ [ Key Storage ] ================ */

/**
 * Ensures the credentials directory exists.
 */
function ensure_credentials_dir (): void {
  if (!fs.existsSync(CREDENTIALS_DIR)) {
    fs.mkdirSync(CREDENTIALS_DIR, { recursive: true })
  }
}

/**
 * Gets the path for a credential file.
 * @param name  Credential name
 * @returns     File path
 */
function get_credential_path (name: string): string {
  return path.join(CREDENTIALS_DIR, `${name}.json`)
}

/**
 * Saves a credential to disk.
 * @param name    Credential name
 * @param seckey  Secret key in hex format
 */
export function save_credential (name: string, seckey: string): void {
  ensure_credentials_dir()
  const pubkey = get_pubkey(seckey)
  const credential: StoredCredential = { name, seckey, pubkey }
  const filepath = get_credential_path(name)
  fs.writeFileSync(filepath, JSON.stringify(credential, null, 2))
}

/**
 * Loads a credential from disk.
 * @param name  Credential name
 * @returns     Stored credential or null if not found
 */
export function load_credential (name: string): StoredCredential | null {
  const filepath = get_credential_path(name)
  if (!fs.existsSync(filepath)) {
    return null
  }
  try {
    const data = fs.readFileSync(filepath, 'utf-8')
    return JSON.parse(data) as StoredCredential
  } catch {
    return null
  }
}

/**
 * Gets or creates a credential by name.
 * @param name  Credential name
 * @returns     Stored credential
 */
export function get_or_create_credential (name: string): StoredCredential {
  const existing = load_credential(name)
  if (existing) {
    return existing
  }
  const seckey = gen_seckey()
  const pubkey = get_pubkey(seckey)
  save_credential(name, seckey)
  return { seckey, pubkey }
}

/**
 * Lists all stored credentials.
 * @returns  Array of credential names
 */
export function list_credentials (): string[] {
  ensure_credentials_dir()
  const files = fs.readdirSync(CREDENTIALS_DIR)
  return files
    .filter(f => f.endsWith('.json'))
    .map(f => f.replace('.json', ''))
}

/* ================ [ Display Helpers ] ================ */

/**
 * Formats a public key for display (truncated).
 * @param pk  Public key in hex format
 * @returns   Truncated public key
 */
export function format_pubkey (pk: string): string {
  return `${pk.slice(0, 8)}...`
}

/**
 * Formats an event ID for display (truncated).
 * @param id  Event ID in hex format
 * @returns   Truncated event ID
 */
export function format_event_id (id: string): string {
  return `${id.slice(0, 8)}...`
}

/**
 * Formats a signed event for display.
 * @param event  Signed event
 * @returns      Formatted string
 */
export function format_event (event: SignedEvent): string {
  const id      = format_event_id(event.id)
  const pubkey  = format_pubkey(event.pubkey)
  const kind    = event.kind
  const content = event.content.length > 50
    ? `${event.content.slice(0, 50)}...`
    : event.content
  return `[${id}] kind:${kind} from:${pubkey} "${content}"`
}

/**
 * Formats a timestamp for display.
 * @param ts  Unix timestamp in seconds
 * @returns   Formatted date string
 */
export function format_timestamp (ts: number): string {
  return new Date(ts * 1000).toLocaleTimeString()
}

/* ================ [ Input Parsing ] ================ */

/**
 * Parses a command line into command and arguments.
 * @param line  Input line
 * @returns     Command and arguments
 */
export function parse_command (line: string): { cmd: string; args: string[] } {
  const parts = line.trim().split(/\s+/)
  const cmd   = parts[0]?.toLowerCase() ?? ''
  const args  = parts.slice(1)
  return { cmd, args }
}

/**
 * Parses key=value options from arguments.
 * @param args  Argument array
 * @returns     Object with parsed options and remaining args
 */
export function parse_options (args: string[]): {
  options: Record<string, string>
  remaining: string[]
} {
  const options: Record<string, string> = {}
  const remaining: string[] = []

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg.startsWith('--')) {
      const key = arg.slice(2)
      const next = args[i + 1]
      if (next && !next.startsWith('--')) {
        options[key] = next
        i++
      } else {
        options[key] = 'true'
      }
    } else {
      remaining.push(arg)
    }
  }

  return { options, remaining }
}
