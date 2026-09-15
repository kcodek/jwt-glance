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

test('formatBadgeLabel formats active token with subject', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520, // 42m
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'user-42',
    roles: ['admin'],
    warnings: []
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · user-42 · Active 42m');
  // Roles remain in detailed hover only
  assert.ok(!label.includes('admin'));
});

test('formatBadgeLabel formats token without subject when subject is null', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520, // 42m
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: ['admin'],
    warnings: []
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · Active 42m');
});

test('formatBadgeLabel formats expired token', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'EXPIRED',
    expiresAtIso: '2026-09-10T11:00:00.000Z',
    secondsUntilExpiration: -480, // 8m ago
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: [],
    warnings: []
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · Expired 8m');
});

test('formatBadgeLabel formats alg:none unsecured token with prominent warning', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'none',
    isUnsecured: true,
    segmentCount: 3,
    signature: { presence: 'EMPTY', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'local-dev-user',
    roles: [],
    warnings: ['UNSECURED_ALG_NONE']
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · UNSECURED alg:none · local-dev-user · Active 42m');
});

test('formatBadgeLabel formats signed token with missing signature with prominent warning', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 2,
    signature: { presence: 'ABSENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'service-account',
    roles: [],
    warnings: ['SIGNATURE_MISSING', 'TWO_SEGMENT_INSPECTION']
  };

  const label = formatBadgeLabel(token);
  assert.equal(label, 'JWT · RS256 NO SIG ⚠️ · service-account · Active 42m');
});

