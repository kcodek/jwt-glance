import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { parseJwt } from '../../src/core/parse';

const VALID_JWT = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';
const ALG_NONE_JWT = 'eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJ1c2VyMSJ9.';

test('parseJwt successfully decodes valid HS256 token', () => {
  const result = parseJwt(VALID_JWT);
  assert.equal('reason' in result, false);
  if (!('reason' in result)) {
    assert.equal(result.header['alg'], 'HS256');
    assert.equal(result.payload['sub'], '1234567890');
    assert.equal(result.payload['name'], 'John Doe');
  }
});

test('parseJwt successfully decodes alg:none token with empty signature', () => {
  const result = parseJwt(ALG_NONE_JWT);
  assert.equal('reason' in result, false);
  if (!('reason' in result)) {
    assert.equal(result.header['alg'], 'none');
    assert.equal(result.payload['sub'], 'user1');
  }
});

test('parseJwt successfully decodes 2-segment signature-omitted token', () => {
  const twoPart = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIn0';
  const result = parseJwt(twoPart);
  assert.equal('reason' in result, false);
  if (!('reason' in result)) {
    assert.equal(result.header['alg'], 'RS256');
    assert.equal(result.payload['sub'], '1234567890');
    assert.equal(result.payload['name'], 'John Doe');
    assert.equal(result.signature, '');
  }
});

test('parseJwt rejects tokens with invalid segment counts (not 2 or 3 segments)', () => {
  const result = parseJwt('not.a.token.with.extra.dots');
  assert.deepEqual(result, { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });

  const resultOne = parseJwt('onlyonesegment');
  assert.deepEqual(resultOne, { recognized: false, reason: 'INVALID_SEGMENT_COUNT' });

  const resultTwoMalformed = parseJwt('onlytwo.segments');
  assert.deepEqual(resultTwoMalformed, { recognized: false, reason: 'MALFORMED_HEADER' });
});

test('parseJwt rejects tokens with malformed header JSON or missing alg', () => {
  // 'not-json' in base64url is 'bm90LWpzb24'
  const result = parseJwt('bm90LWpzb24.eyJzdWIiOiIxMjMifQ.sig');
  assert.deepEqual(result, { recognized: false, reason: 'MALFORMED_HEADER' });

  // JSON header missing 'alg': base64url of '{"typ":"JWT"}' is 'eyJ0eXAiOiJKV1QifQ'
  const resultNoAlg = parseJwt('eyJ0eXAiOiJKV1QifQ.eyJzdWIiOiIxMjMifQ.sig');
  assert.deepEqual(resultNoAlg, { recognized: false, reason: 'MALFORMED_HEADER' });
});

test('parseJwt rejects tokens with malformed payload JSON', () => {
  // header: {"alg":"HS256"} -> 'eyJhbGciOiJIUzI1NiJ9'
  // payload: invalid json 'bm90LWpzb24'
  const result = parseJwt('eyJhbGciOiJIUzI1NiJ9.bm90LWpzb24.sig');
  assert.deepEqual(result, { recognized: false, reason: 'MALFORMED_PAYLOAD' });
});
