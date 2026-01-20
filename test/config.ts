/**
 * Test environment configuration.
 *
 * Centralized configuration for test-specific settings like ports.
 * Change these values if there are port conflicts on your system.
 */

/** Base port for test relays. Individual tests use offsets from this. */
const BASE_PORT = 9100

/** Port assignments for integration tests */
export const TEST_PORTS = {
  /** Default relay port for socket tests */
  SOCKET_RELAY: BASE_PORT,

  /** Relay lifecycle test ports */
  RELAY_LIFECYCLE_1: BASE_PORT + 1,
  RELAY_LIFECYCLE_2: BASE_PORT + 2,

  /** Relay client handling test port */
  RELAY_CLIENT: BASE_PORT + 3,

  /** Subscription test port */
  SUBSCRIPTION: BASE_PORT + 4,

  /** Client test ports (two relays needed) */
  CLIENT_RELAY_1: BASE_PORT + 5,
  CLIENT_RELAY_2: BASE_PORT + 6,
} as const

/** Helper to build WebSocket URL from port */
export function wsUrl (port: number): string {
  return `ws://localhost:${port}`
}

/** Pre-built WebSocket URLs for convenience */
export const TEST_URLS = {
  SOCKET_RELAY: wsUrl(TEST_PORTS.SOCKET_RELAY),
  RELAY_CLIENT: wsUrl(TEST_PORTS.RELAY_CLIENT),
  SUBSCRIPTION: wsUrl(TEST_PORTS.SUBSCRIPTION),
  CLIENT_RELAY_1: wsUrl(TEST_PORTS.CLIENT_RELAY_1),
  CLIENT_RELAY_2: wsUrl(TEST_PORTS.CLIENT_RELAY_2),
} as const
