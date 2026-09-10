import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluateTemporal } from '../../src/core/temporal';

const NOW = 1700000000;

test('Exact boundary: now === exp returns ACTIVE with secondsUntilExpiration = 0', () => {
  const result = evaluateTemporal({ exp: NOW }, NOW);
  assert.equal(result.temporalStatus, 'ACTIVE');
  assert.equal(result.secondsUntilExpiration, 0);
});

test('Exact boundary: now === nbf returns ACTIVE when exp is future', () => {
  const result = evaluateTemporal({ nbf: NOW, exp: NOW + 100 }, NOW);
  assert.equal(result.temporalStatus, 'ACTIVE');
  assert.equal(result.secondsUntilExpiration, 100);
});

test('Fractional / floating point timestamps are evaluated without NaN or crashes', () => {
  const result = evaluateTemporal({ exp: NOW + 120.75, iat: NOW - 50.25 }, NOW);
  assert.equal(result.temporalStatus, 'ACTIVE');
  assert.equal(result.secondsUntilExpiration, 120.75);
  assert.ok(result.expiresAtIso !== null);
  assert.ok(result.issuedAtIso !== null);
});

test('Infinity, -Infinity, and NaN timestamps are rejected as MALFORMED and INDETERMINATE', () => {
  const resultInf = evaluateTemporal({ exp: Infinity, iat: -Infinity, nbf: NaN }, NOW);
  assert.equal(resultInf.temporalStatus, 'INDETERMINATE');
  assert.ok(resultInf.warnings.includes('MALFORMED_EXP'));
  assert.ok(resultInf.warnings.includes('MALFORMED_IAT'));
  assert.ok(resultInf.warnings.includes('MALFORMED_NBF'));
});

test('String numeric timestamps are rejected as MALFORMED per RFC 7519 NumericDate specification', () => {
  const result = evaluateTemporal({ exp: `${NOW + 3600}`, iat: `${NOW}` }, NOW);
  assert.equal(result.temporalStatus, 'INDETERMINATE');
  assert.ok(result.warnings.includes('MALFORMED_EXP'));
  assert.ok(result.warnings.includes('MALFORMED_IAT'));
});

test('Negative and distant future timestamps convert safely to ISO strings', () => {
  // Negative timestamp (before 1970)
  const resultPast = evaluateTemporal({ exp: -100000 }, 0);
  assert.equal(resultPast.temporalStatus, 'EXPIRED');
  assert.ok(resultPast.expiresAtIso?.startsWith('1969'));

  // Year 9999 timestamp
  const resultFuture = evaluateTemporal({ exp: 253402300799 }, NOW);
  assert.equal(resultFuture.temporalStatus, 'ACTIVE');
  assert.ok(resultFuture.expiresAtIso?.startsWith('9999'));
});

test('Full lifecycle permutation matrix for iat, nbf, and exp', () => {
  // 1. iat < nbf < now < exp -> ACTIVE
  const activeCase = evaluateTemporal({ iat: NOW - 200, nbf: NOW - 100, exp: NOW + 300 }, NOW);
  assert.equal(activeCase.temporalStatus, 'ACTIVE');
  assert.equal(activeCase.warnings.length, 0);

  // 2. iat < now < nbf < exp -> NOT_YET_ACTIVE
  const notYetActiveCase = evaluateTemporal({ iat: NOW - 100, nbf: NOW + 50, exp: NOW + 300 }, NOW);
  assert.equal(notYetActiveCase.temporalStatus, 'NOT_YET_ACTIVE');
  assert.equal(notYetActiveCase.warnings.length, 0);

  // 3. iat < nbf < exp < now -> EXPIRED
  const expiredCase = evaluateTemporal({ iat: NOW - 500, nbf: NOW - 400, exp: NOW - 100 }, NOW);
  assert.equal(expiredCase.temporalStatus, 'EXPIRED');
  assert.equal(expiredCase.warnings.length, 0);

  // 4. now < iat < nbf < exp -> NOT_YET_ACTIVE + IAT_IN_FUTURE
  const futureIatCase = evaluateTemporal({ iat: NOW + 50, nbf: NOW + 100, exp: NOW + 300 }, NOW);
  assert.equal(futureIatCase.temporalStatus, 'NOT_YET_ACTIVE');
  assert.ok(futureIatCase.warnings.includes('IAT_IN_FUTURE'));

  // 5. iat < exp < nbf -> NBF_AFTER_EXP
  const invertedCase = evaluateTemporal({ iat: NOW - 100, exp: NOW + 100, nbf: NOW + 200 }, NOW);
  assert.ok(invertedCase.warnings.includes('NBF_AFTER_EXP'));
});
