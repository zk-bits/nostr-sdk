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

export function match_any_filter (
  event   : SignedEvent,
  filters : EventFilter[]
) : boolean {
  // For each filter:
  for (const filter of filters) {
    // If the event matches the filter,
    if (match_filter(event, filter)) {
      // Return true.
      return true
    }
  }
  // If no filter matches, return false.
  return false
}

export function match_filter (
  event  : SignedEvent,
  filter : EventFilter = {}
) : boolean {
  // Unpack the filter object.
  const { authors, ids, kinds, since, until, limit, ...rest } = filter
  // Get the tag filters from the rest of the filter object.
  const tag_filters = get_tag_filters(rest)
  // Initialize the matches flag.
  let matches = false
  // Check if the event ID filter is defined, and the ID matches the filter.
  if (ids?.includes(event.id)) {
    matches = true
  // Check if the author filter is defined, and the author matches the filter.
  } else if (authors?.includes(event.pubkey)) {
    matches = true
  // Check if the kind filter is defined, and the kind matches the filter.
  } else if (kinds?.includes(event.kind)) {
    matches = true
  // Check if any tag filters are defined, and the tags match the filters.
  } else if (match_tags(tag_filters, event.tags)) {
    matches = true
  }
  // Check if the "created at" timestamp is outside the since and until filters.
  if ((since && event.created_at < since) || (until && event.created_at > until)) {
    matches = false
  }
  // Return the matches flag.
  return matches
}

export function match_tags (
  filters : [ string, string ][],
  tags    : string[][]
) : boolean {
  // For each filter entry:
  for (const [ key, value ] of filters) {
    // For each tag entry:
    for (const [ tag, ...params ] of tags) {
      // If the tag matches the filter,
      // and params include the filter value:
      if (key === tag && params.includes(value)) {
        // Return true.
        return true
      }
    }
  }
  // If no tag matches, return false.
  return false
}

export function get_tag_filters (filter : EventFilter) : [ string, string ][] {
  // Return the tag filters from the main filter object.
  return Object.entries(filter)
    .filter(([ tag, [ value ] ]) => tag.startsWith('#') && value)
    .map(([ tag, [ value ] ]) => [ tag.slice(1, 2), value ])
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
