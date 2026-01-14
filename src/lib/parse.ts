import { exec, parse_error } from '@/lib/util.js'

import type { ParsedEvent, QueryResponse, Result, SignedEvent } from '@/types/index.js'

/** Minimal schema interface for Zod v4 compatibility. */
interface Schema<T> {
  safeParse(data: unknown): { success: true; data: T } | { success: false; error: unknown }
}

export function parse_content <T = unknown> (
  content : string,
  schema? : Schema<T>
) : Result<T> {
  // Safely try to parse the content as JSON.
  const json = exec(() => JSON.parse(content))
  // If the content is not valid JSON, return an error.
  if (!json.ok) return { ok : false, result : null, error : parse_error(json.error) }
  // If no schema is provided, return the data as is.
  if (!schema) return { ok : true, result : json.result }
  // Safely try to parse the content as the schema.
  const parsed = schema.safeParse(json.result)
  // If the content is not valid according to the schema, return an error.
  if (!parsed.success) return { ok : false, result : null, error : parse_error(parsed.error) }
  // If the content is valid, return the data.
  return { ok : true, result : parsed.data }
}

export function parse_event <T = unknown> (
  event   : SignedEvent,
  schema? : Schema<T>
) : Result<ParsedEvent<T>> {
  // Parse the content of the event.
  const parsed = parse_content(event.content, schema)
  // If the content is not valid, return an error.
  if (!parsed.ok) return parsed
  // If the content is valid, return the event.
  return { ok : true, result : { ...event, data : parsed.result } }
}

export async function parse_query <T = unknown> (
  query   : Promise<QueryResponse>,
  schema? : Schema<T>
) : Promise<ParsedEvent<T>[]> {
  // Return a wrapped promise that parses the query response.
  return query.then(res => {
    // If the promise failed, throw the reason.
    if (!res.ok) throw res.reason
    // If the promise resolved with no events, throw an error.
    if (res.events.length === 0) throw 'no events found'
    // Define the array of parsed events.
    const events : ParsedEvent<T>[] = []
    // Iterate over the events.
    for (const event of res.events) {
      // Parse the event.
      const parsed = parse_event(event, schema)
      // If the event is not valid, continue.
      if (!parsed.ok) continue
      // If the event is valid, add it to the array.
      events.push(parsed.result)
    }
    // If no events are valid, throw an error.
    if (events.length === 0) throw 'all events failed validation'
    // Return the events.
    return events
  })
}
