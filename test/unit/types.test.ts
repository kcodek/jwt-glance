import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import type { TokenAssessment, RecognizedToken, UnrecognizedToken } from '../../src/core/types';

test('TokenAssessment discriminated union narrows correctly', () => {
  const recognized: TokenAssessment = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: {
      presence: 'PRESENT',
      verification: 'NOT_PERFORMED'
    },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T12:00:00.000Z',
    secondsUntilExpiration: 3600,
    issuedAtIso: '2026-09-10T11:00:00.000Z',
    notBeforeIso: null,
    issuer: 'https://auth.example.com',
    audience: 'api-service',
    subject: 'user-123',
    roles: ['admin'],
    warnings: []
  };


  const unrecognized: TokenAssessment = {
    recognized: false,
    reason: 'NOT_THREE_SEGMENTS'
  };

  function process(assessment: TokenAssessment): string {
    if (assessment.recognized) {
      const rec: RecognizedToken = assessment;
      return `Algorithm: ${rec.algorithm}, Status: ${rec.temporalStatus}`;
    } else {
      const unrec: UnrecognizedToken = assessment;
      return `Unrecognized: ${unrec.reason}`;
    }
  }

  assert.equal(process(recognized), 'Algorithm: HS256, Status: ACTIVE');
  assert.equal(process(unrecognized), 'Unrecognized: NOT_THREE_SEGMENTS');
});
