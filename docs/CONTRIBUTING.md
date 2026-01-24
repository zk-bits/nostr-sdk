# Contributing to @vbyte/nostr-sdk

## Development Setup

1. Clone the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`

## Code Style

See [CONVENTIONS.md](./CONVENTIONS.md) for detailed coding conventions.

Key points:
- Use path aliases (`@/class/socket.js`)
- Follow snake_case for functions, PascalCase for classes
- Run `npm run lint:fix` before committing

## Testing

- Unit tests: `npm test`
- Stress tests: `npm run test:stress`
- Full suite: `npm run test:all`

## Pull Request Process

1. Create a feature branch from `master`
2. Write tests for new functionality
3. Ensure all tests pass: `npm run package`
4. Update CHANGELOG.md
5. Submit PR with clear description

## Commit Messages

Format: `<type>: <description>`

Types: feat, fix, docs, refactor, test, chore

## Reporting Issues

Include:
- Node.js version
- Package version
- Minimal reproduction code
- Expected vs actual behavior
