#!/usr/bin/env tsx
/**
 * Key generation utility for demo purposes.
 * Usage: tsx demo/keygen.ts [name]
 */

import { gen_seckey, get_pubkey } from '../src/crypto/ecc.js'
import {
  save_credential,
  load_credential,
  list_credentials,
  format_pubkey
} from './shared.js'
import { COLORS } from './config.js'

const c = COLORS

const log = {
  info    : (msg: string) => console.log(`${c.cyan}[info]${c.reset} ${msg}`),
  success : (msg: string) => console.log(`${c.green}[ok]${c.reset} ${msg}`),
  error   : (msg: string) => console.log(`${c.red}[error]${c.reset} ${msg}`),
  plain   : (msg: string) => console.log(msg)
}

function main () {
  const args = process.argv.slice(2)
  const cmd  = args[0]

  if (cmd === 'list' || cmd === '-l') {
    const names = list_credentials()
    if (names.length === 0) {
      log.info('No stored credentials')
    } else {
      log.info('Stored credentials:')
      for (const name of names) {
        const cred = load_credential(name)
        if (cred) {
          log.plain(`  ${name}: ${format_pubkey(cred.pubkey)}`)
        }
      }
    }
    return
  }

  if (cmd === 'show' && args[1]) {
    const name = args[1]
    const cred = load_credential(name)
    if (!cred) {
      log.error(`Not found: ${name}`)
      process.exit(1)
    }
    log.info(`Credential: ${name}`)
    log.plain(`  Pubkey: ${cred.pubkey}`)
    log.plain(`  Secret: ${cred.seckey}`)
    return
  }

  if (cmd === 'new' || !cmd) {
    const name   = args[1] ?? `key-${Date.now()}`
    const seckey = gen_seckey()
    const pubkey = get_pubkey(seckey)

    if (args[1]) {
      save_credential(name, seckey)
      log.success(`Created: ${name}`)
    } else {
      log.success('Generated keypair')
    }

    log.plain(`  Pubkey: ${pubkey}`)
    log.plain(`  Secret: ${seckey}`)
    return
  }

  // Default: show or create by name
  const name = cmd
  let cred = load_credential(name)

  if (cred) {
    log.info(`Existing: ${name}`)
  } else {
    const seckey = gen_seckey()
    save_credential(name, seckey)
    cred = { seckey, pubkey: get_pubkey(seckey) }
    log.success(`Created: ${name}`)
  }

  log.plain(`  Pubkey: ${cred.pubkey}`)
  log.plain(`  Secret: ${cred.seckey}`)
}

main()
