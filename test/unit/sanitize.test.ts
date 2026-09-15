import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { sanitizeMarkdown, createSanitizedJwt } from '../../src/core/sanitize';
import { parseJwt } from '../../src/core/parse';

test('sanitizeMarkdown escapes markdown formatting characters', () => {
  const untrusted = 'admin | *bold* _italic_ `code` [link](http://evil.com) <script>';
  const sanitized = sanitizeMarkdown(untrusted);
  assert.ok(!sanitized.includes('*bold*'));
  assert.ok(!sanitized.includes('`code`'));
  assert.ok(!sanitized.includes('[link]'));
  assert.ok(!sanitized.includes('<script>'));
  assert.ok(sanitized.includes('\\|'));
});

test('sanitizeMarkdown handles non-string values safely', () => {
  assert.equal(sanitizeMarkdown(123 as unknown as string), '123');
  assert.equal(sanitizeMarkdown(null as unknown as string), '');
  assert.equal(sanitizeMarkdown(undefined as unknown as string), '');
});

test('createRedactedJwt strictly redacts custom claims and headers while preserving safe registered claims', () => {
  const token = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCIsImtpZCI6InNlY3JldC1rZXktNDIifQ.eyJzdWIiOiJ1c2VyLTEyMyIsImVtcGxveWVlSWQiOjQ5OTk5LCJpc0FkbWluIjp0cnVlLCJlbWFpbCI6ImpvaG5AZG9lLmNvbSIsInJvbGVzIjpbInN1cGVyYWRtaW4iXSwidGVuYW50Ijp7ImlkIjoxfSwiZXhwIjoxOTAwMDAwMDAwLCJpYXQiOjE4MDAwMDAwMDB9.dGVzdHNpZw';
  const result = createSanitizedJwt(token);

  assert.equal(result.success, true);
  if (result.success) {
    assert.notEqual(result.token, token);
    const parsed = parseJwt(result.token);
    assert.equal('reason' in parsed, false);
    if (!('reason' in parsed)) {
      // Allowed header claims
      assert.equal(parsed.header['alg'], 'HS256');
      assert.equal(parsed.header['typ'], 'JWT');
      // Custom header claims redacted
      assert.equal(parsed.header['kid'], '[REDACTED]');

      // Safe payload claims preserved
      assert.equal(parsed.payload['exp'], 1900000000);
      assert.equal(parsed.payload['iat'], 1800000000);

      // All custom payload claims redacted regardless of type (string, number, boolean, array, object)
      assert.equal(parsed.payload['sub'], '[REDACTED]');
      assert.equal(parsed.payload['employeeId'], '[REDACTED]');
      assert.equal(parsed.payload['isAdmin'], '[REDACTED]');
      assert.equal(parsed.payload['email'], '[REDACTED]');
      assert.equal(parsed.payload['roles'], '[REDACTED]');
      assert.equal(parsed.payload['tenant'], '[REDACTED]');

      // Visible synthetic signature
      assert.equal(parsed.signature, 'REDACTED_SIGNATURE');
      assert.ok(parsed.hasSignature);
    }
  }
});

test('createRedactedJwt preserves 2-segment tokens without adding synthetic signature', () => {
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJleHAiOjE5MDAwMDAwMDB9';
  const result = createSanitizedJwt(token);
  assert.equal(result.success, true);
  if (result.success) {
    const parts = result.token.split('.');
    assert.equal(parts.length, 2);
  }
});

test('createRedactedJwt redacts malformed non-numeric temporal claims and non-string header claims', () => {
  // Header with string alg, but non-string typ & cty; Payload with string/object exp & iat containing sensitive data
  const rawHeader = Buffer.from(JSON.stringify({ alg: 'HS256', typ: { secret: 'header-leak' }, cty: 12345, kid: 'secret-kid' })).toString('base64url');
  const rawPayload = Buffer.from(JSON.stringify({
    exp: 'customer-account-12345',
    iat: { internalId: 'secret-key-material' },
    nbf: [1, 2, 3],
    sub: 'sensitive-user'
  })).toString('base64url');
  const adversarialToken = `${rawHeader}.${rawPayload}.invalidsig`;

  const result = createSanitizedJwt(adversarialToken);
  assert.equal(result.success, true);
  if (result.success) {
    assert.ok(!result.token.includes('customer-account-12345'));
    assert.ok(!result.token.includes('secret-key-material'));
    assert.ok(!result.token.includes('header-leak'));
    assert.ok(!result.token.includes('secret-kid'));

    const parsed = parseJwt(result.token);
    assert.equal('reason' in parsed, false);
    if (!('reason' in parsed)) {
      assert.equal(parsed.header['alg'], 'HS256');
      assert.equal(parsed.header['typ'], '[REDACTED]');
      assert.equal(parsed.header['cty'], '[REDACTED]');
      assert.equal(parsed.header['kid'], '[REDACTED]');
      assert.equal(parsed.payload['exp'], '[REDACTED]');
      assert.equal(parsed.payload['iat'], '[REDACTED]');
      assert.equal(parsed.payload['nbf'], '[REDACTED]');
      assert.equal(parsed.payload['sub'], '[REDACTED]');
    }
  }
});

test('createRedactedJwt returns failure result for unrecognized tokens and never raw input', () => {
  const invalidToken = 'not.a.valid.jwt.token.string';
  const result = createSanitizedJwt(invalidToken);
  assert.equal(result.success, false);
  if (!result.success) {
    assert.ok(result.reason);
  }
});

