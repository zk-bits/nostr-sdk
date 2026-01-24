/**
 * Command registry and dispatcher.
 */

import type { NostrNode }   from '../../src/class/node.js'
import type { SubscriptionManager } from '../../src/class/sub.js'

// Connection commands
import { cmd_connect, cmd_disconnect, cmd_status } from './connect.js'

// Publishing commands
import { cmd_publish } from './publish.js'

// Query commands
import { cmd_query, cmd_subscribe, cmd_unsubscribe } from './query.js'

// P2P commands
import { cmd_peers, cmd_p2p, cmd_send, cmd_broadcast, cmd_ping, cmd_pingall } from './rpc.js'

// Utility commands
import { cmd_help, cmd_whoami, cmd_clear, cmd_quit } from './util.js'

/* ================ [ Types ] ================ */

/**
 * Logger interface for async-safe output.
 */
export interface Logger {
  info    : (msg: string) => void
  send    : (msg: string) => void
  recv    : (msg: string) => void
  success : (msg: string) => void
  error   : (msg: string) => void
  warn    : (msg: string) => void
  event   : (msg: string) => void
  plain   : (msg: string) => void
}

/**
 * Node context shared across commands.
 */
export interface NodeContext {
  name          : string
  seckey        : string
  pubkey        : string
  node?         : NostrNode
  peers         : Map<string, string>  // name -> pubkey
  subscriptions : Map<string, SubscriptionManager>
  running       : boolean
}

/**
 * Command handler function signature.
 */
export type CommandHandler = (ctx: NodeContext, args: string[], log: Logger) => Promise<void>

/* ================ [ Command Registry ] ================ */

/**
 * Map of command names to handlers.
 */
const COMMANDS: Map<string, CommandHandler> = new Map([
  // Connection
  ['connect',      cmd_connect],
  ['disconnect',   cmd_disconnect],
  ['status',       cmd_status],

  // Publishing
  ['publish',      cmd_publish],
  ['pub',          cmd_publish],  // Alias

  // Query & Subscriptions
  ['query',        cmd_query],
  ['subscribe',    cmd_subscribe],
  ['sub',          cmd_subscribe],  // Alias
  ['unsubscribe',  cmd_unsubscribe],
  ['unsub',        cmd_unsubscribe],  // Alias

  // P2P Communication
  ['peers',        cmd_peers],
  ['p2p',          cmd_p2p],
  ['send',         cmd_send],
  ['broadcast',    cmd_broadcast],
  ['ping',         cmd_ping],
  ['pingall',      cmd_pingall],

  // Utility
  ['help',         cmd_help],
  ['?',            cmd_help],  // Alias
  ['whoami',       cmd_whoami],
  ['clear',        cmd_clear],
  ['cls',          cmd_clear],  // Alias
  ['quit',         cmd_quit],
  ['exit',         cmd_quit],  // Alias
  ['q',            cmd_quit],  // Alias
])

/* ================ [ Dispatcher ] ================ */

/**
 * Dispatches a command to the appropriate handler.
 */
export async function dispatch (
  ctx  : NodeContext,
  cmd  : string,
  args : string[],
  log  : Logger
): Promise<void> {
  const handler = COMMANDS.get(cmd)

  if (!handler) {
    log.error(`Unknown command: ${cmd}. Type "help" for commands.`)
    return
  }

  try {
    await handler(ctx, args, log)
  } catch (err) {
    log.error(`Command failed: ${err}`)
  }
}

/**
 * Creates a new node context.
 */
export function create_context (
  name   : string,
  seckey : string,
  pubkey : string
): NodeContext {
  return {
    name,
    seckey,
    pubkey,
    node          : undefined,
    peers         : new Map(),
    subscriptions : new Map(),
    running       : true
  }
}
