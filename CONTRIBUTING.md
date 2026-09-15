# Contributing to JWT Glance

Thank you for your interest in contributing to JWT Glance!

## Development Setup

Requirements:
- Node.js >= 18.0.0
- npm >= 9.0.0

```bash
# Clone the repository
git clone https://github.com/kcodek/jwt-glance.git
cd jwt-glance

# Install dependencies
npm ci

# Compile TypeScript
npm run compile

# Run the test suite
npm test
```

## Running the Extension Locally

1. Open this repository in VS Code: `code .`
2. Press `F5` (or select **Run > Start Debugging**) to launch an **Extension Development Host** window.
3. Open any sample file with a JWT token (e.g. in `.env`, `.http`, or source code) to test live badges and hover cards.

## Code Guidelines

- **Zero-Network Invariant**: The core engine and extension must never initiate outbound network traffic or telemetry.
- **Strict RFC 7519 Semantics**: All temporal and structural checks must strictly follow RFC specifications.
- **Test Coverage**: All bug fixes and new features must be accompanied by unit tests in `test/unit/`.
