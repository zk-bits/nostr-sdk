import { DEBUG }             from '@/const.js'
import { exec, parse_error } from '@/lib/util.js'

import * as SCHEMA from '@/schema/index.js'

import type {
  ClientMessage,
  RelayMessage,
  Result
} from '@/types/index.js'

export function validate_client_message (
  message : unknown
) : asserts message is ClientMessage {
  SCHEMA.MESSAGE.client_message.parse(message)
}

export function validate_relay_message (
  message : unknown
) : asserts message is RelayMessage {
  SCHEMA.MESSAGE.relay_message.parse(message)
}

export function parse_client_message (
  message : unknown
) : Result<ClientMessage> {
  // If the message is a string,
  if (typeof message === 'string') {
    // Parse the message as JSON.
    const json = exec(() => JSON.parse(message as string))
    // If the message is not valid, return an error.
    if (!json.ok) return { ok : false, result : null, error : parse_error(json.error) }
    // Set the message to the parsed data.
    message = json.result
  }
  // Define the schema.
  const schema = SCHEMA.MESSAGE.client_message
  // Parse the message.
  const parsed = schema.safeParse(message)
  // If the message is not valid and debug mode is enabled, log the error.
  if (DEBUG && !parsed.success) console.error(parsed.error)
  // Return the result based on the success of the parser.
  return (parsed.success)
    ? { ok : true,  result : parsed.data as ClientMessage }
    : { ok : false, result : null, error : parse_error(parsed.error) }
}

export function parse_relay_message (
  message : unknown
) : Result<RelayMessage> {
  // If the message is a string,
  if (typeof message === 'string') {
    // Parse the message as JSON.
    const json = exec(() => JSON.parse(message as string))
    // If the message is not valid, return an error.
    if (!json.ok) return { ok : false, result : null, error : parse_error(json.error) }
    // Set the message to the parsed data.
    message = json.result
  }
  // Define the schema.
  const schema = SCHEMA.MESSAGE.relay_message
  // Parse the message.
  const parsed = schema.safeParse(message)
  // If the message is not valid and debug mode is enabled, log the error.
  if (DEBUG && !parsed.success) console.error(parsed.error)
  // Return the result based on the success of the parser.
  return (parsed.success)
    ? { ok : true,  result : parsed.data as RelayMessage }
    : { ok : false, result : null, error : parse_error(parsed.error) }
}
