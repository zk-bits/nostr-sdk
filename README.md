# @vbyte/nostr-sdk

[![npm version](https://img.shields.io/npm/v/@vbyte/nostr-sdk)](https://npmjs.com/package/@vbyte/nostr-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

A TypeScript SDK for the Nostr protocol.

## Features

- **Single relay connections** - `NostrSocket` for connecting to individual relays
- **Multi-relay aggregation** - `NostrClient` for managing multiple relay connections
- **NIP-04 and NIP-44 encryption** - End-to-end encrypted direct messages
- **Schnorr signatures** - secp256k1 cryptographic signing
- **Rate-limited message queuing** - Configurable batch publishing
- **Event deduplication** - O(1) cache for filtering duplicate events
- **TypeScript-first** - Full type definitions included
- **Zod schema validation** - Runtime validation for events and messages

## Installation

```bash
npm install @vbyte/nostr-sdk
```

```bash
pnpm add @vbyte/nostr-sdk
```

**Note:** The `ws` package is a peer dependency for Node.js environments.

## Quick Start

### Connect to a Single Relay

```typescript
import { NostrSocket, CRYPTO, LIB } from '@vbyte/nostr-sdk'

// Create socket and connect
const socket = new NostrSocket('wss://relay.example.com')
await socket.connect()

// Generate keys
const seckey = CRYPTO.gen_seckey()
const pubkey = CRYPTO.get_pubkey(seckey)

// Create and sign an event
const template = LIB.create_event({
  kind: 1,
  content: 'Hello Nostr!',
  pubkey
})
const event = LIB.sign_event(template, seckey)

// Publish the event
await socket.publish(event)

// Close connection
socket.close()
```

### Subscribe to Events

```typescript
const sub = await socket.subscribe({ kinds: [1], limit: 10 })

sub.on('event', (event) => console.log(event))
```

### Query Events

```typescript
const events = await socket.query({ kinds: [1], limit: 10 })
console.log(events)
```

### Multi-Relay Client

```typescript
import { NostrClient } from '@vbyte/nostr-sdk'

const client = new NostrClient([
  'wss://relay1.example.com',
  'wss://relay2.example.com'
])
await client.connect()

// Publish to all relays (resolves on first success)
await client.publish(event)

// Subscribe with automatic deduplication
const sub = client.subscribe({ kinds: [1] })
sub.on('event', (event) => console.log(event))

// Close all connections
client.close()
```

## API Reference

### NostrSocket

Single WebSocket connection to a Nostr relay.

**Constructor**

```typescript
new NostrSocket(url: string, options?: Partial<NostrSocketConfig>)
```

**Options**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `max_retries` | `number` | `3` | Max reconnection attempts |
| `queue_ival` | `number` | `500` | Queue processing interval (ms) |
| `queue_limit` | `number` | `10` | Messages per queue batch |
| `msg_timeout` | `number` | `5000` | Message response timeout (ms) |
| `sub_timeout` | `number` | `30000` | Subscription EOSE timeout (ms) |

**Methods**

| Method | Returns | Description |
|--------|---------|-------------|
| `connect()` | `Promise<void>` | Establish connection |
| `publish(event)` | `Promise<PublishResponse>` | Publish signed event |
| `subscribe(filters)` | `NostrSubscription` | Create persistent subscription |
| `query(filters, duration?)` | `Promise<SignedEvent[]>` | One-shot event query |
| `close(delay?)` | `void` | Close connection |
| `send(msg)` | `void` | Send message via queue |

**Events**

| Event | Payload | Description |
|-------|---------|-------------|
| `ready` | `NostrSocket` | Connection established |
| `closed` | `NostrSocket` | Connection closed |
| `error` | `[unknown, unknown]` | Error occurred |
| `message` | `RelayMessage` | Relay message received |
| `notice` | `string` | NOTICE message from relay |
| `receipt` | `RelayReceiptMessage` | OK receipt for published event |

### NostrClient

Multi-relay client with event deduplication.

**Constructor**

```typescript
new NostrClient(relays: string[], options?: Partial<NostrClientConfig>)
```

**Additional Options**

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `cache_size` | `number` | `500` | Event deduplication cache size |

**Methods**

Same as `NostrSocket`, but operations are distributed across all relays:
- `connect()` - Resolves when first relay connects
- `publish(event)` - Resolves on first successful publish
- `query(filters, duration?)` - Resolves with first relay's response
- `subscribe(filter)` - Returns `SubscriptionManager` directly with deduplication
- `close()` - Closes all connections

## Crypto Module

```typescript
import { CRYPTO } from '@vbyte/nostr-sdk'
// or
import * as CRYPTO from '@vbyte/nostr-sdk/crypto'
```

### Key Management

| Function | Description |
|----------|-------------|
| `gen_seckey(seed?)` | Generate secret key (optionally from seed) |
| `get_pubkey(seckey)` | Derive public key from secret key |
| `get_shared_secret(seckey, pubkey)` | Compute ECDH shared secret |

### Signatures

| Function | Description |
|----------|-------------|
| `create_signature(seckey, message)` | Create Schnorr signature |
| `verify_signature(message, pubkey, sig)` | Verify Schnorr signature |

### Encryption

| Function | Description |
|----------|-------------|
| `nip04_encrypt(secret, content, iv?)` | NIP-04 AES-CBC encryption |
| `nip04_decrypt(secret, content)` | NIP-04 AES-CBC decryption |
| `nip44_encrypt(secret, content, nonce?)` | NIP-44 ChaCha20 encryption |
| `nip44_decrypt(secret, payload)` | NIP-44 ChaCha20 decryption |

### Encoding

| Function | Description |
|----------|-------------|
| `encode_b64url(data)` | Encode bytes to base64url |
| `decode_b64url(str)` | Decode base64url to bytes |

## Library Module

```typescript
import { LIB } from '@vbyte/nostr-sdk'
// or
import * as LIB from '@vbyte/nostr-sdk/lib'
```

### Event Handling

| Function | Description |
|----------|-------------|
| `create_event(config)` | Create event template |
| `sign_event(template, seckey)` | Sign event with secret key |
| `verify_event(event)` | Verify event signature (returns error string or null) |
| `get_event_id(template)` | Compute event ID hash |
| `get_event_tag(event, tag)` | Get first tag by name |
| `filter_event_tags(event, tag)` | Get all tags by name |
| `is_pubkey_mentioned(event, pubkey)` | Check if pubkey is in 'p' tags |
| `is_event_expired(event, current?)` | Check if event has expired |

### Filtering

| Function | Description |
|----------|-------------|
| `match_filter(event, filter)` | Check if event matches filter |
| `match_any_filter(event, filters)` | Check if event matches any filter |
| `process_filters(events, filters)` | Filter event array |
| `is_kind_regular(kind)` | Check if kind is regular (1, 2, 4-44, 1000-9999) |
| `is_kind_replace(kind)` | Check if kind is replaceable (0, 3, 10000-19999) |
| `is_kind_ephemeral(kind)` | Check if kind is ephemeral (20000-29999) |
| `is_kind_address(kind)` | Check if kind is addressable (30000-39999) |

## Types

```typescript
import type {
  // Events
  SignedEvent,
  EventTemplate,
  EventFilter,
  EventConfig,

  // Configuration
  NostrSocketConfig,
  NostrClientConfig,

  // Responses
  PublishResponse
} from '@vbyte/nostr-sdk'
```

## Development

### Requirements

- Node.js 18+ (20+ recommended)

### Setup

```bash
git clone https://github.com/cmdcode/nostr-sdk
cd nostr-sdk
npm install
```

### Scripts

| Command | Description |
|---------|-------------|
| `npm run check` | TypeScript type checking |
| `npm run lint` | Biome linting |
| `npm run lint:fix` | Auto-fix linting issues |
| `npm run format` | Format code with Biome |
| `npm run test` | Run test suite |
| `npm run build` | Build distribution |
| `npm run package` | Full pipeline (lint, check, test, build) |

### Build Outputs

- `dist/main.cjs` - CommonJS
- `dist/module.mjs` - ES Modules
- `dist/script.js` - Browser IIFE (available via unpkg CDN)

## Resources

- [NIP-01: Basic Protocol](https://github.com/nostr-protocol/nips/blob/master/01.md)
- [NIP-04: Encrypted Direct Messages](https://github.com/nostr-protocol/nips/blob/master/04.md)
- [NIP-44: Versioned Encryption](https://github.com/nostr-protocol/nips/blob/master/44.md)
- [@noble/curves](https://github.com/paulmillr/noble-curves) - Cryptography
- [@noble/hashes](https://github.com/paulmillr/noble-hashes) - Hashing
- [@noble/ciphers](https://github.com/paulmillr/noble-ciphers) - Ciphers
- [Zod](https://zod.dev) - Schema validation

## Contributing

Contributions are welcome. Please open an issue or submit a pull request.

## License

[MIT License](LICENSE)
