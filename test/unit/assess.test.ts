import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { assessToken } from '../../src/core/index';

const NOW = 1516239022; // Epoch matching standard RFC test token iat
const VALID_HS256 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const ALG_NONE = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyMSJ9.';

test('assessToken returns RecognizedToken for valid HS256', () => {
  const result = assessToken(VALID_HS256, NOW);
  assert.equal(result.recognized, true);
  if (result.recognized) {
    assert.equal(result.algorithm, 'HS256');
    assert.equal(result.isUnsecured, false);
    assert.equal(result.subject, '1234567890');
    assert.equal(result.temporalStatus, 'NO_EXPIRATION');
    assert.equal(result.verification.status, 'NOT_PERFORMED');
  }
});

test('assessToken flags alg:none as isUnsecured: true', () => {
  const result = assessToken(ALG_NONE, NOW);
  assert.equal(result.recognized, true);
  if (result.recognized) {
    assert.equal(result.algorithm, 'none');
    assert.equal(result.isUnsecured, true);
    assert.equal(result.subject, 'user1');
  }
});

test('assessToken correctly identifies roles from roles claim', () => {
  // payload: {"sub":"admin-user","roles":["admin","editor"]}
  // base64url of {"alg":"HS256"}: eyJhbGciOiJIUzI1NiJ9
  // base64url of {"sub":"admin-user","roles":["admin","editor"]}: eyJzdWIiOiJhZG1pbi11c2VyIiwicm9sZXMiOlsiYWRtaW4iLCJlZGl0b3IiXX0
  const token = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJhZG1pbi11c2VyIiwicm9sZXMiOlsiYWRtaW4iLCJlZGl0b3IiXX0.sig';
  const result = assessToken(token, NOW);
  assert.equal(result.recognized, true);
  if (result.recognized) {
    assert.deepEqual(result.roles, ['admin', 'editor']);
  }
});

test('assessToken returns RecognizedToken for valid 2-segment token', () => {
  const twoPart = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwiZXhwIjoxNTE2MjM5MDIyfQ';
  // At reference time NOW (1516239022 === exp), token is expired per RFC 7519
  const result = assessToken(twoPart, NOW);
  assert.equal(result.recognized, true);
  if (result.recognized) {
    assert.equal(result.algorithm, 'RS256');
    assert.equal(result.subject, '1234567890');
    assert.equal(result.temporalStatus, 'EXPIRED');
    assert.equal(result.segmentCount, 2);
    assert.equal(result.signature.presence, 'MISSING');
    assert.ok(result.warnings.includes('TWO_SEGMENT_INSPECTION'));
    assert.ok(result.warnings.includes('SIGNATURE_MISSING'));
  }

  // Before expiration, token is active
  const activeResult = assessToken(twoPart, NOW - 3600);
  if (activeResult.recognized) {
    assert.equal(activeResult.temporalStatus, 'ACTIVE');
  }
});

test('assessToken returns UnrecognizedToken for invalid input', () => {
  const result = assessToken('invalid.jwt', NOW);
  assert.equal(result.recognized, false);
  if (!result.recognized) {
    assert.equal(result.reason, 'MALFORMED_HEADER');
  }

  const resultSegments = assessToken('not_enough_segments', NOW);
  assert.equal(resultSegments.recognized, false);
  if (!resultSegments.recognized) {
    assert.equal(resultSegments.reason, 'INVALID_SEGMENT_COUNT');
  }
});
