# Code Conventions

Coding conventions for `@vbyte/nostr-sdk`.

## Naming

| Context | Convention | Examples |
|---------|------------|----------|
| Files | `lowercase.ts` | `socket.ts`, `emitter.ts` |
| Library functions | `snake_case` | `create_event()`, `parse_content()` |
| Class methods | `snake_case` | `connect()`, `publish()` |
| Private fields | `_snake_case` | `_config`, `_queue`, `_init` |
| Public getters | `is_snake_case` | `is_ready`, `is_closed` |
| Config properties | `snake_case` | `max_retries`, `msg_timeout` |
| Constants | `UPPER_SNAKE_CASE` | `SOCKET_CONFIG` |
| Types/Interfaces | `PascalCase` | `SignedEvent`, `EventFilter` |
| Zod schemas | `lowercase` | `num`, `hex`, `str`, `stamp` |

## Formatting

### Vertical Alignment

Align colons in interfaces, objects, parameters, and declarations:

```typescript
// Interface properties
export interface NostrSocketConfig {
  max_retries : number
  queue_ival  : number
  queue_limit : number
  msg_timeout : number
}

// Object literals
const config = {
  max_retries : 3,
  msg_timeout : 5000
}

// Arrays
const items = [ 'apple', 'banana', 'grapes' ]

const planets = [
  'earth',
  'mars',
  'jupiter'
]

// Function parameters
export function sign_event (
  template : EventTemplate,
  seckey   : string
) : SignedEvent

// Variable declarations
private readonly _config : NostrSocketConfig
private readonly _queue  : MessageQueue
private readonly _subs   : Map<string, NostrSubscription> = new Map()
```

### General Rules

- 2-space indentation (no tabs)
- Spaces around operators
- Space before and after colon in type annotations
- No semicolons (unless required)
- Trailing commas in multiline structures

## Imports

```typescript
// 1. Class imports (internal)
import { EventEmitter } from '@/class/emitter.js'
import { MessageQueue } from '@/class/queue.js'

// 2. Library imports
import {
  parse_relay_message,
  validate_client_message
} from '@/lib/index.js'

// 3. Type imports (separate block)
import type {
  ClientMessage,
  EventFilter,
  SignedEvent
} from '@/types/index.js'

// 4. Namespace imports for schemas
import * as Schema from '@/schema/index.js'
```

- Use `@/` path alias with `.js` extension
- Type imports in separate block using `import type`

## Class Structure

```typescript
export class NostrSocket extends EventEmitter<NostrSocketEvent> {
  // 1. Private readonly fields
  private readonly _config : NostrSocketConfig
  private readonly _queue  : MessageQueue

  // 2. Private mutable fields
  private _closed : boolean = false
  private _init   : boolean = false

  // 3. Constructor
  constructor (
    host_url : string,
    options  : Partial<NostrSocketConfig> = {}
  ) {
    super()
    this._config = { ...SOCKET_CONFIG, ...options }
  }

  // 4. Private methods
  private _attach_listeners () { /* ... */ }

  // 5. Public getters
  get config ()   { return this._config }
  get is_ready () { return this._init }

  // 6. Private event handlers
  private _on_close () { /* ... */ }

  // 7. Public methods
  public close () { /* ... */ }
  public async connect () : Promise<void> { /* ... */ }
}
```

## Types

### Result<T>

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

### Event Maps

```typescript
// Inline definition
export class NostrClient extends EventEmitter<{
  closed : [ NostrSocket ],
  ready  : [ NostrSocket ],
  error  : [ string, NostrSocket ]
}> {

// Or separate interface
export interface NostrSocketEvent {
  ready   : [ NostrSocket ]
  closed  : [ NostrSocket ]
  error   : [ string ]
  message : [ RelayMessage ]
}
```

### Generic Patterns

```typescript
// Class with constraint
export class EventEmitter<T extends Record<string, any[]> = {}> {
  public on <K extends keyof T> (
    eventName : K,
    handler   : (...args: T[K]) => void
  ) : void
}

// Function with generic
export function exec <T = any> (fn : () => T) : Result<T>
```

## Config Defaults

```typescript
export const SOCKET_CONFIG : NostrSocketConfig = {
  max_retries : 3,
  queue_ival  : 500,
  queue_limit : 10,
  msg_timeout : 5000
}

// Merge in constructor
this._config = { ...SOCKET_CONFIG, ...options }
```

## Zod Schemas

```typescript
export const num = z.number()
  .min(Number.MIN_SAFE_INTEGER)
  .max(Number.MAX_SAFE_INTEGER)

export const int   = num.int()
export const stamp = int.min(500_000_000)
export const hex   = z.string().regex(/^[0-9a-fA-F]*$/)
export const hex32 = hex.refine((e) => e.length === 64)
```

## JSDoc

```typescript
/**
 * Brief description of the class or method.
 * @param relay    WebSocket URL or existing WebSocket instance
 * @param options  Optional configuration overrides
 * @returns        Promise that resolves with the result
 * @throws Error   If validation fails
 */
```

Inline comments: single-line, action-oriented, explain **why** not what.

## Module Organization

```
src/
├── class/       # Core classes
├── crypto/      # Cryptographic operations
├── lib/         # Library functions
├── schema/      # Zod validation schemas
└── types/       # TypeScript type definitions
```

Index files use flat re-exports (`export * from`) for implementations, namespace exports (`export * as`) for schemas.

## Biome

- Formatter: Disabled (manual formatting)
- Linter: Enabled
- Unused imports/variables: Error
- `noExplicitAny`: Off
- `noBannedTypes`: Off
