# Architecture Overview

## Layer Diagram

```
┌─────────────────────────────────────────────────────┐
│                   Application                        │
├─────────────────────────────────────────────────────┤
│  NostrNode (P2P)  │  NostrClient (Multi-relay)      │
├───────────────────┼─────────────────────────────────┤
│                   │  SubscriptionManager             │
│                   ├─────────────────────────────────┤
│                   │  NostrSubscription               │
├───────────────────┴─────────────────────────────────┤
│                    NostrSocket                       │
├─────────────────────────────────────────────────────┤
│  MessageQueue  │  EventEmitter  │  KeyCache         │
├─────────────────────────────────────────────────────┤
│                    WebSocket                         │
└─────────────────────────────────────────────────────┘
```

## Core Classes

### NostrSocket
Single relay WebSocket connection. Handles:
- Connection lifecycle (connect, close, reconnect)
- Message queue with rate limiting
- Subscription management per relay
- Event publishing with receipt confirmation

### NostrClient
Multi-relay aggregation layer. Features:
- Manages multiple NostrSocket instances
- Event deduplication via KeyCache
- First-success semantics for publish/query
- Unified subscription management

### NostrNode
P2P encrypted RPC over Nostr. Provides:
- End-to-end encrypted messaging (NIP-44)
- Request/response patterns
- Broadcast/collect patterns
- Peer filtering and validation

### NostrSubscription
Single relay subscription. Manages:
- REQ/CLOSE protocol lifecycle
- EOSE (end of stored events) handling
- Keep-alive resubscription
- Event collection and filtering

### SubscriptionManager
Multi-relay subscription aggregation:
- Event deduplication across relays
- First-EOSE activation semantics
- Coordinated cleanup

## Message Flow

### Publishing
```
Client.publish(event)
  ├─→ Socket1.publish(event) ─→ Relay1
  ├─→ Socket2.publish(event) ─→ Relay2
  └─→ Socket3.publish(event) ─→ Relay3
       ↓ (first OK)
     Promise.resolve()
```

### Subscribing
```
Client.subscribe(filter)
  ├─→ SubscriptionManager
  │     ├─→ Sub1 (Socket1) ─→ REQ to Relay1
  │     ├─→ Sub2 (Socket2) ─→ REQ to Relay2
  │     └─→ Sub3 (Socket3) ─→ REQ to Relay3
  │           ↓ (events)
  │     KeyCache.dedup()
  │           ↓
  └─── emit('event', dedupedEvent)
```

## Crypto Layer

- **secp256k1**: Key generation, Schnorr signatures
- **NIP-44**: ChaCha20 encryption, HKDF key derivation, HMAC authentication
- **NIP-04** (deprecated): AES-CBC encryption

## Event Types (NIP-01)

| Kind Range | Type | Caching |
|------------|------|---------|
| 0-9999 | Regular | By event ID |
| 10000-19999 | Replaceable | By pubkey:kind |
| 20000-29999 | Ephemeral | Not cached |
| 30000-39999 | Addressable | By pubkey:kind:d-tag |
