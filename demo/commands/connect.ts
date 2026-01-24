/**
 * Connection commands: connect, disconnect, status
 */

import type { NodeContext, Logger } from './index.js'
import { format_pubkey } from '../shared.js'
import { DEFAULT_RELAY } from '../config.js'
import { start_p2p } from './rpc.js'

/**
 * Connect/reconnect to relay.
 */
export async function cmd_connect (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  if (ctx.node?.is_ready) {
    log.warn('Already connected')
    return
  }

  const relay = args[0] || DEFAULT_RELAY

  try {
    log.info(`Connecting to ${relay}...`)
    await start_p2p(ctx, relay, log)
    log.success('Connected')
  } catch (err) {
    log.error(`Failed: ${err}`)
  }
}

/**
 * Disconnect and close node.
 */
export async function cmd_disconnect (ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  if (!ctx.node) {
    log.info('Not connected')
    return
  }

  // Cancel all subscriptions
  for (const [_, sub] of ctx.subscriptions) {
    sub.cancel()
  }
  ctx.subscriptions.clear()

  // Close node
  ctx.node.close()
  ctx.node = undefined

  log.success('Disconnected')
}

/**
 * Show connection status.
 */
export async function cmd_status (ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  log.info(`Identity: ${ctx.name}`)
  log.plain(`  Pubkey: ${format_pubkey(ctx.pubkey)}`)

  if (ctx.node?.is_ready) {
    const connectedRelays = ctx.node.client.sockets.filter(s => s.is_ready).length
    const totalRelays = ctx.node.client.sockets.length
    log.plain(`  Status: connected (${connectedRelays}/${totalRelays} relays)`)
  } else {
    log.plain(`  Status: disconnected`)
  }

  if (ctx.peers.size > 0) {
    log.plain(`  Peers: ${ctx.peers.size}`)
  }

  if (ctx.subscriptions.size > 0) {
    log.plain(`  Subscriptions: ${ctx.subscriptions.size}`)
  }
}
