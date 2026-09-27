import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatHoverContent, getSafeCodeFence } from '../../src/vscode/hoverFormatter';
import { sanitizeCodeSpan } from '../../src/core/sanitize';
import type { RecognizedToken } from '../../src/core/types';

function createTestToken(overrides?: Partial<RecognizedToken>): RecognizedToken {
  return {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: null,
    secondsUntilExpiration: null,
    secondsUntilActivation: null,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: [],
    warnings: [],
    ...overrides
  };
}

test('formatHoverContent renders tightened Option A layout without duplicate tables or details tags', () => {
  const token = createTestToken({
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: '2026-09-10T12:00:00.000Z',
    issuer: 'https://auth.example.com',
    audience: 'api-gateway',
    subject: 'user|123',
    roles: ['admin', 'viewer']
  });

  const md = formatHoverContent(token, { sub: 'user|123', roles: ['admin', 'viewer'] });

  // No brand clutter or unsupported HTML
  assert.ok(!md.includes('### JWT Glance'));
  assert.ok(!md.includes('<details>'));
  assert.ok(!md.includes('<summary>'));
  assert.ok(!md.includes('| Claim | Value |'));

  // Tightened structure
  assert.ok(md.includes('$(pass-filled) **Active** · expires in 42m'));
  assert.ok(md.includes('**Algorithm:** `HS256` · ℹ️ **Signature:** Present, not verified'));
  assert.ok(md.includes('**Expires:** `2026-09-10T14:00:00.000Z`'));
  assert.ok(md.includes('---'));  // Section dividers
  assert.ok(md.includes('```json'));
  assert.ok(md.includes('"sub": "user|123"'));
  assert.ok(md.includes('*Local structural inspection only — signature not cryptographically verified.*'));
});

test('formatHoverContent formats NOT_YET_ACTIVE with relative activation countdown and valid from line', () => {
  const token = createTestToken({
    algorithm: 'ES256',
    temporalStatus: 'NOT_YET_ACTIVE',
    secondsUntilActivation: 600,
    notBeforeIso: '2035-01-01T00:00:00.000Z',
    subject: 'scheduled-job'
  });

  const md = formatHoverContent(token, { sub: 'scheduled-job', nbf: 2051222400 });

  assert.ok(md.includes('$(clock) **Not Yet Active** · starts in 10m'));
  assert.ok(md.includes('**Algorithm:** `ES256` · ℹ️ **Signature:** Present, not verified'));
  assert.ok(md.includes('**Valid from:** `2035-01-01T00:00:00.000Z`'));
  assert.ok(!md.includes('*(in 10m)*')); // Relative delta not repeated
  assert.ok(md.includes('"sub": "scheduled-job"'));
});

test('formatHoverContent formats EXPIRED token with relative duration', () => {
  const token = createTestToken({
    algorithm: 'RS256',
    temporalStatus: 'EXPIRED',
    expiresAtIso: '2026-09-10T10:00:00.000Z',
    secondsUntilExpiration: -300,
    subject: 'legacy-service'
  });

  const md = formatHoverContent(token, { sub: 'legacy-service' });

  assert.ok(md.includes('$(error) **Expired** · 5m ago'));
  assert.ok(!md.includes('Expired · expired')); // No redundant stutter
  assert.ok(md.includes('**Expires:** `2026-09-10T10:00:00.000Z`'));
  assert.ok(!md.includes('*(expired 5m ago)*')); // Relative delta not repeated
});

test('formatHoverContent formats NO_EXPIRATION token without duration', () => {
  const token = createTestToken({
    temporalStatus: 'NO_EXPIRATION',
    subject: 'metrics-collector'
  });

  const md = formatHoverContent(token);
  assert.ok(md.includes('$(key) **No Expiration**'));
});

test('formatHoverContent flags unsecured alg:none prominently in heading and algorithm row', () => {
  const token = createTestToken({
    algorithm: 'none',
    isUnsecured: true,
    signature: { presence: 'EMPTY', verification: 'NOT_PERFORMED' },
    warnings: ['UNSECURED_ALG_NONE']
  });

  const md = formatHoverContent(token);
  assert.ok(md.startsWith('$(shield) $(alert) **Unsecured**'));
  assert.ok(!md.includes('$(pass-filled) **Active**'));
  assert.ok(md.includes('UNSECURED'));
  assert.ok(md.includes('**Signature:** Empty'));
});

test('formatHoverContent flags missing signature and failed verification as Unsecured heading with secondary timing', () => {
  const missingSigToken = createTestToken({
    algorithm: 'RS256',
    signature: { presence: 'EMPTY', verification: 'NOT_PERFORMED' },
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    warnings: ['SIGNATURE_MISSING']
  });

  const missingSigMd = formatHoverContent(missingSigToken);
  assert.ok(missingSigMd.startsWith('$(shield) $(alert) **Unsecured** · expires in 42m'));
  assert.ok(!missingSigMd.includes('$(pass-filled) **Active**'));

  const failedVerifToken = createTestToken({
    ...missingSigToken,
    signature: { presence: 'PRESENT', verification: 'FAILED' }
  });

  const failedVerifMd = formatHoverContent(failedVerifToken);
  assert.ok(failedVerifMd.startsWith('$(shield) $(alert) **Unsecured** · expires in 42m'));
  assert.ok(!failedVerifMd.includes('$(pass-filled) **Active**'));
});

test('formatHoverContent respects custom expiringSoonThreshold option', () => {
  const token = createTestToken({
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 600 // 10 minutes
  });

  // Default threshold (1800s / 30m) -> Expiring Soon
  const defaultMd = formatHoverContent(token);
  assert.ok(defaultMd.startsWith('$(clock) **Expiring Soon** · expires in 10m'));

  // Custom tight threshold (300s / 5m) -> token with 10m is still Active
  const customMd = formatHoverContent(token, undefined, { expiringSoonThreshold: 300 });
  assert.ok(customMd.startsWith('$(pass-filled) **Active** · expires in 10m'));
});

test('formatHoverContent emits verified disclaimer footer when verification succeeds', () => {
  const token = createTestToken({
    algorithm: 'ES256',
    signature: { presence: 'PRESENT', verification: 'VERIFIED' },
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520
  });

  const md = formatHoverContent(token);
  assert.ok(md.includes('✅ **Signature:** Verified'));
  assert.ok(md.includes('*Local structural inspection — cryptographically verified.*'));
  assert.ok(!md.includes('signature not cryptographically verified'));
});

test('formatHoverContent escapes malicious markdown injection in algorithm using sanitizeCodeSpan', () => {
  const token = createTestToken({
    algorithm: 'RS256` [Click](https://evil.com) `'
  });

  const md = formatHoverContent(token);
  // Algorithm is safely enclosed within single unbroken code span with backticks stripped
  assert.ok(md.includes('**Algorithm:** `RS256 [Click](https://evil.com) ` · ℹ️ **Signature:**'));
  // No backtick precedes the injected link to prevent closing code span
  assert.ok(!md.includes('` [Click]'));

  // Test sanitizeCodeSpan directly with backticks and newlines
  assert.equal(sanitizeCodeSpan('RS256` [Click](https://evil.com) `'), 'RS256 [Click](https://evil.com) ');
  assert.equal(sanitizeCodeSpan('HS256\r\n# Injected Header'), 'HS256# Injected Header');
  assert.equal(sanitizeCodeSpan(null), '');
  assert.equal(sanitizeCodeSpan(undefined), '');
});

test('getSafeCodeFence dynamically extends backtick fences when payload contains backticks', () => {
  assert.equal(getSafeCodeFence('{"clean": true}'), '```');
  assert.equal(getSafeCodeFence('{"code": "```evil```"}'), '````');
  assert.equal(getSafeCodeFence('{"code": "````more-evil````"}'), '`````');

  const token = createTestToken();
  const md = formatHoverContent(token, { query: '```injection```' });
  assert.ok(md.includes('````json\n{\n  "query": "```injection```"\n}\n````'));
});
