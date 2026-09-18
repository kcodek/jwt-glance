# Security Policy

## Reporting Security Issues

If you discover a potential security vulnerability in JWT Glance, please do **not** open a public issue. Instead, report it via GitHub Private Vulnerability Reporting or contact the maintainer directly at [security@kcodek.dev](mailto:security@kcodek.dev).

## Privacy & Local Execution Boundaries

JWT Glance is strictly an **offline, local developer tool**:

- **Zero Network Requests**: The extension makes no outbound HTTP/HTTPS requests, does not fetch JWKS keys, and does not talk to third-party endpoints.
- **Zero Telemetry**: No tracking, usage analytics, or error telemetry is gathered or transmitted.
- **Explicit User Actions & Data Exposure**:
  - **System Clipboard**: Commands like *Copy Decoded Payload*, *Copy Raw Token*, *Copy Claim*, and *Copy Redacted Token* write data directly to the operating system clipboard upon explicit user trigger.
  - **Untitled Editor Tabs**: The *Open Decoded Token in New Editor* action opens an untitled document containing formatted claim and header JSON. Untitled documents are subject to VS Code's internal backup and Hot Exit session restoration.
  - **Redacted Token Policy**: The *Copy Redacted Token* action produces a diagnostic JWT where custom claim values are replaced with `"[REDACTED]"` and signatures are replaced with `"REDACTED_SIGNATURE"`. Note that claim *names*, selected header strings (`alg`, `typ`, `cty`), and standard numeric timestamps (`exp`, `nbf`, `iat`) are retained to preserve temporal diagnostics. Redacted tokens are structurally valid base64url strings but intentionally invalid for authentication.

## Cryptographic Trust Notice

> **Important**: JWT Glance provides ambient structural inspection and base64url decoding. **Decoding a JWT does not prove its authenticity.**
>
> Unless cryptographically validated by your backend service with a verified public key or HMAC secret:
> - Header algorithms can be forged.
> - Claims can be spoofed.
> - An unverified token must never be trusted for authorization decisions.

