#!/usr/bin/env tsx
/**
 * Interactive CLI node for demo purposes.
 * Usage: tsx demo/node.ts [--name alice] [--relay ws://...]
 */

import * as readline from 'node:readline'

import {
  parse_args,
  parse_command,
  get_or_create_credential,
  load_credential,
  format_pubkey
} from './shared.js'

import { DEFAULT_RELAY, PROMPT_CHAR, COLORS } from './config.js'
import { dispatch, create_context, } from './commands/index.js'
import { start_p2p } from './commands/rpc.js'

/** Demo peer names that get auto-registered. */
const DEMO_PEERS = ['alice', 'bob', 'carol']

/** Global readline interface for async-safe logging. */
let rl: readline.Interface | null = null
let currentPrompt = ''

/**
 * Async-safe logging that works with readline.
 * Clears the current line, prints the message, then restores the prompt.
 */
function createLogger () {
  const c = COLORS

  const write = (prefix: string, color: string, msg: string) => {
    if (rl && process.stdout.isTTY) {
      // Clear current line and move cursor to start
      readline.clearLine(process.stdout, 0)
      readline.cursorTo(process.stdout, 0)
    }

    // Print the message
    console.log(`${color}${prefix}${c.reset} ${msg}`)

    // Restore prompt if readline is active
    if (rl && process.stdout.isTTY) {
      rl.prompt(true)
    }
  }

  return {
    info    : (msg: string) => write('[info]', c.cyan, msg),
    send    : (msg: string) => write('[send]', c.magenta, msg),
    recv    : (msg: string) => write('[recv]', c.blue, msg),
    success : (msg: string) => write('[ok]', c.green, msg),
    error   : (msg: string) => write('[error]', c.red, msg),
    warn    : (msg: string) => write('[warn]', c.yellow, msg),
    event   : (msg: string) => write('[event]', c.green, msg),
    plain   : (msg: string) => {
      if (rl && process.stdout.isTTY) {
        readline.clearLine(process.stdout, 0)
        readline.cursorTo(process.stdout, 0)
      }
      console.log(msg)
      if (rl && process.stdout.isTTY) {
        rl.prompt(true)
      }
    }
  }
}

// Create the logger and export it for use in commands
export const log = createLogger()

async function main () {
  const args = parse_args(process.argv.slice(2))

  // Get or generate identity
  const name = args.name || `node-${Date.now()}`
  const cred = get_or_create_credential(name)

  // Create context
  const ctx = create_context(name, cred.seckey, cred.pubkey)

  // Auto-register demo peers (excluding self)
  for (const peerName of DEMO_PEERS) {
    if (peerName === name) continue
    const peerCred = load_credential(peerName)
    if (peerCred) {
      ctx.peers.set(peerName, peerCred.pubkey)
    }
  }

  // Print welcome message
  console.clear()
  console.log(`${COLORS.cyan}[info]${COLORS.reset} @vbyte/nostr-sdk Demo`)
  console.log(`  Identity: ${name} (${format_pubkey(cred.pubkey)})`)

  if (ctx.peers.size > 0) {
    const peerNames = Array.from(ctx.peers.keys()).join(', ')
    console.log(`  Peers: ${peerNames}`)
  }
  console.log('')

  // Create readline interface
  currentPrompt = `${name}${PROMPT_CHAR}`
  rl = readline.createInterface({
    input  : process.stdin,
    output : process.stdout,
    prompt : currentPrompt
  })

  // Handle graceful shutdown
  const shutdown = async () => {
    ctx.running = false

    // Cancel subscriptions
    for (const [_, sub] of ctx.subscriptions) {
      sub.cancel()
    }

    // Close node
    ctx.node?.close()

    rl?.close()
    rl = null

    console.log(`\n${COLORS.cyan}[info]${COLORS.reset} Goodbye!`)
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  // Auto-start P2P mode
  const relay = args.relays[0] || DEFAULT_RELAY
  console.log(`${COLORS.cyan}[info]${COLORS.reset} Connecting to ${relay}...`)

  try {
    await start_p2p(ctx, relay, log)
    console.log(`${COLORS.green}[ok]${COLORS.reset} Connected! Type "help" for commands.\n`)
  } catch (err) {
    console.log(`${COLORS.red}[error]${COLORS.reset} Connection failed: ${err}`)
    console.log(`${COLORS.yellow}[warn]${COLORS.reset} Use "connect" to retry.\n`)
  }

  // Start REPL
  rl.prompt()

  rl.on('line', async (line) => {
    const trimmed = line.trim()

    // Skip empty lines
    if (!trimmed) {
      rl?.prompt()
      return
    }

    // Parse and dispatch command
    const { cmd, args } = parse_command(trimmed)
    await dispatch(ctx, cmd, args, log)

    // Check if we should exit
    if (!ctx.running) {
      await shutdown()
      return
    }

    rl?.prompt()
  })

  rl.on('close', () => {
    if (ctx.running) {
      shutdown()
    }
  })
}

main().catch(err => {
  console.error(`Fatal error: ${err}`)
  process.exit(1)
})
