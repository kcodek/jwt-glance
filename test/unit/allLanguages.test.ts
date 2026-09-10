import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { findCandidateTokens, assessToken } from '../../src/core/index';

const SAMPLE_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0LXVzZXIiLCJleHAiOjE4MDAwMDAwMDB9.sig';

function verifyTokenFound(codeLine: string, languageName: string): void {
  const candidates = findCandidateTokens(codeLine);
  assert.ok(candidates.length >= 1, `Failed to find candidate in ${languageName}: ${codeLine}`);
  
  const recognized = candidates
    .map(c => ({ candidate: c, assessment: assessToken(c.raw, 1700000000) }))
    .filter(item => item.assessment.recognized);

  assert.equal(recognized.length, 1, `Expected 1 recognized JWT in ${languageName}: ${codeLine}`);
  assert.equal(recognized[0]?.candidate.raw, SAMPLE_JWT);
  assert.equal(recognized[0]?.assessment.recognized, true);
  if (recognized[0]?.assessment.recognized) {
    assert.equal(recognized[0].assessment.subject, 'test-user');
    assert.equal(recognized[0].assessment.algorithm, 'HS256');
  }
}

test('.env files: raw assignment and quoted assignment', () => {
  verifyTokenFound(`JWT_SECRET=${SAMPLE_JWT}`, '.env raw');
  verifyTokenFound(`API_KEY="${SAMPLE_JWT}"`, '.env double-quoted');
  verifyTokenFound(`export TOKEN='${SAMPLE_JWT}'`, '.env single-quoted with export');
});

test('.http and .https files: Request authorization headers', () => {
  verifyTokenFound(`Authorization: Bearer ${SAMPLE_JWT}`, '.http Bearer');
  verifyTokenFound(`X-Api-Token: ${SAMPLE_JWT}`, '.https custom header');
  verifyTokenFound(`GET https://api.example.com/data?token=${SAMPLE_JWT} HTTP/1.1`, '.http query param');
});

test('JavaScript (.js) and TypeScript (.ts / .tsx): variables, objects, template strings', () => {
  verifyTokenFound(`const jwtToken = "${SAMPLE_JWT}";`, 'JavaScript double quote');
  verifyTokenFound(`let token: string = '${SAMPLE_JWT}';`, 'TypeScript single quote');
  verifyTokenFound(`const headers = { Authorization: \`Bearer ${SAMPLE_JWT}\` };`, 'TypeScript template string');
});

test('Python (.py): strings, f-strings, dicts, comments', () => {
  verifyTokenFound(`token = "${SAMPLE_JWT}"`, 'Python double quote');
  verifyTokenFound(`AUTH_HEADER = {'Authorization': f'Bearer ${SAMPLE_JWT}'}`, 'Python dict');
  verifyTokenFound(`auth_token: str = '${SAMPLE_JWT}' # Staging key`, 'Python typed variable');
});

test('Go (.go): string constants and variable assignments', () => {
  verifyTokenFound(`token := "${SAMPLE_JWT}"`, 'Go short declaration');
  verifyTokenFound(`const AuthToken = "${SAMPLE_JWT}"`, 'Go const declaration');
});

test('Rust (.rs): let bindings and constants', () => {
  verifyTokenFound(`let token = "${SAMPLE_JWT}";`, 'Rust let binding');
  verifyTokenFound(`const TOKEN: &str = "${SAMPLE_JWT}";`, 'Rust const');
});

test('Java (.java) and C# (.cs): string field declarations', () => {
  verifyTokenFound(`private static final String TOKEN = "${SAMPLE_JWT}";`, 'Java static final');
  verifyTokenFound(`string authToken = "${SAMPLE_JWT}";`, 'C# string variable');
});

test('Ruby (.rb) and PHP (.php): variable assignments', () => {
  verifyTokenFound(`auth_token = "${SAMPLE_JWT}"`, 'Ruby string');
  verifyTokenFound(`$token = '${SAMPLE_JWT}';`, 'PHP variable');
});

test('Shell scripts (.sh / .bash / .zsh): exports and curl commands', () => {
  verifyTokenFound(`export ACCESS_TOKEN="${SAMPLE_JWT}"`, 'Shell export');
  verifyTokenFound(`curl -H "Authorization: Bearer ${SAMPLE_JWT}" https://api.com`, 'cURL invocation');
});

test('YAML (.yaml / .yml) and JSON (.json) configs', () => {
  verifyTokenFound(`  jwtToken: ${SAMPLE_JWT}`, 'YAML unquoted');
  verifyTokenFound(`  token: "${SAMPLE_JWT}"`, 'YAML quoted');
  verifyTokenFound(`{"authToken": "${SAMPLE_JWT}"}`, 'JSON property');
});

test('Markdown (.md) and documentation files: code blocks and inline code', () => {
  verifyTokenFound(`Use the token \`${SAMPLE_JWT}\` in your request`, 'Markdown inline code');
  verifyTokenFound(`\`\`\`json\n{"token": "${SAMPLE_JWT}"}\n\`\`\``, 'Markdown code fence');
});
