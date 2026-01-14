import type { EventFilter, SignedEvent } from '@/types/index.js'

export function process_filters (
  events  : SignedEvent[],
  filters : EventFilter[]
) : SignedEvent[] {
  // Initialize the events array.
  const results : SignedEvent[] = []
  // For each filter:
  for (const filter of filters) {
    // Initialize the matches array.
    const matches : SignedEvent[] = []
    // For each event:
    for (const event of events) {
      // If the event matches the filter,
      if (match_filter(event, filter)) {
        // Add the event to the matches array.
        matches.push(event)
      }
      // If the limit is set and we have reached the limit,
      if (filter.limit && matches.length >= filter.limit) {
        // Break out of the loop.
        break
      }
    }
    // Add the matches to the results array.
    results.push(...matches)
  }
  // Return the results array.
  return results
}

export function match_filter (
  event  : SignedEvent,
  filter : EventFilter = {}
) : boolean {
  const { authors, ids, kinds, since, until, limit, ...rest } = filter

  const tag_filters : string[][] = get_tag_filters(rest)

  if (ids !== undefined && !ids.includes(event.id)) {
    return false
  } else if (since   !== undefined && event.created_at < since) {
    return false
  } else if (until   !== undefined && event.created_at > until) {
    return false
  } else if (authors !== undefined && !authors.includes(event.pubkey)) {
    return false
  } else if (kinds   !== undefined && !kinds.includes(event.kind)) {
    return false
  } else if (tag_filters.length > 0) {
    return match_tags(filter, event.tags)
  } else {
    return true
  }
}

export function match_tags (
  filter : EventFilter,
  tags   : string[][]
) : boolean {
  // For each filter entry:
  for (const [ key, ...terms ] of get_tag_filters(filter)) {
    // For each tag entry:
    for (const [ tag, param ] of tags) {
      // If the tag matches the filter,
      // and param is included in terms:
      if (tag === key && terms.includes(param)) {
        // Return true.
        return true
      }
    }
  }
  // If no tags match the filters, return false.
  return false
}

export function get_tag_filters (filter : EventFilter) : string[][] {
  // Return the tag filters from the main filter object.
  return Object.entries(filter)
    .filter(e => e[0].startsWith('#'))
    .map(e => [ e[0].slice(1, 2), ...e.slice(1) ])
}

export function get_event_cache_key (event : SignedEvent) : string | null {
  // Destructure the event.
  const { id, pubkey, kind, tags } = event
  // If the event is a replace kind,
  if (is_kind_replace(kind)) {
    // Return the cache key.
    return `${pubkey}:${kind}`
  // If the event is an ephemeral kind,
  } else if (is_kind_ephemeral(kind)) {
    // Return null.
    return null
  // If the event is an address kind,
  } else if (is_kind_address(kind)) {
    // Get the dtag from the event tags.
    const dtag = tags.find(t => t[0] === 'd')?.at(1) ?? ''
    // Return the cache key.
    return `${pubkey}:${kind}:${dtag}`
  // If the event is a regular kind,
  } else {
    // Return the event ID.
    return `${id}`
  }
}

export function is_kind_regular (kind : number) : boolean {
  return (
    (1000 <= kind && kind < 10000) 
    || (4 <= kind && kind < 45)
    || kind === 1
    || kind === 2
  )
}

export function is_kind_replace (kind : number) : boolean {
  return (
    (10_000 <= kind && kind < 20_000) 
    || (4 <= kind && kind < 45)
    || kind === 0
    || kind === 3
  )
}

export function is_kind_ephemeral (kind : number) : boolean {
  return (20_000 <= kind && kind < 30_000)
}

export function is_kind_address (kind : number) : boolean {
  return (30_000 <= kind && kind < 40_000)
}
