import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluateTemporal } from '../../src/core/temporal';

const NOW = 1700000000; // Reference epoch seconds

test('evaluateTemporal returns ACTIVE when exp is in the future', () => {
  const payload = {
    exp: NOW + 3600,
    iat: NOW - 60
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'ACTIVE');
  assert.equal(result.secondsUntilExpiration, 3600);
  assert.equal(result.expiresAtIso, new Date((NOW + 3600) * 1000).toISOString());
  assert.equal(result.issuedAtIso, new Date((NOW - 60) * 1000).toISOString());
  assert.equal(result.warnings.length, 0);
});

test('evaluateTemporal returns EXPIRED when exp is in the past', () => {
  const payload = {
    exp: NOW - 120
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'EXPIRED');
  assert.equal(result.secondsUntilExpiration, -120);
  assert.equal(result.warnings.length, 0);
});

test('evaluateTemporal returns NOT_YET_ACTIVE when nbf is in future', () => {
  const payload = {
    exp: NOW + 7200,
    nbf: NOW + 300
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'NOT_YET_ACTIVE');
  assert.equal(result.secondsUntilExpiration, 7200);
});

test('evaluateTemporal returns NO_EXPIRATION when exp is omitted', () => {
  const payload = {
    sub: 'user-1'
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'NO_EXPIRATION');
  assert.equal(result.secondsUntilExpiration, null);
  assert.equal(result.expiresAtIso, null);
});

test('evaluateTemporal detects MALFORMED warnings and INDETERMINATE status for non-number timestamps', () => {
  const payload = {
    exp: '2026-10-01',
    iat: 'now',
    nbf: { invalid: true }
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'INDETERMINATE');
  assert.equal(result.secondsUntilExpiration, null);
  assert.ok(result.warnings.includes('MALFORMED_EXP'));
  assert.ok(result.warnings.includes('MALFORMED_IAT'));
  assert.ok(result.warnings.includes('MALFORMED_NBF'));
});

test('evaluateTemporal detects IAT_IN_FUTURE warning', () => {
  const payload = {
    exp: NOW + 3600,
    iat: NOW + 500
  };
  const result = evaluateTemporal(payload, NOW);
  assert.equal(result.temporalStatus, 'ACTIVE');
  assert.ok(result.warnings.includes('IAT_IN_FUTURE'));
});

test('evaluateTemporal detects NBF_AFTER_EXP warning', () => {
  const payload = {
    exp: NOW + 100,
    nbf: NOW + 200
  };
  const result = evaluateTemporal(payload, NOW);
  assert.ok(result.warnings.includes('NBF_AFTER_EXP'));
});
