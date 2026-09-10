import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatRelativeDuration, formatBadgeLabel } from '../../src/vscode/badgeFormatter';
import type { RecognizedToken } from '../../src/core/types';

test('formatRelativeDuration formats minutes, hours, days properly', () => {
  assert.equal(formatRelativeDuration(30), '<1m');
  assert.equal(formatRelativeDuration(60), '1m');
  assert.equal(formatRelativeDuration(2520), '42m');
  assert.equal(formatRelativeDuration(7200), '2h');
  assert.equal(formatRelativeDuration(7320), '2h 2m');
  assert.equal(formatRelativeDuration(86400), '1d');
  assert.equal(formatRelativeDuration(-120), '2m');
});

test('formatBadgeLabel formats active token without PII', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520, // 42m
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'secret-user-id',
    roles: ['admin'],
    warnings: [],
    verification: { status: 'NOT_PERFORMED' }
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · Active 42m · HS256');
  // Ensure PII is not leaked into the badge label
  assert.ok(!label.includes('secret-user-id'));
  assert.ok(!label.includes('admin'));
});

test('formatBadgeLabel formats expired token', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    temporalStatus: 'EXPIRED',
    expiresAtIso: '2026-09-10T11:00:00.000Z',
    secondsUntilExpiration: -480, // 8m ago
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: [],
    warnings: [],
    verification: { status: 'NOT_PERFORMED' }
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · Expired 8m · RS256');
});

test('formatBadgeLabel formats alg:none unsecured token with prominent warning', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'none',
    isUnsecured: true,
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: [],
    warnings: [],
    verification: { status: 'NOT_PERFORMED' }
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · UNSECURED alg:none · Active 42m');
});
