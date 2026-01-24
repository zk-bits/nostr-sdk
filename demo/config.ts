/**
 * Demo configuration constants.
 */

import * as path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** Default relay URL for demo connections. */
export const DEFAULT_RELAY = 'ws://localhost:8080'

/** Default relay port. */
export const DEFAULT_PORT = 8080

/** Directory for storing credentials (in demo folder). */
export const CREDENTIALS_DIR = path.join(__dirname, 'credentials')

/** REPL prompt character. */
export const PROMPT_CHAR = '> '

/** Default timeout for RPC requests (ms). */
export const RPC_TIMEOUT = 10000

/** Default timeout for subscriptions (ms). */
export const SUB_TIMEOUT = 30000

/** Colors for console output. */
export const COLORS = {
  reset   : '\x1b[0m',
  dim     : '\x1b[2m',
  red     : '\x1b[31m',
  green   : '\x1b[32m',
  yellow  : '\x1b[33m',
  blue    : '\x1b[34m',
  magenta : '\x1b[35m',
  cyan    : '\x1b[36m',
  white   : '\x1b[37m',
  gray    : '\x1b[90m'
}
