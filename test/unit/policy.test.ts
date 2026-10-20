import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import { evaluatePolicy, type JwtWorkspacePolicy } from '../../src/core/policy';
import { assessToken } from '../../src/core/index';

const BASE_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJpc3MiOiJhdXRoLmV4YW1wbGUuY29tIiwiYXVkIjoib3JkZXJzLWFwaSIsImV4cCI6MTgwMDAwMDAwMCwiaWF0IjoxNzAwMDAwMDAwfQ.sig';

describe('Workspace Policy Evaluation', () => {
  const now = 1750000000;
  const recognized = assessToken(BASE_TOKEN, now);
  if (!recognized.recognized) {
    throw new Error('Test token must be recognized');
  }

  it('passes when token conforms fully to policy', () => {
    const policy: JwtWorkspacePolicy = {
      name: 'Production Orders',
      issuer: 'auth.example.com',
      audience: 'orders-api',
      allowedAlgorithms: ['HS256', 'RS256'],
      requiredClaims: ['sub', 'exp', 'iss']
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 0);
  });

  it('detects issuer mismatch', () => {
    const policy: JwtWorkspacePolicy = {
      issuer: 'other-auth.example.com'
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'ISSUER_MISMATCH');
    assert.ok(diagnostics[0]?.message.includes('other-auth.example.com'));
  });

  it('detects audience mismatch with string and array audience', () => {
    const policy: JwtWorkspacePolicy = {
      audience: 'billing-api'
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'AUDIENCE_MISMATCH');
  });

  it('passes audience check when one of allowed audiences in array matches', () => {
    const policy: JwtWorkspacePolicy = {
      audience: ['billing-api', 'orders-api']
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 0);
  });

  it('detects disallowed algorithm', () => {
    const policy: JwtWorkspacePolicy = {
      allowedAlgorithms: ['RS256', 'ES256']
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'ALGORITHM_DISALLOWED');
    assert.ok(diagnostics[0]?.message.includes('HS256'));
  });

  it('detects missing required claims', () => {
    const policy: JwtWorkspacePolicy = {
      requiredClaims: ['sub', 'tenant_id']
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'CLAIM_MISSING');
    assert.ok(diagnostics[0]?.message.includes('tenant_id'));
  });

  it('passes when custom claim is present in token payload', () => {
    const customPayload = Buffer.from(
      JSON.stringify({
        sub: 'user-42',
        tenant_id: 'tenant-acme',
        exp: 1800000000,
        iat: 1700000000
      })
    ).toString('base64url');
    const customToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${customPayload}.sig`;
    const assessed = assessToken(customToken, now);
    if (!assessed.recognized) throw new Error('Must recognize token');

    const policy: JwtWorkspacePolicy = {
      requiredClaims: ['sub', 'tenant_id']
    };
    const diagnostics = evaluatePolicy(assessed, policy, now);
    assert.strictEqual(diagnostics.length, 0);
  });

  it('requires expiration by default when requireExpiration is omitted', () => {
    const noExpPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', iat: 1700000000 })
    ).toString('base64url');
    const noExpToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${noExpPayload}.sig`;
    const assessed = assessToken(noExpToken, now);
    if (!assessed.recognized) throw new Error('Must recognize');

    // Default policy (requireExpiration omitted)
    const policyDefault: JwtWorkspacePolicy = {};
    const diagsDefault = evaluatePolicy(assessed, policyDefault, now);
    assert.strictEqual(diagsDefault.length, 1);
    assert.strictEqual(diagsDefault[0]?.code, 'CLAIM_MISSING');
    assert.ok(diagsDefault[0]?.message.includes('expiration'));

    // Explicit requireExpiration: false should allow no-expiration token
    const policyAllow: JwtWorkspacePolicy = { requireExpiration: false };
    const diagsAllow = evaluatePolicy(assessed, policyAllow, now);
    assert.strictEqual(diagsAllow.length, 0);
  });

  it('detects malformed exp when requireExpiration is enabled', () => {
    const malformedExpPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: 'not-a-numeric-date' })
    ).toString('base64url');
    const malformedExpToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${malformedExpPayload}.sig`;
    const assessed = assessToken(malformedExpToken, now);
    if (!assessed.recognized) throw new Error('Must recognize');

    const policy: JwtWorkspacePolicy = { requireExpiration: true };
    const diags = evaluatePolicy(assessed, policy, now);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0]?.code, 'MALFORMED_EXPIRATION');
    assert.ok(diags[0]?.message.includes('malformed'));
  });

  it('detects missing iat when maximumTokenAgeSeconds is configured', () => {
    const noIatPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: 1800000000 })
    ).toString('base64url');
    const noIatToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${noIatPayload}.sig`;
    const assessed = assessToken(noIatToken, now);
    if (!assessed.recognized) throw new Error('Must recognize');

    const policy: JwtWorkspacePolicy = {
      maximumTokenAgeSeconds: 3600
    };
    const diagnostics = evaluatePolicy(assessed, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'CLAIM_MISSING');
    assert.ok(diagnostics[0]?.message.includes('iat'));
  });

  it('detects future iat beyond clock skew when maximumTokenAgeSeconds is configured', () => {
    const futureIatPayload = Buffer.from(
      JSON.stringify({ sub: 'user-1', exp: 1900000000, iat: now + 500 })
    ).toString('base64url');
    const futureIatToken = `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.${futureIatPayload}.sig`;
    const assessed = assessToken(futureIatToken, now);
    if (!assessed.recognized) throw new Error('Must recognize');

    const policy: JwtWorkspacePolicy = {
      maximumTokenAgeSeconds: 3600
    };
    const diagnostics = evaluatePolicy(assessed, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'MAX_AGE_EXCEEDED');
    assert.ok(diagnostics[0]?.message.includes('future'));
  });

  it('detects maximum token age exceeded', () => {
    const policy: JwtWorkspacePolicy = {
      maximumTokenAgeSeconds: 3600 // iat is 1700000000, now is 1750000000 (diff: 50,000,000s)
    };
    const diagnostics = evaluatePolicy(recognized, policy, now);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'MAX_AGE_EXCEEDED');
  });

  it('detects expired tokens when assessed after expiration', () => {
    const expiredNow = 1900000000;
    const expiredAssessment = assessToken(BASE_TOKEN, expiredNow);
    if (!expiredAssessment.recognized) throw new Error('Must recognize');

    const policy: JwtWorkspacePolicy = {
      name: 'Strict Expiration'
    };
    const diagnostics = evaluatePolicy(expiredAssessment, policy, expiredNow);
    assert.strictEqual(diagnostics.length, 1);
    assert.strictEqual(diagnostics[0]?.code, 'TOKEN_EXPIRED');
  });
});
