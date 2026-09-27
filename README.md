# JWT Glance

> **Zero-click ambient JWT inspection lens for VS Code.**
> *Compatible with VS Code-based editors through VSIX installation.*

![JWT Glance Ambient Lens Preview](./images/OpenDecodedToken.gif)

JWT Glance automatically surfaces JWT expiration countdowns, algorithm details, and decoded claim cards directly within your editor—eliminating the insecure reflex of pasting sensitive credentials into third-party web decoders (`jwt.io`) and preventing cryptic `401 Unauthorized` test failures caused by stale fixtures.

---

## ✨ Features

- ⚡ **Zero-Click Ambient Badges & CodeLens:** Badges appear immediately above the line (`position: top`), inline before detected tokens (`position: left`), or both (`position: both`) in `.env`, `.http`, `.rest`, `.json`, `.yml`, and source files (e.g. `[JWT · user-42 · Active 42m]`, `[JWT · RS256 NO SIG ⚠️ · service · Active 2h]`, or `[JWT · UNSECURED alg:none · local-dev-user · Active 42m]`).
- 🧩 **Standard 3-Segment & Two-Segment Inspection:** Accurately inspects standard signed 3-segment tokens (`header.payload.signature`), flags missing signatures on signed algorithms, and supports two-segment JWT inspection (`header.payload`) commonly found in `.env` drafts and mocks.
- 🎯 **Interactive Action Palette:** Click any CodeLens badge (or run `Cmd+Shift+P` → *Inspect Token at Cursor*) to open a quick action menu:
  - **Open Decoded Token in New Editor:** Opens a dedicated, formatted JSON editor tab with syntax highlighting, searchability, and folding.
  - **Copy Redacted Token:** Exports a diagnostic token with custom claim values and signatures redacted for bug reports and tickets.
  - **Copy Decoded Payload (JSON):** Copy formatted payload claims JSON directly to clipboard.
  - **Single-Click Claim Copying:** Copy individual claims directly (`Subject`, `Roles`, `Issuer`, `Audience`, `Expiration`, `Key ID`) to clipboard with confirmation.
- ⌨️ **Command Palette & Clipboard Inspection (`Cmd+Shift+P`):** Inspect tokens at cursor, copy redacted tokens, decode tokens straight from the clipboard in memory, or toggle ambient badges with one keystroke.
- 🔍 **Rich Hover Card:** Hover over any token to inspect semantic health status, signature and algorithm state, exact ISO lifecycle timestamps, and formatted payload JSON.
- 🎨 **Multi-Tier Semantic Health Badges:** Distinct Codicons and theme-aware colors for `ACTIVE` (emerald), `EXPIRING_SOON` (warm amber), `EXPIRED` (ruby), `UNSECURED` (alert), `NO_EXPIRATION` (cyan), and `INDETERMINATE` (neutral question).
- 📜 **Scrollbar Overview Ruler:** Viewport-aware scrollbar indicators that update while navigating.
- 👻 **Dead Credential Text Dimming:** Expired tokens are automatically dimmed to 55% opacity so stale credentials visually recede while remaining fully interactive.
- ⏱️ **60-Second Live Timer:** Relative expiration countdowns (`Active 42m` → `Active 41m`) refresh automatically without requiring file edits or typing.
- 🪶 **Zero Runtime Dependencies:** Strictly `"dependencies": {}`. Pure deterministic TypeScript core with fast startup.

---

## 🔒 Security, Privacy & Safe Redaction

![Safe Redacted Token Copy Demo](./images/RedactedCopy.gif)

- **100% Offline & Private:** JWT Glance runs completely inside your local editor. It makes zero outbound network requests, collects zero telemetry/analytics, and never logs credentials.
- **Decoding ≠ Verification:** Ambient decoding surfaces structural claims for developer convenience. **Decoding a JWT does not prove cryptographic authenticity.** Signatures must always be verified by your backend service against verified public keys or HMAC secrets.
- **System Clipboard & Tab Interactions:**
  - Copy actions (*Copy Decoded Payload*, *Copy Claim*, *Copy Redacted Token*) write directly to the OS system clipboard upon explicit user selection.
  - Opening decoded tokens in a new editor tab creates an untitled JSON document, which VS Code may include in its local workspace backup and Hot Exit session restore.
- **Redaction Policy:** The *Copy Redacted Token* command produces a diagnostic token that preserves standard header metadata (`alg`, `typ`, `cty`) and numeric timestamps (`exp`, `nbf`, `iat`), while replacing all custom claims with `"[REDACTED]"` and signatures with `"REDACTED_SIGNATURE"`. The resulting token is structurally valid base64url JSON but intentionally invalid for authentication.

---

## 🚀 Quickstart & Usage

1. **Install JWT Glance** from the VS Code Marketplace or from a packaged `.vsix`.
2. Open any file containing JWTs (e.g. `.env`, `.http`, `.json`, `.yml`, `.ts`, `.py`).
3. **Ambient Badges:** Badges appear above (`position: top`), inline before (`position: left`), or both (`position: both`) for each recognized token showing subject and relative expiration status.
4. **Hover Cards:** Hover your mouse over any token to view semantic status, signature state, lifecycle timestamps, and formatted payload JSON.
5. **Action Palette:** Click on any CodeLens badge (or run `Cmd+Shift+P` → *Inspect Token at Cursor*) to copy claims, copy redacted diagnostic tokens, or open formatted JSON in a new tab.

---

## ⌨️ Command Palette Actions (`Cmd+Shift+P` / `Ctrl+Shift+P`)

![Command Palette Inspection Workflow](./images/CmdShiftP.gif)

| Command | Description |
| :--- | :--- |
| **`JWT Glance: Inspect Token at Cursor`** | Evaluates token under cursor or active text selection and opens the Action Palette. |
| **`JWT Glance: Inspect Token from Clipboard`** | Reads and decodes a JWT straight from clipboard into memory without writing tokens to disk. |
| **`JWT Glance: Copy Redacted Token`** | Copies a diagnostic copy of the token at cursor/clipboard with custom claims and signature redacted. |
| **`JWT Glance: Toggle Ambient Lens`** | Instantly toggles ambient CodeLens and inline badges on or off. |

---

## ⚙️ Configuration Settings

Customize JWT Glance behavior in your VS Code `settings.json`:

| Setting | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `jwtGlance.enabled` | `boolean` | `true` | Enable or disable ambient glance badges and hover cards. |
| `jwtGlance.position` | `'top' \| 'left' \| 'both'` | `'top'` | Badge rendering position: `'top'` (CodeLens above line), `'left'` (inline badge before token), or `'both'`. |
| `jwtGlance.overviewRuler` | `boolean` | `true` | Display color-coded health indicators for JWT tokens in the editor scrollbar overview ruler. |
| `jwtGlance.dimExpiredTokens` | `boolean` | `true` | Subtly dim expired JWT credentials (55% opacity) to visually distinguish active vs dead credentials. |
| `jwtGlance.expiringSoonThreshold` | `number` | `1800` | Threshold in seconds (default 30m) under which an active token displays an amber "Expiring Soon" warning. |
| `jwtGlance.maxLineLength` | `number` | `10000` | Maximum character length of a line to scan (prevents lag on minified files). |
| `jwtGlance.maxDocumentCharacters` | `number` | `524288` | Maximum document character count to scan (~512 KB). Documents exceeding this are skipped to protect editor responsiveness. |
| `jwtGlance.exclude` | `string[]` | `["**/package-lock.json", ...]` | Glob patterns of files to exclude from ambient scanning. |
| `jwtGlance.languages` | `string[]` | `["*"]` | Language identifiers to scan (default `["*"]` for all languages). |

> **Setting scope:** VS Code workspace settings in `.vscode/settings.json` override profile and user settings. If `jwtGlance.position` does not change as expected, check the workspace settings for an existing value. Position changes take effect immediately in open editors.

---

## 🤝 Contributing & Development

For development setup, local debugging (`F5`), test suites, and release packaging instructions, see [CONTRIBUTING.md](CONTRIBUTING.md).

For security policies and vulnerability reporting, see [SECURITY.md](SECURITY.md).

---

## 📄 License

MIT © 2026 kcodek