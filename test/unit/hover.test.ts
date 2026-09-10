import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { formatHoverContent } from '../../src/vscode/hoverFormatter';
import type { RecognizedToken } from '../../src/core/types';

test('formatHoverContent includes algorithm, signature notice, and sanitized claims', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 2520,
    issuedAtIso: '2026-09-10T12:00:00.000Z',
    notBeforeIso: null,
    issuer: 'https://auth.example.com',
    audience: 'api-gateway',
    subject: 'user|123',
    roles: ['admin', 'viewer'],
    warnings: [],
    verification: { status: 'NOT_PERFORMED' }
  };

  const md = formatHoverContent(token, { sub: 'user|123', roles: ['admin', 'viewer'] });

  assert.ok(md.includes('### JWT Glance'));
  assert.ok(md.includes('HS256'));
  assert.ok(md.includes('Signature: Not performed'));
  assert.ok(md.includes('ACTIVE'));
  assert.ok(md.includes('https://auth.example.com'));
  assert.ok(md.includes('user\\|123')); // Sanitized pipe
  assert.ok(md.includes('admin, viewer'));
});

test('formatHoverContent flags unsecured alg:none prominently', () => {
  const token: RecognizedToken = {
    recognized: true,
    algorithm: 'none',
    isUnsecured: true,
    temporalStatus: 'ACTIVE',
    expiresAtIso: null,
    secondsUntilExpiration: null,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: null,
    roles: [],
    warnings: [],
    verification: { status: 'NOT_PERFORMED' }
  };

  const md = formatHoverContent(token);
  assert.ok(md.includes('UNSECURED'));
});
