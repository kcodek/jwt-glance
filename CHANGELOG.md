# Changelog

All notable changes to the **JWT Glance** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-15

### Added
- **Ambient JWT Lens**: Instant, zero-click expiration countdown and subject glance rendered above (`position: top`) or inline (`position: left`).
- **Rich Hover Inspection**: Formatted Markdown card detailing algorithm, temporal lifecycle, and collapsible decoded claims.
- **Explicit Signature Presence Semantics**:
  - Distinguishes standard 3-segment JWTs from non-standard 2-segment JWT-like inputs.
  - Flags missing signatures on signed algorithms with prominent `NO SIG ⚠️` badges.
  - Warns on unexpected signatures when `alg: none`.
  - Truthful local inspection semantics with explicit "Verification not performed" notice.
- **Copy Sanitized Token (`jwtGlance.copySanitizedToken`)**: Exports structurally valid tokens with sensitive claim payloads replaced with redacted placeholders for safe bug reports.
- **Performance & Scale Limits**:
  - `jwtGlance.maxDocumentBytes` (default: 512KB) skips large generated/minified files.
  - `jwtGlance.exclude` customizable glob pattern exclusions.
  - Viewport-restricted scanning for inline decoration mode.
  - Cancellation token support for long line scans.
- **RFC 7519 Boundary Compliance**: Strict expiration handling at `now === exp` (`EXPIRED`).
- **Interactive Action Palette**: QuickPick menu for one-click claim copying and opening decoded tokens in a JSON editor tab.
