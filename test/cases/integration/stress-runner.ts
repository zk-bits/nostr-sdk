/**
 * Stress Test Runner
 *
 * Runs stress tests separately from the main test suite.
 * This allows feature and failure tests to run quickly while
 * stress tests can be run on-demand or in CI.
 *
 * Usage:
 *   npm run test:stress
 */
import tape from 'tape'
import { setupTestEnvironment, withSuppressedWarnings } from '#/helpers/setup.js'
import { resetPortCounter } from '#/helpers/test-context.js'

// Initialize test environment
setupTestEnvironment()

// Reset port counter for stress tests (use high ports to avoid conflicts)
resetPortCounter(9500)

// ─────────────────────────────────────────────────────────────────
// Stress Test Imports
// ─────────────────────────────────────────────────────────────────

import relay_stress        from './relay/stress.test.js'
import socket_stress       from './socket/stress.test.js'
import subscription_stress from './subscription/stress.test.js'
import client_stress       from './client/stress.test.js'
import node_stress         from './node/stress.test.js'

// ─────────────────────────────────────────────────────────────────
// Stress Test Execution
// ─────────────────────────────────────────────────────────────────

tape('Relay Stress Tests', async t => {
  await relay_stress(t)
  t.end()
})

tape('Socket Stress Tests', async t => {
  await socket_stress(t)
  t.end()
})

tape('Subscription Stress Tests', async t => {
  await subscription_stress(t)
  t.end()
})

tape('Client Stress Tests', async t => {
  await client_stress(t)
  t.end()
})

tape('Node Stress Tests', async t => {
  await node_stress(t)
  t.end()
})

// Final cleanup
tape('Stress Test Cleanup', async t => {
  await withSuppressedWarnings(async () => {
    // Wait for any lingering operations
    await new Promise(resolve => setTimeout(resolve, 1000))
  })
  t.pass('cleanup complete')
  t.end()
})

// Force exit after tests complete
tape.onFinish(() => {
  setTimeout(() => process.exit(0), 500)
})

// Safety timeout for stress tests (5 minutes)
setTimeout(() => {
  console.error('\n[Error] Stress test suite timed out after 5 minutes')
  process.exit(1)
}, 300000).unref()
