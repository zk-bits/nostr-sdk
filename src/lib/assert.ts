/**
 * Asserts that a value is truthy.
 * @param value    The value to check
 * @param message  Custom error message (default: 'Assertion failed!')
 * @throws Error   If value is false
 */
export function assert_ok (
  value    : unknown,
  message ?: string
) : asserts value {
  if (value === false) {
    throw new Error(message ?? 'Assertion failed!')
  }
}

/**
 * Asserts that a value is not null or undefined.
 * @param value    The value to check
 * @param message  Custom error message (default: 'Value is null or undefined!')
 * @throws Error   If value is null or undefined
 */
export function assert_exists <T> (
  value    : T | undefined | null,
  message? : string
  ) : asserts value is NonNullable<T> {
  if (typeof value === 'undefined' || value === null) {
    throw new Error(message ?? 'Value is null or undefined!')
  }
}

/**
 * Asserts that a value is a valid base64 string.
 * @param value  The value to check
 * @throws Error If value is not a valid base64 string
 */
export function assert_base64 (value : unknown) : asserts value is string {
  if (typeof value !== 'string') {
    throw new Error('value is not a string')
  }
  if (!/^[a-zA-Z0-9+/]+={0,2}$/.test(value)) {
    throw new Error('value is not a valid base64 string')
  }
}