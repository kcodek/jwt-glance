# JWT Glance

> **Zero-click ambient JWT inspection lens for VS Code & Cursor.**

JWT Glance automatically surfaces JWT expiration countdowns, algorithm information, and sanitized claim cards directly within your editor—eliminating the insecure reflex of pasting sensitive credentials into third-party web decoders (`jwt.io`) and preventing cryptic `401 Unauthorized` test failures caused by stale fixtures.

---

## ✨ Features

- ⚡ **Zero-Click Inlay Hints:** Inline badges appear immediately before detected tokens in `.env`, `.http`, `.rest`, `.json`, `.yml`, and source files (e.g. `[JWT · Active 42m · HS256]`, `[JWT · Expired 8m · RS256]`, or `[JWT · UNSECURED alg:none · Active 42m]`).
- 🔍 **Rich Sanitized Hover Card:** Hover over any token to inspect decoded headers, clean claim tables (`iss`, `sub`, `aud`, `roles`), and formatted payload JSON with an unverified signature notice (`Signature: Not performed`).
- 🛡️ **Credential Isolation:** Pure local execution. Raw secret strings are never logged, never transmitted over sockets, and never leaked to external networks.
- ⏱️ **60-Second Live Timer:** Relative expiration countdowns (`Active 42m` → `Active 41m`) refresh automatically without requiring file edits or typing.
- 🪶 **Zero Runtime Dependencies:** Strictly `"dependencies": {}`. Pure deterministic TypeScript core; fast startup with zero supply-chain risk.

---

## 🚀 How to Run & Use as a Local Extension

### Step 1: Package the `.vsix`
Build the production bundle and generate the `.vsix` extension package:
```bash
npm run package
```
This builds `dist/extension.js` via esbuild and produces `jwt-glance-0.1.0.vsix` (an ultra-compact ~6.5 KB archive).

### Step 2: Install into VS Code or Cursor

**Option A — Via Command Line:**
```bash
# In VS Code
code --install-extension jwt-glance-0.1.0.vsix

# In Cursor
cursor --install-extension jwt-glance-0.1.0.vsix
```

**Option B — Via the Editor GUI:**
1. Open VS Code or Cursor.
2. Open the **Extensions** view (`Cmd+Shift+X` on macOS or `Ctrl+Shift+X` on Windows/Linux).
3. Click the `...` menu (Views and More Actions) in the top-right corner of the Extensions panel.
4. Select **Install from VSIX...**.
5. Select `jwt-glance-0.1.0.vsix`.

### Step 3: Test the Ambient Inlay Hints & Hover
1. Open the included fixture file [`test/fixtures/sample.env`](file:///Users/kishu/coding/github/jwt-glance/test/fixtures/sample.env) or any `.env` file containing tokens.
2. Notice the inline badge rendered immediately before each token:
   - Active tokens show: `[JWT · Active 42m · HS256]`
   - Expired tokens show: `[JWT · Expired 8m · RS256]`
   - Unsecured tokens show: `[JWT · UNSECURED alg:none · Active 42m]`
3. Hover your cursor over any token to view the decoded claims table and payload.

---

## 🛠️ How to Test WITHOUT Installing as an Extension

You don't need to install the `.vsix` to test or develop JWT Glance. Three zero-install testing workflows are available:

### Approach 1: Extension Development Host (F5 Debugging)
Run the extension in a temporary, isolated VS Code window directly from source code:

1. Open this repository in VS Code:
   ```bash
   code /Users/kishu/coding/github/jwt-glance
   ```
2. Press **`F5`** (or open the **Run & Debug** tab `Cmd+Shift+D` and click **"Run Extension (Development Host)"**).
3. An **[Extension Development Host]** VS Code window will launch with JWT Glance active.
4. In that development window, open [`test/fixtures/sample.env`](file:///Users/kishu/coding/github/jwt-glance/test/fixtures/sample.env) to see live inlay badges and hover cards.
5. Any source changes you make in `src/` can be reloaded instantly in the guest window via `Cmd+R` (or `Developer: Reload Window`).

---

### Approach 2: Terminal CLI Inspector (No Editor Needed)
Inspect and preview any JWT token from the command line without opening VS Code:

```bash
# Test any custom token:
npm run inspect -- "<YOUR_JWT_TOKEN_HERE>"

# Or run with the built-in fixture sample:
npm run inspect
```

**Terminal Output Preview:**
```text
--- Inlay Hint Badge Preview ---
[JWT · Active 42m · HS256]

--- Decoded Assessment Object ---
{
  recognized: true,
  algorithm: 'HS256',
  isUnsecured: false,
  temporalStatus: 'ACTIVE',
  expiresAtIso: '2026-09-10T14:00:00.000Z',
  secondsUntilExpiration: 2520,
  issuedAtIso: '2026-09-10T12:00:00.000Z',
  notBeforeIso: null,
  issuer: 'https://auth.example.com',
  audience: null,
  subject: 'user-42',
  roles: [ 'admin', 'developer' ],
  warnings: [],
  verification: { status: 'NOT_PERFORMED' }
}

--- Hover Card Markdown Preview ---
### JWT Glance

**Algorithm:** `HS256`

> ℹ️ **Signature: Not performed** *(Local inspection only)*

- **Temporal Status:** `ACTIVE` (expires in 42m)
- **Expires At:** `2026-09-10T14:00:00.000Z`

#### Key Claims
| Claim | Value |
| :--- | :--- |
| `iss` | https://auth.example.com |
| `sub` | user-42 |
| `roles` | admin, developer |
```

---

### Approach 3: Automated Test Suite (62 Tests)
Run the full test suite via Node's native test runner (`node:test`):

```bash
# Run all 62 tests (unit, syntax scanner, security vectors, performance, and corpus)
npm test
```

**Run targeted test suites:**
```bash
# Compile tests
npm run test:compile

# Test inlay hints badge formatting
node --test out/test/unit/inlayHints.test.js

# Test token detection across .env, .http, JSON, SQL, bash
node --test out/test/unit/lineScanner.test.js

# Test security attack vectors (alg confusion, malformed payloads)
node --test out/test/unit/attackVectors.test.js

# Test performance (10,000 lines scanned in ~11ms)
node --test out/test/perf/scannerBenchmark.test.js

# Test 12,000-sample adversarial corpus (verifies zero false positives)
node --test out/test/corpus/adversarial.test.js
```

---

## ⚙️ Configuration Settings

Customize JWT Glance behavior in your VS Code `settings.json`:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `jwtGlance.enabled` | `boolean` | `true` | Enable or disable ambient glance badges and hover cards. |
| `jwtGlance.position` | `'top' \| 'left'` | `'top'` | Badge position: `'top'` renders above the line (CodeLens), `'left'` renders inline before the token. |
| `jwtGlance.maxLineLength` | `number` | `10000` | Maximum character length of a line to scan (prevents lag on minified files). |

---

## 🏗️ Architecture Invariants

- **Hexagonal Separation:** Pure TypeScript evaluation logic in `src/core/` contains **zero** dependencies and **zero** imports from `vscode` or Node filesystem modules.
- **Strict Trust Semantics:** Unverified tokens are labeled `Signature: Not performed` to prevent false senses of cryptographic security.
- **Privacy by Default:** Inlay hint badges never display PII claims (`sub`, `email`, or `roles`) inline to ensure privacy during screen shares.

---

## 📄 License

MIT © 2026 JWT Glance Contributors
