import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  resolveTokenAtPosition,
  resolveTokenFromText,
  extractClaimSummaries
} from '../../src/vscode/commandHelpers';
import type { RecognizedToken } from '../../src/core/types';

const NOW = 1516239022;
const TOKEN_A = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEifQ.signatureA';
const TOKEN_B = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIifQ.signatureB';

test('resolveTokenAtPosition boundary conditions (start, inside, exclusive end, before, after, multiple tokens)', () => {
  const line = `AUTH_PRIMARY="${TOKEN_A}" AUTH_BACKUP="${TOKEN_B}"`;
  const tokenAStart = line.indexOf(TOKEN_A);
  const tokenAEnd = tokenAStart + TOKEN_A.length;
  const tokenBStart = line.indexOf(TOKEN_B);
  const tokenBEnd = tokenBStart + TOKEN_B.length;

  // 1. Cursor before token A -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenAStart - 1), undefined);

  // 2. Cursor at exact token A start -> matches TOKEN_A
  const atStartA = resolveTokenAtPosition(line, tokenAStart);
  assert.ok(atStartA);
  assert.equal(atStartA.raw, TOKEN_A);

  // 3. Cursor inside token A -> matches TOKEN_A
  const insideA = resolveTokenAtPosition(line, tokenAStart + 10);
  assert.ok(insideA);
  assert.equal(insideA.raw, TOKEN_A);

  // 4. Cursor at exclusive end of token A -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenAEnd), undefined);

  // 5. Cursor between token A and token B -> undefined (no silent fallback to first token!)
  const midIndex = Math.floor((tokenAEnd + tokenBStart) / 2);
  assert.equal(resolveTokenAtPosition(line, midIndex), undefined);

  // 6. Cursor at exact token B start -> matches TOKEN_B
  const atStartB = resolveTokenAtPosition(line, tokenBStart);
  assert.ok(atStartB);
  assert.equal(atStartB.raw, TOKEN_B);

  // 7. Cursor inside token B -> matches TOKEN_B
  const insideB = resolveTokenAtPosition(line, tokenBStart + 5);
  assert.ok(insideB);
  assert.equal(insideB.raw, TOKEN_B);

  // 8. Cursor at exclusive end of token B -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenBEnd), undefined);

  // 9. Cursor after token B -> undefined
  assert.equal(resolveTokenAtPosition(line, line.length - 1), undefined);
});

test('resolveTokenAtPosition returns undefined when cursor is outside token on line with token', () => {
  const line = `export TOKEN="${TOKEN_A}" # some comment`;
  // Cursor at beginning of line (column 0) should return undefined (not fallback to TOKEN_A)
  const target = resolveTokenAtPosition(line, 0);
  assert.equal(target, undefined);
});

test('resolveTokenAtPosition returns undefined when no candidate exists on line', () => {
  const line = 'export DB_PASSWORD="regular-secure-password-12345"';
  const target = resolveTokenAtPosition(line, 5);
  assert.equal(target, undefined);
});

test('resolveTokenFromText recognizes clean raw token', () => {
  const resolved = resolveTokenFromText(TOKEN_A, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_A);
  assert.equal(resolved.assessment.recognized, true);
  assert.equal(resolved.assessment.subject, 'user-a');
});

test('resolveTokenFromText extracts token from Bearer prefix or header text', () => {
  const header = `Authorization: Bearer ${TOKEN_A}`;
  const resolved = resolveTokenFromText(header, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_A);
  assert.equal(resolved.assessment.subject, 'user-a');
});

test('resolveTokenFromText extracts token from quoted or json-wrapped string', () => {
  const jsonSnippet = `{"accessToken": "${TOKEN_B}"}`;
  const resolved = resolveTokenFromText(jsonSnippet, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_B);
  assert.equal(resolved.assessment.subject, 'user-b');
});

test('resolveTokenFromText returns undefined for empty or invalid text', () => {
  assert.equal(resolveTokenFromText('', NOW), undefined);
  assert.equal(resolveTokenFromText('   ', NOW), undefined);
  assert.equal(resolveTokenFromText('not-a-jwt.token.string', NOW), undefined);
  assert.equal(resolveTokenFromText('v1.2.3 and 192.168.1.1', NOW), undefined);
});

test('extractClaimSummaries extracts all present claims and handles array audience', () => {
  const fullToken: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 3600,
    issuedAtIso: '2026-09-10T12:00:00.000Z',
    notBeforeIso: null,
    issuer: 'https://auth.company.internal',
    audience: ['api-service', 'billing-service'],
    subject: 'service-worker-99',
    roles: ['operator', 'auditor'],
    warnings: []
  };

  const summaries = extractClaimSummaries(fullToken);
  assert.equal(summaries.length, 5);

  const sub = summaries.find((s) => s.name.includes('Subject'));
  assert.ok(sub);
  assert.equal(sub.value, 'service-worker-99');
  assert.equal(sub.icon, 'person');

  const roles = summaries.find((s) => s.name.includes('Roles'));
  assert.ok(roles);
  assert.equal(roles.value, 'operator, auditor');
  assert.equal(roles.icon, 'shield');

  const iss = summaries.find((s) => s.name.includes('Issuer'));
  assert.ok(iss);
  assert.equal(iss.value, 'https://auth.company.internal');

  const aud = summaries.find((s) => s.name.includes('Audience'));
  assert.ok(aud);
  assert.equal(aud.value, 'api-service, billing-service');

  const exp = summaries.find((s) => s.name.includes('Expiration'));
  assert.ok(exp);
  assert.equal(exp.value, '2026-09-10T14:00:00.000Z');
});

test('extractClaimSummaries handles single string audience and omits absent claims', () => {
  const minimalToken: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: null,
    secondsUntilExpiration: null,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: 'single-client-app',
    subject: 'usr-1',
    roles: [],
    warnings: []
  };


  const summaries = extractClaimSummaries(minimalToken);
  assert.equal(summaries.length, 2); // Only subject and audience

  assert.equal(summaries[0]?.name, 'Subject (sub)');
  assert.equal(summaries[0]?.value, 'usr-1');

  assert.equal(summaries[1]?.name, 'Audience (aud)');
  assert.equal(summaries[1]?.value, 'single-client-app');
});
