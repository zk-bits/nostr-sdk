# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is `@vbyte/nostr-sdk`, a TypeScript SDK for the Nostr protocol. It provides client libraries for connecting to Nostr relays and building peer-to-peer applications.

## Commands

```bash
# Development
npm run check        # TypeScript type checking only
npm run lint         # Check code with Biome
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Biome

# Testing
npm run test         # Run full test suite (tape + faucet)
npm run scratch      # Run scratch.ts for development testing

# Build & Release
npm run build        # Build distribution (tsc + rollup)
npm run package      # Full pipeline: lint → check → test → build
npm run release      # Create git tag and trigger GitHub release
```

## Architecture

### Core Classes (src/class/)

**NostrSocket** - Single relay WebSocket connection
- Promise-wrapped `publish()`, `subscribe()`, and `query()` methods
- Rate-limited message queue (configurable interval & limit)
- Subscription manager with health tracking and keep-alive

**NostrClient** - Multi-relay aggregation
- Manages multiple NostrSocket instances
- Aggregates events from all relays into single event bus
- O(1) event deduplication via KeyCache

**NostrNode** - P2P communication (in development)
- End-to-end encrypted RPC messaging
- One-to-one (send/request) and one-to-many (cast/collect) patterns

### Supporting Classes

- **EventEmitter** - Generic type-safe event handling with once/within/wildcard support
- **MessageQueue** - Batched publishing with rate limiting
- **SubscriptionManager** - Relay subscription lifecycle and EOSE handling
- **KeyCache** - O(1) deduplication cache

### Library Modules (src/lib/)

- **crypto/** - secp256k1/schnorr signatures, NIP-04/NIP-44 encryption, hashing
- **event.ts** - Event creation, signing, ID generation
- **validate.ts** - Event validation
- **encode.ts** - Encoding utilities

### Schema Validation (src/schema/)

Zod-based validation for events, messages, and base types.

## Code Style

- Path alias imports: use `@/class/socket.js` not relative paths
- Strict TypeScript compilation (noImplicitAny, strict mode)
- Biome enforces no unused imports/variables as errors
- `any` type and banned types are allowed when necessary

## Build Output

Rollup generates three formats in `/dist`:
- CommonJS: `main.cjs`
- ES Modules: `module.mjs`
- Browser IIFE: `script.js`

## Dependencies

Core cryptography via `@noble/*` packages (ciphers, curves, hashes). Schema validation via Zod. WebSocket polyfill for compatibility.
