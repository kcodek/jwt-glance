import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatRelativeDuration, formatBadgeLabel, formatCodeLensLabel } from '../../src/vscode/badgeFormatter';
import { getTokenSemanticTier } from '../../src/vscode/semanticTier';
import type { RecognizedToken } from '../../src/core/types';

test('formatRelativeDuration formats minutes, hours, days properly', () => {
  assert.equal(formatRelativeDuration(30), '<1m');
  assert.equal(formatRelativeDuration(60), '1m');
  assert.equal(formatRelativeDuration(2520), '42m');
  assert.equal(formatRelativeDuration(7200), '2h');
  assert.equal(formatRelativeDuration(7320), '2h 2m');
  assert.equal(formatRelativeDuration(86400), '1d');
  assert.equal(formatRelativeDuration(364 * 86400), '364d');
  assert.equal(formatRelativeDuration(365 * 86400), '1y');
  assert.equal(formatRelativeDuration(3019 * 86400), '8y');
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

test('getTokenSemanticTier accurately classifies all health tiers', () => {
  const baseToken: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 3600, // 1h
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'user-1',
    roles: [],
    warnings: []
  };

  // Healthy active
  assert.equal(getTokenSemanticTier(baseToken), 'ACTIVE');
  assert.ok(formatCodeLensLabel(baseToken).startsWith('$(pass-filled)'));

  // Expiring soon (10m left, under default 1800s threshold)
  const expiringSoon = { ...baseToken, secondsUntilExpiration: 600 };
  assert.equal(getTokenSemanticTier(expiringSoon), 'EXPIRING_SOON');
  assert.ok(formatCodeLensLabel(expiringSoon).startsWith('$(clock)'));

  // Expired
  const expired = { ...baseToken, temporalStatus: 'EXPIRED' as const, secondsUntilExpiration: -300 };
  assert.equal(getTokenSemanticTier(expired), 'EXPIRED');
  assert.ok(formatCodeLensLabel(expired).startsWith('$(error)'));

  // Unsecured alg:none
  const unsecured = { ...baseToken, isUnsecured: true, algorithm: 'none' };
  assert.equal(getTokenSemanticTier(unsecured), 'UNSECURED');
  assert.ok(formatCodeLensLabel(unsecured).startsWith('$(shield) $(alert)'));

  // Missing signature
  const missingSig: RecognizedToken = {
    ...baseToken,
    signature: { presence: 'ABSENT', verification: 'NOT_PERFORMED' }
  };
  assert.equal(getTokenSemanticTier(missingSig), 'UNSECURED');

  // No expiration
  const noExp: RecognizedToken = {
    ...baseToken,
    temporalStatus: 'NO_EXPIRATION',
    expiresAtIso: null,
    secondsUntilExpiration: null
  };
  assert.equal(getTokenSemanticTier(noExp), 'NO_EXPIRATION');
  assert.ok(formatCodeLensLabel(noExp).startsWith('$(key)'));
});

test('formatBadgeLabel formats truthful multi-dimensional verification states', () => {
  const baseToken: RecognizedToken = {
    recognized: true,
    recognition: { recognized: true, format: 'JWT' },
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED', algorithm: 'RS256', keyId: 'k1' },
    temporal: {
      status: 'ACTIVE',
      expiresAtIso: '2026-09-10T14:00:00.000Z',
      secondsUntilExpiration: 2520,
      issuedAtIso: null,
      notBeforeIso: null
    },
    policy: { issuer: 'UNCHECKED', audience: 'UNCHECKED' },
    claims: { subject: 'user-42', issuer: null, audience: null, roles: [] },
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'user-42',
    roles: [],
    warnings: []
  };

  // 1. Signature Verified
  const verifiedToken: RecognizedToken = {
    ...baseToken,
    signature: { presence: 'PRESENT', verification: 'VERIFIED', algorithm: 'RS256' }
  };
  assert.equal(formatBadgeLabel(verifiedToken), 'JWT · RS256 ✓ · user-42 · Active 42m');

  // 2. Bad Signature
  const badSigToken: RecognizedToken = {
    ...baseToken,
    signature: { presence: 'PRESENT', verification: 'FAILED', algorithm: 'RS256' }
  };
  assert.equal(formatBadgeLabel(badSigToken), 'JWT · ✕ BAD SIGNATURE · user-42');

  // 3. Signature Verified + Policy Audience Mismatch
  const audMismatchToken: RecognizedToken = {
    ...baseToken,
    signature: { presence: 'PRESENT', verification: 'VERIFIED', algorithm: 'RS256' },
    policy: { issuer: 'MATCH', audience: 'MISMATCH' }
  };
  assert.equal(formatBadgeLabel(audMismatchToken), 'JWT · RS256 ✓ · AUD mismatch · user-42 · Active 42m');

  // 4. Unchecked Signature explicitly requested
  assert.equal(formatBadgeLabel(baseToken, { showUncheckedStatus: true }), 'JWT · RS256 ? Unchecked · user-42 · Active 42m');

  // 5. Default glance for unverified token NEVER claims verified or outputs ✓ / BAD SIGNATURE
  assert.equal(formatBadgeLabel(baseToken), 'JWT · user-42 · Active 42m');
  assert.ok(!formatBadgeLabel(baseToken).includes('✓'));
  assert.ok(!formatBadgeLabel(baseToken).includes('BAD SIGNATURE'));
  assert.ok(!formatBadgeLabel(baseToken).includes('Key Not Found'));
  assert.ok(!formatBadgeLabel(baseToken).includes('mismatch'));

  // 6. omitPrefix omits leading 'JWT' for Clean QuickPick headers
  assert.equal(formatBadgeLabel(baseToken, { omitPrefix: true }), 'user-42 · Active 42m');
});

test('tier precedence: expired + alg:none resolves to UNSECURED', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'none',
    isUnsecured: true,
    segmentCount: 3,
    signature: { presence: 'EMPTY', verification: 'NOT_PERFORMED' },
    temporalStatus: 'EXPIRED',
    expiresAtIso: '2020-01-01T00:00:00.000Z',
    secondsUntilExpiration: -50000,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'test-user',
    roles: [],
    warnings: ['UNSECURED_ALG_NONE']
  };

  // Security failure (alg: none) takes precedence over temporal expiration
  assert.equal(getTokenSemanticTier(token), 'UNSECURED');
});

test('tier precedence: expiring-soon within threshold + not-yet-active resolves to INDETERMINATE', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'NOT_YET_ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 600, // 10 minutes left, but not active yet!
    issuedAtIso: null,
    notBeforeIso: '2026-09-10T14:30:00.000Z',
    issuer: null,
    audience: null,
    subject: 'future-user',
    roles: [],
    warnings: []
  };

  // Token is not active yet, so it cannot be EXPIRING_SOON
  assert.equal(getTokenSemanticTier(token), 'INDETERMINATE');
});

test('exact threshold boundaries: 1800s vs 1801s and exp === now', () => {
  const baseToken: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 1800,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'boundary-user',
    roles: [],
    warnings: []
  };

  // Exactly at 1800s threshold -> EXPIRING_SOON
  assert.equal(getTokenSemanticTier(baseToken, 1800), 'EXPIRING_SOON');

  // Just above 1800s threshold (1801s) -> ACTIVE
  assert.equal(getTokenSemanticTier({ ...baseToken, secondsUntilExpiration: 1801 }, 1800), 'ACTIVE');

  // Exactly at boundary exp === now (secondsUntilExpiration: 0, temporalStatus: EXPIRED) -> EXPIRED
  const expiredNowToken: RecognizedToken = {
    ...baseToken,
    temporalStatus: 'EXPIRED',
    secondsUntilExpiration: 0
  };
  assert.equal(getTokenSemanticTier(expiredNowToken, 1800), 'EXPIRED');

  // Missing expiration -> NO_EXPIRATION
  const noExpToken: RecognizedToken = {
    ...baseToken,
    temporalStatus: 'NO_EXPIRATION',
    expiresAtIso: null,
    secondsUntilExpiration: null
  };
  assert.equal(getTokenSemanticTier(noExpToken, 1800), 'NO_EXPIRATION');

  // Malformed expiration -> INDETERMINATE
  const malformedExpToken: RecognizedToken = {
    ...baseToken,
    temporalStatus: 'INDETERMINATE',
    expiresAtIso: null,
    secondsUntilExpiration: null
  };
  assert.equal(getTokenSemanticTier(malformedExpToken, 1800), 'INDETERMINATE');
});

