/**
 * Test environment configuration.
 *
 * Centralized configuration for test-specific settings like ports.
 * Change these values if there are port conflicts on your system.
 */

/** Base port for test relays. Individual tests use offsets from this. */
const BASE_PORT = 9100

// ─────────────────────────────────────────────────────────────────
// Legacy Port Assignments (kept for backward compatibility)
// ─────────────────────────────────────────────────────────────────

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

  // ─────────────────────────────────────────────────────────────────
  // New Structured Port Assignments
  // ─────────────────────────────────────────────────────────────────

  /** Relay tests (9110-9119) */
  RELAY: {
    FEATURE : 9110,
    FAILURE : 9111,
    STRESS  : 9112
  },

  /** Socket tests (9120-9129) */
  SOCKET: {
    FEATURE : 9120,
    FAILURE : 9121,
    STRESS  : 9122
  },

  /** Subscription tests (9130-9139) */
  SUB: {
    FEATURE : 9130,
    FAILURE : 9131,
    STRESS  : 9132
  },

  /** Client tests (9140-9149) */
  CLIENT: {
    FEATURE_1 : 9140,
    FEATURE_2 : 9141,
    FAILURE_1 : 9142,
    FAILURE_2 : 9143,
    STRESS_1  : 9144,
    STRESS_2  : 9145,
    STRESS_3  : 9146
  },

  /** Node P2P tests (9150-9159) */
  NODE: {
    RELAY_1 : 9150,
    RELAY_2 : 9151,
    PEER_1  : 9152,
    PEER_2  : 9153,
    STRESS  : 9154
  }
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

  // New structured URLs
  RELAY: {
    FEATURE : wsUrl(TEST_PORTS.RELAY.FEATURE),
    FAILURE : wsUrl(TEST_PORTS.RELAY.FAILURE),
    STRESS  : wsUrl(TEST_PORTS.RELAY.STRESS)
  },
  SOCKET: {
    FEATURE : wsUrl(TEST_PORTS.SOCKET.FEATURE),
    FAILURE : wsUrl(TEST_PORTS.SOCKET.FAILURE),
    STRESS  : wsUrl(TEST_PORTS.SOCKET.STRESS)
  },
  SUB: {
    FEATURE : wsUrl(TEST_PORTS.SUB.FEATURE),
    FAILURE : wsUrl(TEST_PORTS.SUB.FAILURE),
    STRESS  : wsUrl(TEST_PORTS.SUB.STRESS)
  },
  CLIENT: {
    FEATURE_1 : wsUrl(TEST_PORTS.CLIENT.FEATURE_1),
    FEATURE_2 : wsUrl(TEST_PORTS.CLIENT.FEATURE_2),
    FAILURE_1 : wsUrl(TEST_PORTS.CLIENT.FAILURE_1),
    FAILURE_2 : wsUrl(TEST_PORTS.CLIENT.FAILURE_2),
    STRESS_1  : wsUrl(TEST_PORTS.CLIENT.STRESS_1),
    STRESS_2  : wsUrl(TEST_PORTS.CLIENT.STRESS_2),
    STRESS_3  : wsUrl(TEST_PORTS.CLIENT.STRESS_3)
  },
  NODE: {
    RELAY_1 : wsUrl(TEST_PORTS.NODE.RELAY_1),
    RELAY_2 : wsUrl(TEST_PORTS.NODE.RELAY_2)
  }
} as const

// ─────────────────────────────────────────────────────────────────
// Test Constants
// ─────────────────────────────────────────────────────────────────

/** Stress test configuration */
export const STRESS_CONFIG = {
  /** Number of events for sequential stress tests */
  EVENT_COUNT       : 200,
  /** Number of concurrent publish operations */
  CONCURRENT_OPS    : 50,
  /** Number of concurrent subscriptions */
  SUBSCRIPTION_COUNT: 20,
  /** Number of relays for multi-relay stress tests */
  RELAY_COUNT       : 3,
  /** Threshold for performance assertions (ms) */
  THROUGHPUT_LIMIT  : 30000
} as const

/** Failure test configuration */
export const FAILURE_CONFIG = {
  /** Short timeout for expected failures */
  SHORT_TIMEOUT   : 1000,
  /** Non-existent port for connection failures */
  DEAD_PORT       : 9999,
  /** Invalid WebSocket URL */
  INVALID_URL     : 'ws://localhost:9999'
} as const
