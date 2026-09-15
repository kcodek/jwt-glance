# Changelog

All notable changes to the **JWT Glance** extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-09-15

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
- **Interactive Action Palette**: QuickPick menu for one-click claim copying, zero-leak clipboard inspection, and opening decoded tokens in a JSON editor tab.
- **Automated CI/CD & Verification**: GitHub Actions workflows on Node 20.x and 22.x, tag-based release packaging, Dependabot configuration, and 107-test automated test suite.

