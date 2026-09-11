# JWT Glance

> **Zero-click ambient JWT inspection lens for VS Code & Cursor.**

JWT Glance automatically surfaces JWT expiration countdowns, algorithm information, and sanitized claim cards directly within your editor—eliminating the insecure reflex of pasting sensitive credentials into third-party web decoders (`jwt.io`) and preventing cryptic `401 Unauthorized` test failures caused by stale fixtures.

---

## ✨ Features

- ⚡ **Zero-Click Inlay Hints & CodeLens:** Inline badges appear immediately before or above detected tokens in `.env`, `.http`, `.rest`, `.json`, `.yml`, and source files (e.g. `[JWT · user-42 · Active 42m]`, `[JWT · kf1sadmin@... · Expired 2d]`, or `[JWT · UNSECURED alg:none · local-dev-user · Active 42m]`).
- 🧩 **2- and 3-Segment Format Support:** Accurately recognizes both standard signed 3-segment tokens (`header.payload.signature`) and signature-omitted 2-segment tokens (`header.payload`) commonly used in `.env`, logs, and development mocks.
- 🎯 **Interactive Action Palette:** Click any badge to open a categorized quick menu:
  - **Open Decoded Token in New Editor:** Opens a dedicated, formatted JSON editor tab with syntax highlighting, searchability, and folding.
  - **Copy Actions:** Copy full decoded payload JSON or raw token string.
  - **Single-Click Claim Copying:** Copy individual claims directly (`Subject`, `Roles`, `Issuer`, `Audience`, `Expiration`) to clipboard with confirmation.
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
   - Active tokens show: `[JWT · user-42 · Active 42m]`
   - Expired tokens show: `[JWT · service-account-01 · Expired 8m]`
   - Unsecured tokens show: `[JWT · UNSECURED alg:none · local-dev-user · Active 42m]`
   - Tokens without a subject show: `[JWT · Active 42m]`
3. Hover your cursor over any token to view the decoded claims table and payload, or click the badge to open the Action Palette.

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
[JWT · user-42 · Active 42m]

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
### JWT Glance · `ACTIVE` (expires in 42m)
**Algorithm:** `HS256` &nbsp;|&nbsp; > ℹ️ **Signature: Not performed** *(Local inspection only)*

**Expires:** `2026-09-10T14:00:00.000Z` &nbsp;•&nbsp; **Subject:** `user-42` &nbsp;•&nbsp; **Issuer:** https://auth.example.com &nbsp;•&nbsp; **Roles:** `admin, developer`
```

---

### Approach 3: Automated Test Suite (77 Tests)
Run the full test suite via Node's native test runner (`node:test`):

```bash
# Run all 77 tests (unit, syntax scanner, security vectors, performance, and corpus)
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
- **High-Signal Ambient Badges:** Inlay badges prioritize credential identity (`sub`) and temporal freshness (`Active` / `Expired`), keeping full claim payloads safely tucked into the hover card and interactive action palette.

---

## 📄 License

MIT © 2026 JWT Glance Contributors
