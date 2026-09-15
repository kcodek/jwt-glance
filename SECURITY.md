# Security Policy

## Reporting Security Issues

If you discover a potential security vulnerability in JWT Glance, please do **not** open a public issue. Instead, report it via GitHub Private Vulnerability Reporting or contact the maintainer directly at [security@kcodek.dev](mailto:security@kcodek.dev).

## Privacy & Network Boundaries

JWT Glance is strictly an **offline, local developer tool**:

- **Zero Network Requests**: The extension makes no outbound HTTP/HTTPS requests, does not fetch JWKS keys, and does not talk to third-party endpoints.
- **Zero Telemetry**: No tracking, usage analytics, or error telemetry is gathered or transmitted.
- **Zero Token Persistence**: JWT Glance does not intentionally write raw tokens to files, logs, extension storage or output channels. Content opened in an untitled editor is subject to VS Code’s backup and Hot Exit behavior.


## Cryptographic Trust Notice

> **Important**: JWT Glance provides ambient structural inspection and base64url decoding. **Decoding a JWT does not prove its authenticity.**
>
> Unless cryptographically validated by your backend service with a verified public key or HMAC secret:
> - Header algorithms can be forged.
> - Claims can be spoofed.
> - An unverified token must never be trusted for authorization decisions.
