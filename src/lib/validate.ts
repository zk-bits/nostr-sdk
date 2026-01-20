import { exec, parse_error } from '@/lib/util.js'

import * as SCHEMA from '@/schema/index.js'

import type {
  ClientMessage,
  RelayMessage,
  Result
} from '@/types/index.js'

/**
 * Validates that a message conforms to the client message schema.
 * @param message  The message to validate
 * @throws         Error if the message is invalid
 */
export function validate_client_message (
  message : unknown
) : asserts message is ClientMessage {
  SCHEMA.MESSAGE.client_message.parse(message)
}

/**
 * Validates that a message conforms to the relay message schema.
 * @param message  The message to validate
 * @throws         Error if the message is invalid
 */
export function validate_relay_message (
  message : unknown
) : asserts message is RelayMessage {
  SCHEMA.MESSAGE.relay_message.parse(message)
}

/**
 * Parses and validates a client message, returning a Result object.
 * @param message  The message to parse (string or object)
 * @returns        Result object with parsed message or error
 */
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
  // Return the result based on the success of the parser.
  return (parsed.success)
    ? { ok : true,  result : parsed.data as ClientMessage }
    : { ok : false, result : null, error : parse_error(parsed.error) }
}

/**
 * Parses and validates a relay message, returning a Result object.
 * @param message  The message to parse (string or object)
 * @returns        Result object with parsed message or error
 */
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
  // Return the result based on the success of the parser.
  return (parsed.success)
    ? { ok : true,  result : parsed.data as RelayMessage }
    : { ok : false, result : null, error : parse_error(parsed.error) }
}
