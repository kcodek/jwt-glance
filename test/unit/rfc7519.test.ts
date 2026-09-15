import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseJwt, assessToken } from '../../src/core/index';

// RFC 7519 Section 3.1 Example
// Header: {"typ":"JWT","alg":"HS256"}
// Payload: {"iss":"joe","exp":1300819380,"http://example.com/is_root":true}
const RFC_7519_SAMPLE = 'eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk';

test('RFC 7519 Section 3.1 sample decodes accurately with carriage returns and line feeds in JSON', () => {
  const parsed = parseJwt(RFC_7519_SAMPLE);
  assert.equal('reason' in parsed, false);
  if (!('reason' in parsed)) {
    assert.equal(parsed.header['typ'], 'JWT');
    assert.equal(parsed.header['alg'], 'HS256');
    assert.equal(parsed.payload['iss'], 'joe');
    assert.equal(parsed.payload['exp'], 1300819380);
    assert.equal(parsed.payload['http://example.com/is_root'], true);
  }
});

test('RFC 7519 assessment evaluates registered claims correctly', () => {
  // Epoch: 1300819000 (380 seconds before expiration)
  const assessment = assessToken(RFC_7519_SAMPLE, 1300819000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.equal(assessment.issuer, 'joe');
    assert.equal(assessment.algorithm, 'HS256');
    assert.equal(assessment.isUnsecured, false);
    assert.equal(assessment.temporalStatus, 'ACTIVE');
    assert.equal(assessment.secondsUntilExpiration, 380);
    assert.equal(assessment.expiresAtIso, '2011-03-22T18:43:00.000Z');
    assert.equal(assessment.signature.verification, 'NOT_PERFORMED');
  }

});

test('RFC 7519 handles UTF-8 multibyte characters in claims', () => {
  // Header: {"alg":"HS256"}
  // Payload: {"sub":"ユーザー123","name":"José Müller 🚀"}
  const headerB64 = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify({ sub: 'ユーザー123', name: 'José Müller 🚀' })).toString('base64url');
  const token = `${headerB64}.${payloadB64}.test-sig`;

  const parsed = parseJwt(token);
  assert.equal('reason' in parsed, false);
  if (!('reason' in parsed)) {
    assert.equal(parsed.payload['sub'], 'ユーザー123');
    assert.equal(parsed.payload['name'], 'José Müller 🚀');
  }

  const assessment = assessToken(token, 1700000000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.equal(assessment.subject, 'ユーザー123');
  }
});
