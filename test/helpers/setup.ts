/**
 * Test Setup and Global Error Handling
 *
 * Sets up global error handlers to prevent unhandled rejections from
 * crashing the test suite. Also provides utilities for suppressing
 * expected errors during teardown.
 */

/** Track whether setup has been initialized */
let initialized = false

/** Collected unhandled rejections for debugging */
const unhandledRejections: Array<{ reason: unknown, promise: Promise<unknown> }> = []

/** Whether to suppress unhandled rejection warnings */
let suppressWarnings = false

/**
 * Initializes global error handlers for the test environment.
 * Call this once at the start of your test suite.
 */
export function setupTestEnvironment(): void {
  if (initialized) return
  initialized = true

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason, promise) => {
    unhandledRejections.push({ reason, promise })

    if (!suppressWarnings) {
      // Log but don't crash - this allows tests to continue
      console.warn('\n[Test Warning] Unhandled promise rejection:')
      console.warn('  Reason:', reason instanceof Error ? reason.message : reason)

      // In debug mode, show stack trace
      if (process.env.DEBUG_TESTS && reason instanceof Error) {
        console.warn('  Stack:', reason.stack)
      }
    }
  })

  // Handle uncaught exceptions
  process.on('uncaughtException', (error) => {
    console.error('\n[Test Error] Uncaught exception:')
    console.error('  Error:', error.message)
    console.error('  Stack:', error.stack)

    // For uncaught exceptions, we should exit to prevent undefined behavior
    process.exit(1)
  })

  // Log when tests complete
  process.on('beforeExit', () => {
    if (unhandledRejections.length > 0 && !suppressWarnings) {
      console.warn(`\n[Test Summary] ${unhandledRejections.length} unhandled rejection(s) occurred during tests`)
    }
  })
}

/**
 * Suppresses unhandled rejection warnings.
 * Use during teardown when rejections are expected.
 */
export function suppressRejectionWarnings(): void {
  suppressWarnings = true
}

/**
 * Re-enables unhandled rejection warnings.
 */
export function enableRejectionWarnings(): void {
  suppressWarnings = false
}

/**
 * Clears the collected unhandled rejections.
 */
export function clearUnhandledRejections(): void {
  unhandledRejections.length = 0
}

/**
 * Gets the collected unhandled rejections.
 */
export function getUnhandledRejections(): ReadonlyArray<{ reason: unknown, promise: Promise<unknown> }> {
  return unhandledRejections
}

/**
 * Wraps a cleanup function to suppress expected rejections.
 * Use this when cleanup is expected to cause rejections (e.g., stopping relays).
 */
export async function withSuppressedWarnings<T>(fn: () => Promise<T>): Promise<T> {
  suppressRejectionWarnings()
  try {
    return await fn()
  } finally {
    // Small delay to catch any async rejections
    await new Promise(resolve => setTimeout(resolve, 100))
    enableRejectionWarnings()
  }
}

/**
 * Asserts that no unhandled rejections occurred.
 * Call at the end of a test to verify clean execution.
 */
export function assertNoUnhandledRejections(): void {
  if (unhandledRejections.length > 0) {
    const messages = unhandledRejections.map(r =>
      r.reason instanceof Error ? r.reason.message : String(r.reason)
    )
    clearUnhandledRejections()
    throw new Error(`Unhandled rejections occurred:\n  - ${messages.join('\n  - ')}`)
  }
}

// Auto-initialize when this module is imported
setupTestEnvironment()
