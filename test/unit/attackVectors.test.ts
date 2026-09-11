import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseJwt, assessToken, findCandidateTokens } from '../../src/core/index';

test('Case variations of alg none (None, NONE, nOnE) are all treated as isUnsecured: true', () => {
  const variations = ['none', 'None', 'NONE', 'nOnE'];
  for (const v of variations) {
    const header = Buffer.from(JSON.stringify({ alg: v })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'test' })).toString('base64url');
    const token = `${header}.${payload}.`;

    const assessment = assessToken(token, 1700000000);
    assert.equal(assessment.recognized, true);
    if (assessment.recognized) {
      assert.equal(assessment.isUnsecured, true, `Failed for variation ${v}`);
      assert.equal(assessment.algorithm, v);
    }
  }
});

test('Malformed alg headers (numbers, null, arrays, objects) return MALFORMED_HEADER', () => {
  const invalidAlgs = [123, null, true, ['HS256'], { type: 'HS256' }];
  for (const badAlg of invalidAlgs) {
    const header = Buffer.from(JSON.stringify({ alg: badAlg })).toString('base64url');
    const payload = Buffer.from(JSON.stringify({ sub: 'user' })).toString('base64url');
    const token = `${header}.${payload}.sig`;

    const result = parseJwt(token);
    assert.deepEqual(result, { recognized: false, reason: 'MALFORMED_HEADER' });
  }
});

test('Array payloads are rejected as MALFORMED_PAYLOAD', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payload = Buffer.from(JSON.stringify(['array', 'not', 'object'])).toString('base64url');
  const token = `${header}.${payload}.sig`;

  const result = parseJwt(token);
  assert.deepEqual(result, { recognized: false, reason: 'MALFORMED_PAYLOAD' });
});

test('Primitive payloads (string, number, boolean) are rejected as MALFORMED_PAYLOAD', () => {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  for (const primitive of ['"just a string"', '12345', 'true', 'null']) {
    const payload = Buffer.from(primitive).toString('base64url');
    const token = `${header}.${payload}.sig`;

    const result = parseJwt(token);
    assert.deepEqual(result, { recognized: false, reason: 'MALFORMED_PAYLOAD' });
  }
});

test('Segment count boundary checks (1, 4, 5 segments) return INVALID_SEGMENT_COUNT', () => {
  const badSegmentTokens = [
    'onlyonesegment',
    'one.two.three.four',
    'one.two.three.four.five'
  ];
  for (const token of badSegmentTokens) {
    const result = parseJwt(token);
    assert.deepEqual(result, { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  }
});

test('Empty header or empty payload returns INVALID_SEGMENT_COUNT', () => {
  assert.deepEqual(parseJwt('..sig'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  assert.deepEqual(parseJwt('header..sig'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  assert.deepEqual(parseJwt('.payload.sig'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  assert.deepEqual(parseJwt('.'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  assert.deepEqual(parseJwt('header.'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
  assert.deepEqual(parseJwt('.payload'), { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });
});

test('ReDoS resilience against adversarial patterns with long repeating characters', () => {
  const adversarialPatterns = [
    'a.'.repeat(5000),
    'a'.repeat(8000) + '.' + 'b'.repeat(8000),
    'eyJ' + '-'.repeat(10000) + '.eyJ' + '_'.repeat(10000) + '.sig'
  ];

  for (const pattern of adversarialPatterns) {
    const start = Date.now();
    const candidates = findCandidateTokens(pattern);
    const elapsed = Date.now() - start;
    assert.ok(elapsed < 50, `Candidate detection took ${elapsed}ms for adversarial pattern`);
    for (const c of candidates) {
      const parsed = parseJwt(c.raw);
      if ('reason' in parsed) {
        assert.ok(true);
      }
    }
  }
});
