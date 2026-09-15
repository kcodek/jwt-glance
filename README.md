# JWT Glance

> **Zero-click ambient JWT inspection lens for VS Code & Cursor.**

JWT Glance automatically surfaces JWT expiration countdowns, algorithm information, and sanitized claim cards directly within your editor—eliminating the insecure reflex of pasting sensitive credentials into third-party web decoders (`jwt.io`) and preventing cryptic `401 Unauthorized` test failures caused by stale fixtures.

---

## ✨ Features

- ⚡ **Zero-Click Ambient Badges & CodeLens:** Badges appear immediately above the line (`position: top`) or inline before detected tokens (`position: left`) in `.env`, `.http`, `.rest`, `.json`, `.yml`, and source files (e.g. `[JWT · user-42 · Active 42m]`, `[JWT · RS256 NO SIG ⚠️ · service · Active 2h]`, or `[JWT · UNSECURED alg:none · local-dev-user · Active 42m]`).
- 🧩 **Standard 3-Segment & Two-Segment Inspection:** Accurately inspects standard signed 3-segment tokens (`header.payload.signature`), flags missing signatures on signed algorithms, and supports two-segment JWT-like inspection (`header.payload`) commonly found in `.env` drafts and mocks.
- 🎯 **Interactive Action Palette:** Click any badge to open a categorized quick menu:
  - **Open Decoded Token in New Editor:** Opens a dedicated, formatted JSON editor tab with syntax highlighting, searchability, and folding.
  - **Copy Sanitized Token:** Exports a structurally valid token with sensitive claims redacted for safe inclusion in bug reports and tickets.
  - **Copy Actions:** Copy full decoded payload JSON or raw token string.
  - **Single-Click Claim Copying:** Copy individual claims directly (`Subject`, `Roles`, `Issuer`, `Audience`, `Expiration`) to clipboard with confirmation.
- ⌨️ **Command Palette & Zero-Leak Clipboard Inspection (`Cmd+Shift+P`):** Inspect tokens at cursor, copy sanitized tokens, safely decode tokens straight from the clipboard in memory without touching disk, or toggle ambient badges with one keystroke.
- 🔍 **Rich Sanitized Hover Card:** Hover over any token to inspect decoded headers, clean claim tables (`iss`, `sub`, `aud`, `roles`), and formatted payload JSON with explicit signature presence (`Signature: Present, not verified`, `Signature: Missing`, or `Signature: Unexpected`).
- 🛡️ **Credential Isolation:** Pure local execution. Raw secret strings are never logged, never transmitted over sockets, and never leaked to external networks.
- ⏱️ **60-Second Live Timer:** Relative expiration countdowns (`Active 42m` → `Active 41m`) refresh automatically without requiring file edits or typing.
- 🪶 **Zero Runtime Dependencies:** Strictly `"dependencies": {}`. Pure deterministic TypeScript core; fast startup with zero supply-chain risk.

---

## 🔒 Security & Privacy Notice

- **100% Offline & Private:** JWT Glance runs completely inside your local editor. It has zero network calls, zero analytics, zero telemetry, and never logs credentials.
- **Decoding ≠ Verification:** Ambient decoding surfaces structural claims for developer convenience. **Decoding a JWT does not prove cryptographic authenticity.** Signatures must always be verified by your backend application against verified public keys or HMAC secrets.

---

## 🚀 How to Run & Use in VS Code

When you run `npm run build:prod` or `npm run build`, esbuild outputs the compiled bundle to:
```text
dist/
├── extension.js        <-- The compiled CommonJS bundle (main entry point)
└── extension.js.map    <-- Source map for debugging
```
Because VS Code requires extensions to be installed or loaded via the extension host, choose one of the three methods below to run it:

---

### Method 1: Package & Install as a `.vsix` (Recommended)

This generates a standalone installable file that works exactly like an extension from the Marketplace.

1. **Package the extension** (from the project root, not inside `dist`):
   ```bash
   $ npm run package
   ```
   This compiles the bundle and creates **`jwt-glance-0.1.0.vsix`** in the repository root directory (`./jwt-glance-0.1.0.vsix`).

2. **Install it into VS Code or Cursor:**
   - **Via Terminal:**
     ```sh
     # In VS Code
     code --install-extension jwt-glance-0.1.0.vsix

     # In Cursor
     cursor --install-extension jwt-glance-0.1.0.vsix
     ```
   - **Via GUI:**
     1. Open VS Code or Cursor.
     2. Press `Cmd+Shift+X` (macOS) or `Ctrl+Shift+X` (Windows/Linux) to open the **Extensions** panel.
     3. Click the `...` menu (Views and More Actions) in the top-right corner of the Extensions sidebar.
     4. Select **Install from VSIX...**.
     5. Choose `jwt-glance-0.1.0.vsix`.

3. **Reload VS Code** if prompted.

---

### Method 2: Direct Symlink (Fastest for Local Development)

You can link this folder directly into your VS Code extensions folder so any future `npm run build` is immediately active without repackaging:

```bash
# For standard VS Code:
ln -s "$(pwd)" ~/.vscode/extensions/jwt-glance

# For Cursor:
ln -s "$(pwd)" ~/.cursor/extensions/jwt-glance

# For VS Code Insiders:
ln -s "$(pwd)" ~/.vscode-insiders/extensions/jwt-glance
```

After creating the link:
1. Run `npm run build` (or `npm run build:prod`).
2. In VS Code, press `Cmd+Shift+P` and select **`Developer: Reload Window`**.
3. JWT Glance is now active!

---

### Method 3: Extension Development Host (`F5` Debugging)

To test changes in a clean, isolated development window without installing anything:

1. Open this repository root folder in VS Code:
   ```bash
   code .
   ```
2. Press **`F5`** (or go to **Run and Debug** `Cmd+Shift+D` and click the green play button).
3. A separate **[Extension Development Host]** window will open with JWT Glance running live.
4. Press `Cmd+R` inside the guest window anytime you rebuild to reload changes.

---

### ✅ Verifying It Works in VS Code

1. **Verify Ambient Badges:** Open [`sample.env`](https://github.com/kcodek/jwt-glance/blob/main/test/fixtures/sample.env) or [`sample.http`](https://github.com/kcodek/jwt-glance/blob/main/test/fixtures/sample.http). You will see the live badges above or before the tokens (e.g. `[JWT · user-42 · Active 42m]`).
2. **Verify Hover:** Hover your mouse over any token to see the decoded claims table, signature presence status, and payload.
3. **Verify Action Palette:** Click any badge to open the quick copy, copy sanitized token, and tab preview menu.
4. **Verify Command Palette:** Press `Cmd+Shift+P`, type `JWT Glance`, and run `JWT Glance: Inspect Token at Cursor`, `JWT Glance: Inspect Token from Clipboard`, or `JWT Glance: Copy Sanitized Token`.

---

## ⌨️ Command Palette Actions (`Cmd+Shift+P` / `Ctrl+Shift+P`)

Access quick commands anytime without needing to click with the mouse:

| Command | Description |
| :--- | :--- |
| **`JWT Glance: Inspect Token at Cursor`** | Evaluates token under the cursor or active text selection and opens the Action Palette. If no token is at cursor, prompts to inspect clipboard. |
| **`JWT Glance: Inspect Token from Clipboard`** | **Zero-leak mode:** Reads and decodes a JWT straight from the system clipboard into memory, opening claims and decoded JSON without pasting secrets into project files. |
| **`JWT Glance: Copy Sanitized Token`** | Creates a structurally valid copy of the token at cursor or in clipboard with sensitive claims redacted, safe for bug tickets and logs. |
| **`JWT Glance: Toggle Ambient Lens`** | Instantly toggles ambient CodeLens and inline badges on or off. |

---

## 🛠️ How to Test WITHOUT Installing as an Extension

You don't need to install the `.vsix` to test or develop JWT Glance. Three zero-install testing workflows are available:

### Approach 1: Extension Development Host (F5 Debugging)
Run the extension in a temporary, isolated VS Code window directly from source code:

1. Open this repository in VS Code:
   ```bash
   code .
   ```
2. Press **`F5`** (or open the **Run & Debug** tab `Cmd+Shift+D` and click **"Run Extension (Development Host)"**).
3. An **[Extension Development Host]** VS Code window will launch with JWT Glance active.
4. In that development window, open [`sample.env`](https://github.com/kcodek/jwt-glance/blob/main/test/fixtures/sample.env) to see live badges and hover cards.
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

### Approach 3: Automated Test Suite (94 Tests)
Run the full test suite via Node's native test runner (`node:test`):

```bash
# Run all tests (unit, syntax scanner, security vectors, performance, and corpus)
npm test
```

**Run targeted test suites:**
```bash
# Compile tests
npm run test:compile

# Test badge formatting
node --test out/test/unit/badgeFormatter.test.js

# Test token detection across .env, .http, JSON, SQL, bash
node --test out/test/unit/lineScanner.test.js

# Test security attack vectors (alg confusion, malformed payloads)
node --test out/test/unit/attackVectors.test.js

# Test performance (10,000 lines scanned in under 50ms)
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
| `jwtGlance.position` | `'top' \| 'left'` | `'top'` | Badge position: `'top'` renders above the line (CodeLens), `'left'` renders inline decoration before the token. |
| `jwtGlance.maxLineLength` | `number` | `10000` | Maximum character length of a line to scan (prevents lag on minified files). |
| `jwtGlance.maxDocumentBytes` | `number` | `524288` | Maximum document size in bytes to scan (default 512KB). Files exceeding this are skipped for performance. |
| `jwtGlance.exclude` | `string[]` | `["**/package-lock.json", ...]` | Glob patterns of files to exclude from ambient scanning. |
| `jwtGlance.languages` | `string[]` | `["*"]` | Language identifiers to scan (default `["*"]` for all languages). |

---

## 🚢 Best Practices: How to Publish & Ship to VS Code Extensions

Follow this production checklist to publish **JWT Glance** to both the **Visual Studio Marketplace** (for official VS Code) and the **Open VSX Registry** (for Cursor, VSCodium, Gitpod, and Eclipse Theia).

### 1. Prerequisites: Publisher Accounts & Tokens

#### A. Visual Studio Marketplace (Microsoft)
1. Navigate to the [Visual Studio Marketplace Management Portal](https://marketplace.visualstudio.com/manage).
2. Sign in with your Microsoft account and create a unique **Publisher ID** (e.g. `your-name` or `your-org`).
3. Generate a **Personal Access Token (PAT)** in [Azure DevOps](https://dev.azure.com):
   - Set Organization to `All accessible organizations`.
   - Set Scopes to `Marketplace > Manage`.
   - Copy and securely store the token.

#### B. Open VSX Registry (Eclipse Foundation / Cursor)
1. Sign up on [Open-VSX.org](https://open-vsx.org) using GitHub.
2. Create a namespace matching your publisher ID.
3. Generate an Access Token in your Open VSX account settings.

---

### 2. Manifest Preparation (`package.json`)

Ensure your `package.json` contains valid publisher and discovery metadata:

- **`publisher`**: Set to your registered Publisher ID.
- **`icon`**: Add a 128×128 square PNG (e.g., `"icon": "images/icon.png"`).
- **`repository`**: Verify the repository URL is accessible.
- **`keywords`**: Add high-intent search tags (e.g., `["jwt", "token", "auth", "decoder", "security", "ambient"]`).

---

### 3. Pre-Flight Verification Gate

Always execute this verification pipeline before releasing:

```bash
# 1. Run full test suite & adversarial corpus
npm test

# 2. Compile minified production bundle
npm run build:prod

# 3. Audit files included in package (ensures no tests or secrets leak)
npx @vscode/vsce ls

# 4. Generate the .vsix package
npm run package
```

> [!TIP]
> Run `npx @vscode/vsce ls` to audit the manifest. Thanks to [`.vscodeignore`](https://github.com/kcodek/jwt-glance/blob/main/.vscodeignore), only `dist/extension.js`, `images/icon.png`, `package.json`, and `README.md` are packaged—keeping the extension payload ultra-compact.

---

### 4. Manual Publishing via CLI

```bash
# Log in once with your Azure DevOps PAT:
npx @vscode/vsce login <your-publisher-id>

# Publish to Visual Studio Marketplace (with semantic version bump):
npx @vscode/vsce publish patch  # bumps 0.1.0 -> 0.1.1 and publishes immediately

# Dual-publish to Open VSX (for Cursor & VSCodium users):
npx ovsx publish jwt-glance-0.1.1.vsix -p <YOUR_OPEN_VSX_TOKEN>
```

---

### 5. Automated CI/CD Shipping with GitHub Actions (Recommended)

Automate release verification and dual-registry publishing whenever a version tag is pushed by adding `.github/workflows/publish.yml`:

```yaml
name: Publish Extension

on:
  push:
    tags:
      - 'v*'

jobs:
  publish:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: 'npm'

      - run: npm ci
      - run: npm test
      - run: npm run build:prod

      - name: Publish to VS Code Marketplace
        run: npx @vscode/vsce publish --pat ${{ secrets.VSCE_PAT }}

      - name: Publish to Open VSX
        run: npx ovsx publish -p ${{ secrets.OVSX_PAT }}
```

**Secrets to configure in your GitHub repository:**
- `VSCE_PAT`: Your Azure DevOps Marketplace Personal Access Token.
- `OVSX_PAT`: Your Open VSX Access Token.

---

## 🏗️ Architecture Invariants

- **Hexagonal Separation:** Pure TypeScript evaluation logic in `src/core/` contains **zero** dependencies and **zero** imports from `vscode` or Node filesystem modules.
- **Strict Trust Semantics:** Unverified tokens are labeled `Signature: Not performed` to prevent false senses of cryptographic security.
- **High-Signal Ambient Badges:** Inlay badges prioritize credential identity (`sub`) and temporal freshness (`Active` / `Expired`), keeping full claim payloads safely tucked into the hover card and interactive action palette.

---

## 📄 License

MIT © 2026 JWT Glance Contributors
