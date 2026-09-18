# Contributing to JWT Glance

Thank you for your interest in contributing to JWT Glance!

## Development Setup

Requirements:
- Node.js >= 20.0.0
- npm >= 9.0.0

```bash
# Clone the repository
git clone https://github.com/kcodek/jwt-glance.git
cd jwt-glance

# Install dependencies
npm ci

# Type-check TypeScript
npm run compile

# Run the test suite
npm test
```

---

## Local Development & Testing Workflows

### 1. Extension Development Host (`F5` Debugging in VS Code)
To test changes in a clean, isolated development window directly from source:
1. Open this repository root folder in VS Code: `code .`
2. Press **`F5`** (or go to **Run and Debug** `Cmd+Shift+D` / `Ctrl+Shift+D` and click the green play button).
3. A separate **[Extension Development Host]** window will launch with JWT Glance running live.
4. Open [`test/fixtures/sample.env`](test/fixtures/sample.env) to see live badges and hover cards.
5. Press `Cmd+R` / `Ctrl+R` inside the guest window after rebuilding to reload changes.

### 2. Direct Symlink Workflow (Fastest for Local Development)
Link the repository directly into your local extensions folder:

```bash
# For standard VS Code:
ln -s "$(pwd)" ~/.vscode/extensions/jwt-glance

# For Cursor:
ln -s "$(pwd)" ~/.cursor/extensions/jwt-glance

# For VS Code Insiders:
ln -s "$(pwd)" ~/.vscode-insiders/extensions/jwt-glance
```
After linking, run `npm run build` and press `Cmd+Shift+P` -> **`Developer: Reload Window`**.

### 3. Terminal Development Inspector (No Editor Needed)
Quickly test token parsing and formatting directly in the terminal:

```bash
# Inspect custom token:
npm run inspect -- "<YOUR_JWT_TOKEN_HERE>"

# Run with generated active sample:
npm run inspect
```

---

## Test Suite Execution

Run the complete test suite via Node's native test runner (`node:test`):

```bash
# Run all tests (unit, syntax scanner, security attack vectors, performance, and corpus)
npm test

# Run targeted test suites:
npm run test:compile
node --test out/test/unit/badgeFormatter.test.js
node --test out/test/unit/filter.test.js
node --test out/test/unit/hover.test.js
node --test out/test/unit/lineScanner.test.js
node --test out/test/unit/attackVectors.test.js
node --test out/test/perf/scannerBenchmark.test.js
node --test out/test/corpus/adversarial.test.js
```

---

## Pre-Flight Verification & Packaging

Before submitting PRs or cutting release tags:

```bash
# 1. Verify all tests pass
npm test

# 2. Build production minified bundle
npm run build:prod

# 3. Package and audit VSIX contents
npm run package
npx @vscode/vsce ls
```

---

## Code Guidelines & Architecture Invariants

- **Zero-Network Invariant**: The core engine and extension must never initiate outbound network traffic, fetch remote JWKS, or transmit telemetry.
- **Hexagonal Separation**: Pure token parsing and assessment logic in `src/core/` must contain zero dependencies and zero imports from `vscode` or Node filesystem modules.
- **Strict RFC 7519 Semantics**: All temporal and structural checks must strictly follow RFC specifications.
- **Test Coverage**: All bug fixes and features must include unit tests in `test/unit/`.

