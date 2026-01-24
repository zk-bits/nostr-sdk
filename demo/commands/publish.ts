/**
 * Event publishing commands: publish
 */

import type { NodeContext, Logger } from './index.js'
import { format_event_id } from '../shared.js'
import { create_event, sign_event } from '../../src/lib/event.js'

/**
 * Publish a text note.
 */
export async function cmd_publish (ctx: NodeContext, args: string[], log: Logger): Promise<void> {
  const content = args.join(' ')

  if (!content) {
    log.error('Usage: publish <content>')
    return
  }

  if (!ctx.node?.is_ready) {
    log.error('Not connected')
    return
  }

  const template = create_event({
    pubkey  : ctx.pubkey,
    kind    : 1,
    content : content
  })
  const event = sign_event(template, ctx.seckey)

  try {
    const result = await ctx.node.client.publish(event)
    if (result.ok) {
      log.success(`Published: ${format_event_id(event.id)}`)
    }
  } catch (err: any) {
    log.error(`Failed: ${err.reason ?? err}`)
  }
}
