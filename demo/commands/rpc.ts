/**
 * P2P communication commands: p2p, send, broadcast, ping
 */

import type { NodeContext, Logger } from './index.js'
import { format_pubkey } from '../shared.js'
import { DEFAULT_RELAY, RPC_TIMEOUT } from '../config.js'
import { NostrNode } from '../../src/class/node.js'

import type {
  RpcMessageData,
  RequestRpcMessage,
  RpcMessageEnvelope,
  RejectRpcMessage,
  EventRpcMessage
} from '../../src/types/index.js'

/**
 * List registered peers.
 */
export async function cmd_peers (ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  if (ctx.peers.size === 0) {
    log.info('No peers registered.')
    return
  }

  log.info(`Registered peers (${ctx.peers.size}):`)
  for (const [name, pk] of ctx.peers) {
    const status = ctx.node?.peers.has(pk) ? 'connected' : 'registered'
    log.plain(`  ${name}: ${format_pubkey(pk)} (${status})`)
  }
}

/**
 * Start P2P node - can be called from auto-start or command.
 */
export async function start_p2p (
  ctx   : NodeContext,
  relay : string,
  log   : Logger
): Promise<void> {
  if (ctx.node?.is_ready) {
    return // Already running
  }

  const peers = Array.from(ctx.peers.values())
  ctx.node = new NostrNode(peers, [relay], ctx.seckey)

  // Handle incoming messages
  ctx.node.on('message', (msg: RpcMessageData) => {
    handle_incoming_message(ctx, msg, log)
  })

  ctx.node.on('notice', (msg) => {
    log.warn(`Relay: ${msg}`)
  })

  ctx.node.on('closed', () => {
    ctx.node = undefined
  })

  await ctx.node.connect()
}

/**
 * Start P2P node command.
 */
export async function cmd_p2p (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  if (ctx.node?.is_ready) {
    log.warn('P2P already running')
    return
  }

  const relay = args[0] || DEFAULT_RELAY

  try {
    log.info(`Connecting to ${relay}...`)
    await start_p2p(ctx, relay, log)
    log.success('P2P ready')
  } catch (err) {
    log.error(`P2P failed: ${err}`)
    ctx.node = undefined
  }
}

/**
 * Handle incoming RPC messages.
 */
function handle_incoming_message (ctx: NodeContext, msg: RpcMessageData, log: Logger): void {
  const sender = get_peer_name(ctx, msg.event.pubkey)

  switch (msg.type) {
    case 'request': {
      const req = msg as RpcMessageEnvelope<RequestRpcMessage>

      if (req.method === 'ping') {
        // Auto-respond to ping
        if (ctx.node) {
          ctx.node.respond(req).accept({ pong: true, time: Date.now() })
        }
        log.recv(`Ping from ${sender}`)
      } else if (req.method === 'message') {
        // Display incoming message
        const text = req.params?.[0] || ''
        log.recv(`${sender}: ${text}`)

        // Auto-acknowledge
        if (ctx.node) {
          ctx.node.respond(req).accept({ received: true })
        }
      } else {
        log.recv(`${sender} sent "${req.method}"`)
        if (req.params && req.params.length > 0) {
          log.plain(`  Data: ${JSON.stringify(req.params)}`)
        }
        // Auto-acknowledge unknown requests
        if (ctx.node) {
          ctx.node.respond(req).accept({ ok: true })
        }
      }
      break
    }

    case 'event': {
      const evt = msg as RpcMessageEnvelope<EventRpcMessage>
      log.recv(`${sender} broadcast "${evt.topic}": ${JSON.stringify(evt.data)}`)
      break
    }

    case 'accept':
    case 'reject':
      // Response handling is done in the command functions
      break
  }
}

/**
 * Get peer name by pubkey.
 */
function get_peer_name (ctx: NodeContext, pubkey: string): string {
  for (const [name, pk] of ctx.peers) {
    if (pk === pubkey) return name
  }
  return format_pubkey(pubkey)
}

/**
 * Resolve peer name to pubkey.
 */
function resolve_peer (ctx: NodeContext, nameOrPk: string): string | null {
  const pk = ctx.peers.get(nameOrPk)
  if (pk) return pk
  if (/^[a-f0-9]{64}$/i.test(nameOrPk)) return nameOrPk
  return null
}

/**
 * Send a message to a peer.
 */
export async function cmd_send (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  const [peerName, ...messageParts] = args
  const message = messageParts.join(' ')

  if (!peerName || !message) {
    log.error('Usage: send <peer> <message>')
    return
  }

  if (!ctx.node?.is_ready) {
    log.error('Not connected. Waiting for P2P...')
    return
  }

  const peer = resolve_peer(ctx, peerName)
  if (!peer) {
    log.error(`Unknown peer: ${peerName}`)
    return
  }

  try {
    log.send(`To ${peerName}: ${message}`)
    const response = await ctx.node.request(
      { method: 'message', params: [message] },
      peer,
      { timeout: RPC_TIMEOUT }
    )

    if (response.type === 'reject') {
      const rej = response as RpcMessageEnvelope<RejectRpcMessage>
      log.error(`Rejected: ${rej.reason}`)
    }
  } catch (err) {
    log.error(`Failed: ${err}`)
  }
}

/**
 * Broadcast a message to all peers.
 */
export async function cmd_broadcast (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  const message = args.join(' ')

  if (!message) {
    log.error('Usage: broadcast <message>')
    return
  }

  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const peers = Array.from(ctx.peers.values())
  if (peers.length === 0) {
    log.error('No peers')
    return
  }

  try {
    const peerNames = Array.from(ctx.peers.keys()).join(', ')
    log.send(`To ${peerNames}: ${message}`)

    const promises = ctx.node.announce(
      { topic: 'broadcast', data: { message, from: ctx.name } },
      peers
    )

    const results = await Promise.allSettled(promises)
    const delivered = results.filter(r => r.status === 'fulfilled').length
    log.success(`Sent to ${delivered}/${peers.length} peer(s)`)
  } catch (err) {
    log.error(`Failed: ${err}`)
  }
}

/**
 * Ping a peer.
 */
export async function cmd_ping (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  const peerName = args[0]

  if (!peerName) {
    log.error('Usage: ping <peer>')
    return
  }

  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const peer = resolve_peer(ctx, peerName)
  if (!peer) {
    log.error(`Unknown peer: ${peerName}`)
    return
  }

  try {
    const start = Date.now()
    const response = await ctx.node.request(
      { method: 'ping' },
      peer,
      { timeout: RPC_TIMEOUT }
    )
    const elapsed = Date.now() - start

    if (response.type === 'accept') {
      log.success(`${peerName}: ${elapsed}ms`)
    } else {
      const rej = response as RpcMessageEnvelope<RejectRpcMessage>
      log.error(`${peerName}: rejected - ${rej.reason}`)
    }
  } catch {
    log.error(`${peerName}: timeout`)
  }
}

/**
 * Ping all peers.
 */
export async function cmd_pingall (ctx: NodeContext, _args: string[], log: Logger): Promise<void> {
  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const peers = Array.from(ctx.peers.entries())
  if (peers.length === 0) {
    log.error('No peers')
    return
  }

  log.info(`Pinging ${peers.length} peer(s)...`)

  for (const [name, pk] of peers) {
    try {
      const start = Date.now()
      const response = await ctx.node.request(
        { method: 'ping' },
        pk,
        { timeout: RPC_TIMEOUT }
      )
      const elapsed = Date.now() - start

      if (response.type === 'accept') {
        log.success(`  ${name}: ${elapsed}ms`)
      } else {
        log.error(`  ${name}: rejected`)
      }
    } catch {
      log.error(`  ${name}: timeout`)
    }
  }
}
