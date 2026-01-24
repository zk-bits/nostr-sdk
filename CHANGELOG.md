# CHANGELOG

## [1.0.1]

### Fixed
- Race condition in `NostrSubscription` keep-alive timer that could fire after cancellation
- Events from relays are now validated (signature verification) before being emitted

### Changed
- `EventCache` now uses secondary indexes for `kind` and `pubkey` fields, improving filter performance from O(n*m) to O(k) for simple queries

### Documentation
- Added entropy warning to `gen_seckey()` for optional seed parameter

## [1.0.0]

### Added
- `NostrNode` class now exported and production-ready for P2P encrypted RPC messaging
- MIT LICENSE file
- `docs/CONTRIBUTING.md` - Contribution guidelines
- `docs/ARCHITECTURE.md` - Architecture overview and diagrams

### Changed
- **Breaking:** Renamed `ready` getter to `is_ready` on `NostrClient` and `NostrNode` for API consistency
- **Breaking:** Error event signature changed from `[unknown, unknown]` to `[string]` on `NostrSocket`
- `assert_ok()` now throws for all falsy values, not just `false`
- `BaseRpcTemplate.version` is now optional (implementation uses protocol version constant)
- Improved `EventFilter` type safety with stricter index signature

### Fixed
- Race condition in `NostrSocket.connect()` when called concurrently
- Race condition in `NostrNode.connect()` when called concurrently
- Memory leak in `NostrSubscription.listen()` - event handlers now properly removed
- State machine in `NostrNode._on_cancel()` now correctly sets `_active` to false
- Error handling in `NostrNode._subscribe()` now properly emits errors on connection failure
- NIP-04 encryption documentation (clarified as deprecated, use NIP-44)
- Typo in encrypt.ts (`encryped` -> `encrypted`)

## [0.0.4]

- Fixed issues with event filtering and matching.
- Added more test cases.
- Added `test/config.ts` file for configuration.
- Made error responses more useful.
- Added documentation.

## [0.0.3]

- More fixes and improvements.
- Expanded test coverage.
- Updated dependencies.
- Updated documentation.

## [0.0.2]

- Numerous fixes and improvements.

## [0.0.1]

- Initial release.
