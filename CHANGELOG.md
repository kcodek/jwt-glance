# Changelog

All notable changes to the **JWT Glance** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-10-19

### Changed
- **Default Badge Position & Clean Inline Typography**:
  - Out-of-the-box badge position defaults to `"top"` (native VS Code CodeLens above the line) for a calm, non-intrusive editing experience.
  - Redesigned inline badge decorations (`position: left` or `both`) to render as clean, theme-matched colored text, completely removing background pill boxes, borders, and brackets.
- **Unified Settings Object (`"jwtGlance"`)**:
  - Consolidated all configuration settings under a single root `"jwtGlance": { ... }` object in `settings.json`.
  - Full backwards compatibility retained for legacy flat configuration keys (`"jwtGlance.<property>"`).

### Added
- **Document Token Index (`src/vscode/tokenIndex.ts`)**:
  - Implemented version-aware caching index for candidate JWT positions and ranges.
  - Eliminates redundant line-by-line regex scanning across CodeLens, decorations, and 60-second timer loops.
  - Zero-rescan invalidation: 60-second expiry timer recalculates relative countdowns directly from indexed tokens in < 1ms without touching document text.
  - Preserves viewport-only scanning when full-document overview rulers are not enabled, eliminating full-file reads on large files with `position: left`.
  - Document close listener evicts cache entries to prevent memory leaks.
- **Full-Document Overview Ruler with Configurable Cap**:
  - Scrollbar overview markers now reflect JWTs across the full document instead of only the active viewport.
  - Added `jwtGlance.maxOverviewRulerTokens` (default: 50, minimum: 0) setting to prevent decoration thrashing on massive mock fixtures, where `0` provides an explicit path to disable scrollbar markers without restricting candidate scanning.
- **Footer Status Bar Toggle Icon**:
  - Added dedicated status bar item in the editor footer displaying active vs paused ambient inspection state.
  - Allows 1-click toggling of ambient inspection without opening the Command Palette.
  - Configurable via `jwtGlance.showStatusBarItem` (default: `true`).
- **Customizable Glance Claim Priority & Visibility (`jwtGlance.glanceClaims`, `jwtGlance.maxGlanceClaims`)**:
  - Added `jwtGlance.glanceClaims` (default: `["roles", "name", "email", "sub"]`) to specify candidate claim keys in priority order.
  - Added `jwtGlance.maxGlanceClaims` (default: `3`, range: `1`–`10`) governing how many matching claims appear simultaneously. Setting `maxGlanceClaims: 1` enables strict single-claim mode.
  - Retaining `sub` at the end of `glanceClaims` establishes it as the natural fallback when earlier claims are absent; removing `sub` suppresses subject display entirely.
  - Added interactive QuickPick claim priority manager and *JWT Glance: Choose Claim for Badge Display* (`jwtGlance.chooseGlanceClaim`) command to reorder claims, add detected claims with 1 click, or input custom dot paths (e.g. `user.email`).
  - Supports nested claim paths with string length capping to keep editor badges compact.
- **Side-by-Side Decoded Token Inspection**:
  - The *Open Decoded JSON (Split View)* action opens the formatted JSON document beside the active editor (`ViewColumn.Beside`), allowing instant side-by-side comparison with `.env` or `.http` files without losing active cursor context.
- **Copy as `Authorization: Bearer <token>` Header**:
  - Added `jwtGlance.copyBearerToken` command and integrated action in the QuickPick palette to immediately copy formatted Bearer headers to the clipboard.
  - Updated documentation detailing clipboard exposure for unredacted token copy actions.
- **Opt-In Workspace JWT Conformance Policies**:
  - Added pure policy evaluation engine (`src/core/policy.ts`) supporting issuer, audience, algorithm allowlist, required claims, max token age, and expiration requirements.
  - Strictly opt-in via `jwtGlance.policies` (disabled by default with zero unsolicited linter noise).
  - Default policy normalization: omitted `files` automatically defaults to `["**/*.http", "**/.env*"]` and omitted `requireExpiration` defaults to `true`.
  - Custom claim validation: `requiredClaims` validates both standard registered claims and arbitrary application claims (such as `tenant_id` or `org_id`).
  - Max-age hardening: `maximumTokenAgeSeconds` requires an `iat` claim and flags future issuance exceeding 60-second clock skew tolerance.
  - Markdown hover sanitization: policy diagnostic messages in hover cards strip line breaks and escape Markdown syntax to prevent untrusted claim text from spoofing headings, links, or bullet lists.
  - Integrated with native VS Code Problems panel (`jwtGlance` diagnostic collection) and hover card alerts.
  - Per-document update debounce: isolated 150ms debounce timers per document URI prevent simultaneous or workspace-wide edits from dropping diagnostics.
- **Structured GitHub Issue Forms**:
  - Added dedicated bug report and feature request templates with explicit token redaction notices.

### Performance
- Cached re-evaluation for 1,000 tokens finishes in ~0.5ms (< 5ms budget).
- 10,000-line candidate scanning with 100 tokens finishes in ~4ms (< 30ms budget).
- Near-limit 512 KB (~520,000 characters) document candidate scanning finishes in ~15ms (< 30ms budget).

## [1.1.0] - 2026-09-26

### Added
- **Multi-Tier Semantic Visual Health Badges**:
  - 6-tier classification (`ACTIVE`, `EXPIRING_SOON`, `EXPIRED`, `UNSECURED`, `NO_EXPIRATION`, `INDETERMINATE`) with Codicons (`$(pass-filled)`, `$(clock)`, `$(error)`, `$(shield) $(alert)`, `$(key)`).
  - Theme-aware inline text decorations styled using VS Code design tokens (when 'left' or 'both' position is selected).
  - Configurable expiration threshold via `jwtGlance.expiringSoonThreshold` (default: 1800s / 30m).
- **Dead Credential Text Dimming (`jwtGlance.dimExpiredTokens`)**:
  - Automatically dims expired JWTs to 55% opacity in the editor, making dead credentials visually recede while preserving full interactivity.
- **Scrollbar Overview Ruler Indicators (`jwtGlance.overviewRuler`)**:
  - Viewport-aware scrollbar overview ruler indicators that update while navigating to highlight active, warning, and expired tokens.
- **Simultaneous Badge Rendering (`jwtGlance.position: "both"`)**:
  - Supports rendering CodeLens badges above lines and inline badges before tokens simultaneously.
- **Multi-Dimensional Token Assessment Model**:
  - Architectural model separating orthogonal dimensions: `recognition`, `signature`, `temporal`, `policy`, `claims`, and `warnings`.
  - Truthful glance formatting: standard unverified tokens omit the algorithm in the ambient badge to keep the glance calm, reserve algorithm display for missing signature alerts (`RS256 NO SIG ⚠️`) or explicit unchecked status requests, and never display verification checkmarks (`RS256 ✓`) without explicit cryptographic validation.
- **Streamlined Action Palette**:
  - Non-destructive "Open Decoded Token in New Editor" prioritized as primary default action.
  - Dedicated quick-copy claim buttons (`sub`, `roles`, `iss`, `aud`, `exp`, `kid`) front-and-center.
  - Cleaned up redundant copy actions and categorized diagnostic exports at the bottom.
- **Redesigned Zero-Clutter Hover Card**:
  - Semantic health tier heading derived from `getTokenSemanticTier()`, immediately flagging `UNSECURED` tokens (`$(shield) $(alert) **Unsecured**`) with secondary temporal timing.
  - Honors user-configured `jwtGlance.expiringSoonThreshold` across all hover card status indicators.
  - Dynamic verification-aware security disclaimer footer.
  - Scaled human-readable duration units supporting years (`8y`) for distant activation horizons.
  - Surfaces relative activation countdowns for `NOT_YET_ACTIVE` tokens (`starts in ...` with `Valid from: ...`).
  - Employs dynamic backtick-safe code fences preventing payload JSON from breaking Markdown fences.

### Security & Hardening
- **Semantic Health Precedence in Hover**: Forbids marking unsecured credentials (`alg:none`, missing signature, failed verification) as `Active` in hover cards, ensuring consistency with CodeLens and decoration tiers.
- **Hover Code-Span Injection Defense**: Sanitizes the algorithm code span using `sanitizeCodeSpan()` to strip raw backticks and newlines, preventing forged algorithm values from breaking out of the inline code span and injecting Markdown links.
- **VS Code API Boundary Pinned**: Pinned `@types/vscode` to `~1.85.0` to guarantee API compatibility with the manifest engine requirement (`^1.85.0`).
- **Engine Compatibility Aligned**: Restored declared Node requirement to `node: ">=18.0.0"` in `package.json` to match `esbuild` target (`node18`) and align with the embedded Node 18 runtime shipped in VS Code 1.85–1.86 host environments.

### Fixed
- **Inline Decoration Hover Theme Icons**: Enabled `supportThemeIcons: true` on inline badge hover messages, resolving an issue where Codicon syntax (`$(clock)`, `$(shield)`) rendered as raw text.
- **Clean Command Palette Registration**: Removed internal CodeLens callback command (`jwtGlance.inspectToken`) from `contributes.commands`, ensuring `Cmd+Shift+P` lists only the four user-facing inspection actions.
- **Overview Ruler Setting Respected**: Decoupled ruler markers from inline text decorations, ensuring `jwtGlance.overviewRuler: false` reliably disables scrollbar markers in all positioning modes (`top`, `left`, `both`).
- **Semantic Tier Precedence**: Fixed precedence order so expired tokens always resolve to `EXPIRED` before secondary policy checks, and policy mismatches map appropriately to `UNSECURED`.

## [1.0.0] - 2026-09-21

### Added
- **Ambient JWT Lens**: Instant, zero-click expiration countdown and subject glance rendered above (`position: top` via CodeLens) or inline (`position: left` via decoration).
- **Rich Hover Inspection**: Formatted Markdown card detailing algorithm, temporal lifecycle, truthful signature status, and collapsible decoded claims.
- **Explicit 4-State Signature Presence Semantics**:
  - Distinguishes standard 3-segment JWTs (`PRESENT`), RFC 7519 unsecured tokens with empty signature segment (`EMPTY`), missing signatures on signed algorithms (`EMPTY` / `ABSENT`), and unexpected signatures on `alg: none` (`UNEXPECTED`).
  - Flags missing signatures on signed algorithms with prominent `NO SIG ⚠️` badges.
  - Truthful local inspection semantics with explicit "Verification not performed" notice.
- **Copy Redacted Token (`jwtGlance.copyRedactedToken`)**: Exports structurally valid diagnostic tokens with unverified claims and custom headers strictly redacted (`SAFE_HEADER_CLAIMS = alg, typ, cty`; `SAFE_PAYLOAD_CLAIMS = exp, nbf, iat`) and synthetic `REDACTED_SIGNATURE` segment for safe inclusion in bug reports.
- **Performance & Scale Limits**:
  - `jwtGlance.maxDocumentCharacters` (default: 512,000 characters) skips oversized generated/minified files.
  - `jwtGlance.exclude` customizable glob pattern exclusions.
  - Viewport-restricted scanning for inline decoration mode.
  - Cancellation token support for long line scans in CodeLens.
- **RFC 7519 Boundary Compliance**: Strict expiration handling at `now === exp` (`EXPIRED`).
- **Interactive Action Palette**: QuickPick menu for one-click claim copying, zero-leak clipboard inspection, and opening decoded tokens in a permanent JSON editor tab (`preview: false`).
- **Visual Assets & Storefront**: High-framerate animated GIF demonstrations (`OpenDecodedToken.gif`, `toggleAmbientLens.gif`, `badgeDisplayConfig.gif`, `RedactedCopy.gif`) and 256x256 high-DPI icon asset.
- **Automated CI/CD & Verification**: GitHub Actions workflows on Node 20.x and 22.x, resilient release packaging, Dependabot configuration, and 109-test automated test suite.
