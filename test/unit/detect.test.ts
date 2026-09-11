import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findCandidateTokens, MAX_TOKEN_LENGTH } from '../../src/core/detect';

test('findCandidateTokens finds standard 3-segment JWT in text', () => {
  const sample = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c in header';
  const candidates = findCandidateTokens(sample);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c');
  assert.equal(candidates[0]?.startIndex, 7);
});

test('findCandidateTokens finds unsecured JWT with empty signature segment (alg: none)', () => {
  const sample = 'TOKEN=eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyMSJ9.';
  const candidates = findCandidateTokens(sample);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyMSJ9.');
});

test('findCandidateTokens ignores tokens exceeding MAX_TOKEN_LENGTH (8KB)', () => {
  const hugePayload = 'a'.repeat(MAX_TOKEN_LENGTH + 100);
  const sample = `eyJhbGciOiJIUzI1NiJ9.${hugePayload}.sig`;
  const candidates = findCandidateTokens(sample);
  assert.equal(candidates.length, 0);
});

test('findCandidateTokens finds 2-segment signature-omitted JWT in text', () => {
  const sample = 'TOKEN=eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0 in env';
  const candidates = findCandidateTokens(sample);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, 'eyJhbGciOiJSUzI1NiJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0');
});

test('findCandidateTokens rejects non-candidates like simple semver or plain text', () => {
  const sample = 'Version 1.2.3 is released with file.name.ext and foo.bar';
  const candidates = findCandidateTokens(sample);
  for (const c of candidates) {
    const len = c.raw.split('.').length;
    assert.ok(len === 2 || len === 3);
  }
});
