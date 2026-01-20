import type { EventFilter, SignedEvent } from '@/types/index.js'

/**
 * Filters events against multiple EventFilters.
 * @param events   Array of events to filter
 * @param filters  Array of filters to apply (events matching any filter are included)
 * @returns        Array of matching events
 */
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

/**
 * Checks if an event matches any of the provided filters.
 * @param event    The event to check
 * @param filters  Array of filters to match against
 * @returns        True if the event matches at least one filter
 */
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

/**
 * Checks if an event matches a single filter.
 * Matches on id, author, kind, or tag filters, then validates time constraints.
 * @param event   The event to check
 * @param filter  The filter to match against
 * @returns       True if the event matches the filter
 */
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

/**
 * Checks if event tags match any of the tag filters.
 * @param filters  Array of [tag_name, value] tuples to match
 * @param tags     Event tags array (each tag is [name, ...values])
 * @returns        True if any tag matches a filter
 */
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

/**
 * Extracts tag filters from an EventFilter object.
 * Tag filters are properties starting with '#' (e.g., '#e', '#p').
 * @param filter  EventFilter containing tag filter properties
 * @returns       Array of [tag_name, value] tuples
 */
export function get_tag_filters (filter : EventFilter) : [ string, string ][] {
  // Return the tag filters from the main filter object.
  // Tag filters are arrays like { '#e': ['event_id', ...] }
  return Object.entries(filter)
    .filter(([ tag, values ]) => {
      // Must be a tag filter (starts with #) with a non-empty array
      return tag.startsWith('#') && Array.isArray(values) && values.length > 0 && values[0]
    })
    .map(([ tag, values ]) => [ tag.slice(1, 2), values[0] as string ])
}

/**
 * Generates a cache key for an event based on NIP-01 kind categories.
 * Regular kinds use event ID, replaceable use pubkey:kind, addressable use pubkey:kind:d-tag.
 * @param event  The event to generate a key for
 * @returns      Cache key string, or null for ephemeral events
 */
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

/**
 * Checks if a kind is a regular event (stored, not replaced).
 * Includes kinds 1, 2, 4-44, and 1000-9999.
 */
export function is_kind_regular (kind : number) : boolean {
  return (
    (1000 <= kind && kind < 10000)
    || (4 <= kind && kind < 45)
    || kind === 1
    || kind === 2
  )
}

/**
 * Checks if a kind is replaceable (newer events replace older ones).
 * Includes kinds 0, 3, 4-44, and 10000-19999.
 */
export function is_kind_replace (kind : number) : boolean {
  return (
    (10_000 <= kind && kind < 20_000)
    || (4 <= kind && kind < 45)
    || kind === 0
    || kind === 3
  )
}

/**
 * Checks if a kind is ephemeral (not stored by relays).
 * Includes kinds 20000-29999.
 */
export function is_kind_ephemeral (kind : number) : boolean {
  return (20_000 <= kind && kind < 30_000)
}

/**
 * Checks if a kind is addressable (parameterized replaceable).
 * Includes kinds 30000-39999.
 */
export function is_kind_address (kind : number) : boolean {
  return (30_000 <= kind && kind < 40_000)
}
