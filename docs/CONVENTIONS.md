# Code Conventions

This document defines coding conventions for `@vbyte/nostr-sdk`.

## Quick Reference

| Context | Convention | Examples |
|---------|------------|----------|
| Files | `lowercase.ts` | `socket.ts`, `emitter.ts`, `event.ts` |
| Library functions | `snake_case` | `create_event()`, `parse_content()` |
| Class public methods | `camelCase` | `connect()`, `publish()`, `subscribe()` |
| Private fields | `_snake_case` | `_config`, `_queue`, `_init` |
| Config properties | `snake_case` | `max_retries`, `msg_timeout` |
| Constants | `UPPER_SNAKE_CASE` | `SOCKET_CONFIG` |
| Types/Interfaces | `PascalCase` | `SignedEvent`, `EventFilter` |
| Zod schemas | `lowercase` | `num`, `hex`, `str`, `stamp` |

## Import Organization

```typescript
// 1. Class imports (internal)
import { EventEmitter }      from '@/class/emitter.js'
import { MessageQueue }      from '@/class/queue.js'

// 2. Library imports
import {
  parse_relay_message,
  validate_client_message
} from '@/lib/index.js'

// 3. Type imports (separate block with `type` keyword)
import type {
  ClientMessage,
  EventFilter,
  SignedEvent
} from '@/types/index.js'

// 4. Namespace imports for schemas
import * as Schema from '@/schema/index.js'
```

**Rules:**
- Use `@/` path alias with `.js` extension
- Vertical alignment on `from` keyword
- Type imports in separate block using `import type`

## Class Structure

Standard class anatomy:

```typescript
export class NostrSocket extends EventEmitter<NostrSocketEvent> {
  // 1. Private readonly fields
  private readonly _config : NostrSocketConfig
  private readonly _queue  : MessageQueue

  // 2. Private mutable fields
  private _init  : boolean = false
  private _timer : NodeJS.Timeout | undefined

  // 3. Constructor with config merging
  constructor (
    host_url : string,
    options  : Partial<NostrSocketConfig> = {}
  ) {
    super()
    this._config = { ...SOCKET_CONFIG, ...options }
  }

  // 4. Public getters
  get config () { return this._config }
  get is_ready () { return this._init }

  // 5. Private methods (underscore prefix)
  private _close () { /* ... */ }
  private _handler (message : unknown) { /* ... */ }

  // 6. Public methods (camelCase)
  public close (delay : number = 100) { /* ... */ }
  public async connect () : Promise<void> { /* ... */ }
}
```

## Type Patterns

### Result<T>

Safe error handling via discriminated union:

```typescript
export type Result<T = any> = OkResult<T> | ErrorResult

export interface OkResult<T = any> {
  ok     : true
  result : T
}

export interface ErrorResult {
  ok    : false
  error : unknown
}
```

Usage:
```typescript
if (!parsed.ok) return this.emit('reject', message, 'invalid')
this.emit('message', parsed.result)
```

### Interfaces

Vertical alignment on colons:

```typescript
export interface NostrSocketConfig {
  max_retries : number
  queue_ival  : number
  queue_limit : number
  msg_timeout : number
  sub_timeout : number
}
```

## Assertion Functions

Type guard assertions in `src/lib/assert.ts`:

```typescript
export function assert_ok (
  value    : unknown,
  message? : string
) : asserts value {
  if (value === false) {
    throw new Error(message ?? 'Assertion failed!')
  }
}

export function assert_exists<T> (
  value    : T | undefined | null,
  message? : string
) : asserts value is NonNullable<T> {
  if (typeof value === 'undefined' || value === null) {
    throw new Error(message ?? 'Value is null or undefined!')
  }
}
```

## Zod Schemas

### Base Types

Short lowercase names with refinement chaining:

```typescript
export const num = z.number()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)

export const int   = num.int()
export const stamp = int.min(500_000_000)

export const hex = z.string()
  .regex(/^[0-9a-fA-F]*$/)
  .refine(e => e.length % 2 === 0)

export const hex32 = hex.refine((e) => e.length === 64)
```

### Schema Validation

```typescript
const parsed = Schema.EVENT.signed.safeParse(event)
if (!parsed.success) {
  return 'note failed schema validation'
}
```

## Config Defaults

Spread merging pattern:

```typescript
export const SOCKET_CONFIG : NostrSocketConfig = {
  max_retries : 3,
  queue_ival  : 500,
  queue_limit : 10,
  msg_timeout : 5000,
  sub_timeout : 30000
}

// In constructor
this._config = { ...SOCKET_CONFIG, ...options }
```

## Formatting Rules

### Vertical Alignment

Align colons in:
- Interface properties
- Object literals
- Function parameters
- Variable declarations

```typescript
// Interface
export interface EventFilter {
  ids     : string[]
  authors : string[]
  kinds   : number[]
}

// Object literal
const config = {
  max_retries : 3,
  msg_timeout : 5000
}

// Function parameters
export function sign_event (
  template : EventTemplate,
  seckey   : string
) : SignedEvent
```

### General Rules

- 2-space indentation (no tabs)
- Spaces around operators
- Space before and after colon in type annotations
- No semicolons (unless required)
- Trailing commas in multiline structures

### Biome Configuration

From `biome.json`:
- **Formatter**: Disabled (manual formatting)
- **Linter**: Enabled
- **Unused imports/variables**: Error
- **`noExplicitAny`**: Off (allowed when necessary)
- **`noBannedTypes`**: Off

## Module Organization

```
src/
├── class/       # Core classes (NostrSocket, NostrClient, EventEmitter)
├── crypto/      # Cryptographic operations
├── lib/         # Library functions (event, parse, assert)
├── schema/      # Zod validation schemas
└── types/       # TypeScript type definitions
```

### Index Files

- Flat re-exports for implementation modules
- Namespace exports for schemas

```typescript
// lib/index.ts
export * from './event.js'
export * from './parse.js'

// schema/index.ts
export * as EVENT from './event.js'
export * as BASE  from './base.js'
```
