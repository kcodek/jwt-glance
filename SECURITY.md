# Security Policy

## Reporting Security Issues

If you discover a potential security vulnerability in JWT Glance, please do **not** open a public issue. Instead, report it via GitHub Private Vulnerability Reporting or contact the maintainer directly at [security@kcodek.dev](mailto:security@kcodek.dev).

## Privacy & Network Boundaries

JWT Glance is strictly an **offline, local developer tool**:

- **Zero Network Requests**: The extension makes no outbound HTTP/HTTPS requests, does not fetch JWKS keys, and does not talk to third-party endpoints.
- **Zero Telemetry**: No tracking, usage analytics, or error telemetry is gathered or transmitted.
- **Zero Token Persistence**: Candidate tokens are inspected strictly in memory within the local editor session and are never cached to disk or logged to output channels.

## Cryptographic Trust Notice

> **Important**: JWT Glance provides ambient structural inspection and base64url decoding. **Decoding a JWT does not prove its authenticity.**
>
> Unless cryptographically validated by your backend service with a verified public key or HMAC secret:
> - Header algorithms can be forged.
> - Claims can be spoofed.
> - An unverified token must never be trusted for authorization decisions.
