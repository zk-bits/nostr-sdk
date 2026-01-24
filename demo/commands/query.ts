/**
 * Query and subscription commands: query, subscribe, unsubscribe
 */

import type { NodeContext, Logger } from './index.js'
import { format_event, parse_options } from '../shared.js'
import type { EventFilter, SignedEvent } from '../../src/types/index.js'

/**
 * Query events from relay.
 */
export async function cmd_query (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const { options } = parse_options(args)

  const filter: EventFilter = {
    kinds : [1],
    limit : options.limit ? parseInt(options.limit, 10) : 10
  }

  try {
    log.info('Querying...')
    const events = await ctx.node.client.query(filter)
    display_events(events, log)
  } catch (err) {
    log.error(`Failed: ${err}`)
  }
}

function display_events (events: SignedEvent[], log: Logger): void {
  if (events.length === 0) {
    log.info('No events found')
    return
  }

  log.success(`Found ${events.length} event(s):`)
  for (const event of events) {
    log.event(format_event(event))
  }
}

/**
 * Create a subscription.
 */
export async function cmd_subscribe (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const name = args[0] || 'default'

  if (ctx.subscriptions.has(name)) {
    log.warn(`Subscription '${name}' exists`)
    return
  }

  const filter: EventFilter = { kinds: [1] }

  try {
    const manager = ctx.node.client.subscribe(filter)
    manager.on('event', (event) => {
      log.event(format_event(event))
    })
    await manager.activate()
    ctx.subscriptions.set(name, manager)
    log.success(`Subscribed: ${name}`)
  } catch (err) {
    log.error(`Failed: ${err}`)
  }
}

/**
 * Cancel a subscription.
 */
export async function cmd_unsubscribe (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  const name = args[0] || 'default'

  const sub = ctx.subscriptions.get(name)
  if (!sub) {
    log.error(`Not found: ${name}`)
    return
  }

  sub.cancel()
  ctx.subscriptions.delete(name)
  log.success(`Unsubscribed: ${name}`)
}
