/**
 * Utility commands: help, whoami, clear, quit
 */

import type { NodeContext, Logger } from './index.js'

const HELP_TEXT = `
Commands:

  P2P:
    send <peer> <msg>   Send message to peer
    broadcast <msg>     Send to all peers
    ping <peer>         Ping a peer
    pingall             Ping all peers
    peers               List peers

  Events:
    publish <text>      Publish a note
    query               Query recent events
    subscribe           Subscribe to events

  Utility:
    status              Show connection status
    whoami              Show identity
    help                Show this help
    quit                Exit
`

/**
 * Show help.
 */
export async function cmd_help (_ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  log.plain(HELP_TEXT)
}

/**
 * Show identity.
 */
export async function cmd_whoami (ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  log.info(`Identity: ${ctx.name}`)
  log.plain(`  Pubkey: ${ctx.pubkey}`)
}

/**
 * Clear screen.
 */
export async function cmd_clear (_ctx: NodeContext, _args: string[], _log: Logger): Promise<void> {
  console.clear()
}

/**
 * Exit.
 */
export async function cmd_quit (ctx: NodeContext, _args: string[], _log: Logger): Promise<void> {
  ctx.running = false
}
