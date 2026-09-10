import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { assessToken } from '../../src/core/index';

function createTokenWithPayload(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256' })).toString('base64url');
  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${header}.${payloadB64}.sig`;
}

test('Extracts Keycloak realm_access roles', () => {
  const token = createTokenWithPayload({
    sub: 'kc-user-1',
    realm_access: {
      roles: ['offline_access', 'uma_authorization', 'app-admin']
    }
  });

  const assessment = assessToken(token, 1700000000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.deepEqual(assessment.roles.sort(), ['app-admin', 'offline_access', 'uma_authorization']);
  }
});

test('Extracts AWS Cognito groups via cognito:groups claim', () => {
  const token = createTokenWithPayload({
    sub: 'cognito-user-99',
    'cognito:groups': ['us-east-1_Admins', 'DevOps']
  });

  const assessment = assessToken(token, 1700000000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.deepEqual(assessment.roles.sort(), ['DevOps', 'us-east-1_Admins']);
  }
});

test('Extracts Azure AD / Microsoft Entra roles array', () => {
  const token = createTokenWithPayload({
    sub: 'entra-user',
    roles: ['Directory.Read.All', 'User.Invite.All']
  });

  const assessment = assessToken(token, 1700000000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.deepEqual(assessment.roles.sort(), ['Directory.Read.All', 'User.Invite.All']);
  }
});

test('Handles single string role and deduplicates across role/roles/groups', () => {
  const token = createTokenWithPayload({
    role: 'admin',
    roles: ['admin', 'viewer'],
    groups: ['viewer', 'finance']
  });

  const assessment = assessToken(token, 1700000000);
  assert.equal(assessment.recognized, true);
  if (assessment.recognized) {
    assert.deepEqual(assessment.roles.sort(), ['admin', 'finance', 'viewer']);
  }
});

test('Audience claim normalization: string vs array vs mixed elements', () => {
  // 1. Single string audience
  const tokenSingle = createTokenWithPayload({ aud: 'my-api' });
  const assSingle = assessToken(tokenSingle, 1700000000);
  assert.equal(assSingle.recognized, true);
  if (assSingle.recognized) {
    assert.equal(assSingle.audience, 'my-api');
  }

  // 2. String array audience
  const tokenArray = createTokenWithPayload({ aud: ['api-1', 'api-2'] });
  const assArray = assessToken(tokenArray, 1700000000);
  assert.equal(assArray.recognized, true);
  if (assArray.recognized) {
    assert.deepEqual(assArray.audience, ['api-1', 'api-2']);
  }

  // 3. Array with non-string elements filtered out
  const tokenMixed = createTokenWithPayload({ aud: ['valid-aud', 123, null, { obj: true }] });
  const assMixed = assessToken(tokenMixed, 1700000000);
  assert.equal(assMixed.recognized, true);
  if (assMixed.recognized) {
    assert.deepEqual(assMixed.audience, ['valid-aud']);
  }
});
