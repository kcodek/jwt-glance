import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findCandidateTokens, assessToken } from '../../src/core/index';

const SAMPLE_JWT_1 = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEifQ.sig1';
const SAMPLE_JWT_2 = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTIifQ.sig2';

test('Discovers multiple tokens on a single line with accurate offsets', () => {
  const line = `OLD_TOKEN="${SAMPLE_JWT_1}" NEW_TOKEN="${SAMPLE_JWT_2}"`;
  const candidates = findCandidateTokens(line);

  assert.equal(candidates.length, 2);
  assert.equal(candidates[0]?.raw, SAMPLE_JWT_1);
  assert.equal(candidates[1]?.raw, SAMPLE_JWT_2);
  assert.equal(line.substring(candidates[0]!.startIndex, candidates[0]!.endIndex), SAMPLE_JWT_1);
  assert.equal(line.substring(candidates[1]!.startIndex, candidates[1]!.endIndex), SAMPLE_JWT_2);
});

test('Extracts JWT from .http authorization headers', () => {
  const line = `Authorization: Bearer ${SAMPLE_JWT_1}`;
  const candidates = findCandidateTokens(line);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, SAMPLE_JWT_1);
  assert.equal(candidates[0]?.startIndex, 22);
});

test('Extracts JWT from JSON string values', () => {
  const line = `{"auth": {"access_token": "${SAMPLE_JWT_1}", "expires_in": 3600}}`;
  const candidates = findCandidateTokens(line);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, SAMPLE_JWT_1);
});

test('Extracts JWT from YAML key-value pairs', () => {
  const line = `  jwt_secret_token: ${SAMPLE_JWT_1} # production secret`;
  const candidates = findCandidateTokens(line);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, SAMPLE_JWT_1);
});

test('Extracts JWT from URL query parameters and filters out domain candidates', () => {
  const line = `https://auth.example.com/oauth/callback?code=xyz&id_token=${SAMPLE_JWT_1}&session_state=abc`;
  const candidates = findCandidateTokens(line);
  
  // Non-JWT domain names (e.g. auth.example.com) fail Stage 2 assessment
  const recognized = candidates
    .map((c) => ({ candidate: c, assessment: assessToken(c.raw, 1700000000) }))
    .filter((item) => item.assessment.recognized);

  assert.equal(recognized.length, 1);
  assert.equal(recognized[0]?.candidate.raw, SAMPLE_JWT_1);
});

test('Extracts JWT from SQL INSERT statements', () => {
  const line = `INSERT INTO auth_cache (user_id, token, updated_at) VALUES ('usr_99', '${SAMPLE_JWT_1}', NOW());`;
  const candidates = findCandidateTokens(line);
  assert.equal(candidates.length, 1);
  assert.equal(candidates[0]?.raw, SAMPLE_JWT_1);
});

test('Extracts and assesses valid tokens embedded in bash commands filtering out URLs', () => {
  const line = `curl -X POST https://api.corp.net/v1/resource -H "Authorization: Bearer ${SAMPLE_JWT_1}" -d '{"ok":true}'`;
  const candidates = findCandidateTokens(line);
  
  const recognized = candidates
    .map((c) => ({ candidate: c, assessment: assessToken(c.raw, 1700000000) }))
    .filter((item) => item.assessment.recognized);

  assert.equal(recognized.length, 1);
  assert.equal(recognized[0]?.assessment.recognized, true);
  if (recognized[0]?.assessment.recognized) {
    assert.equal(recognized[0].assessment.subject, 'user-1');
  }
});
