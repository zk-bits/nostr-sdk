# nostr-sdk

Software development kit for the nostr protocol.

> Note: This project is under heavy development. The codebase and documentation are incomplete.

## Overview

*wip*

*overview of the SDK*

**`NostrSocket` Class**

* Used to connect and subscribe to a single nostr relay.
* Methods for `publish`, `subscribe`, and `query` actions.
* Each connection includes a message queue for rate-limited publishing.
* Each subscription includes health tracking and a keep-alive mechanism.

**`NostrClient` Class**

* Used to connect and subscribe to multiple relays (via `NostrSocket`).
* Promise-wrapped methods for `publish`, `subscribe`, and `query` actions.
* Aggregates and labels events from all relays into a single event bus.
* Includes O(1) event ID cache for de-duplication of incoming events.

**`NostrNode` Class**

* A reference node for building custom peer-to-peer protocols over relays.
* Communicate with other nodes via end-to-end encrypted RPC messaging.
* Promise-wrapped one-to-one coummunication with `send` and `request`.
* Promise-wrapped one-to-many coummunication with `cast` and `collect`.
* Automated health tracking for peers through `echo` and `ping` methods.

## How to Use

*wip*

*overview of how the package can be used*

### Installation

*wip*

*instructions on how to install the package*

### Connect to a Single Relay

*wip*

*instructions on how to use the `NostrSocket` class*

### Connect to Multiple Relays

*wip*

*instructions on how to use the `NostrClient` class*

### Connect to Other Peers (P2P)

*wip*

*instructions on how to use the `NostrNode` class*

### Helper Methods

*wip*

This section will cover helper methods that are useful for development.

## Development

*wip*

*intro to development section*

### Requirements

*wip*

* Nodejs (minimum version 22)

### Configuration

*wip*

There will be environment variables to configure the demo scripts.

### Checks and Linting

*wip*

There are `check` and `lint` scripts available for code checking.

### Running the Demo Scripts

*wip*

There will be scripts located in `/dev/scripts` for simulating development relays and nodes.

### Running the Test Suite

*wip*

There will be a suite of unit and integration tests located in `/test`. These tests will include resources from `/dev` to simulate relays and nodes for testing.

### Automated Testing

*wip*

The test suite will be triggered by `.github/workflows/ci.yml` workflow when pushed to the git server (github).

### Build and Release

*wip*

The project can be built, released, and published using the `build`, `release` and `publish` scripts.

The release will be tagged and created on the git server using the `.github/workflows/release.yml` workflow.

## Contribution

*wip*

This is a free and open-source project. All contriubutions are welcome. 

## Resources

*wip*

This will include a list of links to relevant sources, such as:

* Links to the NIP-01, NIP-04, and NIP-44 specifications.
* Links to the package dependencies (@noble, @scure, @vbyte, zod)

## License

*wip*

This project is released under the MIT license.
