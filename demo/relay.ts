#!/usr/bin/env tsx
/**
 * Standalone relay server for demo purposes.
 * Usage: tsx demo/relay.ts [--port 8080] [--verbose]
 */

import { NostrRelay } from '../src/class/relay.js'
import { parse_args } from './shared.js'
import { DEFAULT_PORT, COLORS } from './config.js'

const c = COLORS

const log = {
  info    : (msg: string) => console.log(`${c.cyan}[info]${c.reset} ${msg}`),
  success : (msg: string) => console.log(`${c.green}[ok]${c.reset} ${msg}`),
  error   : (msg: string) => console.log(`${c.red}[error]${c.reset} ${msg}`)
}

async function main () {
  const args = parse_args(process.argv.slice(2))
  const port = args.port || DEFAULT_PORT

  const relay = new NostrRelay({
    verbose : args.verbose,
    debug   : args.verbose
  })

  const shutdown = () => {
    log.info('Shutting down...')
    relay.stop()
    process.exit(0)
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)

  try {
    await relay.start({ port })
    log.success(`Relay listening on ws://localhost:${port}`)
  } catch (err) {
    log.error(`Failed to start: ${err}`)
    process.exit(1)
  }
}

main()
