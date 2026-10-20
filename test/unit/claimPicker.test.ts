import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { resolveGlanceClaim, resolveGlanceClaims } from '../../src/core/claimPicker';

test('resolveGlanceClaim returns sub claim by default', () => {
  const payload = { sub: 'user_12345', email: 'alice@example.com' };
  const res = resolveGlanceClaim(payload);
  assert.equal(res, 'user_12345');
});

test('resolveGlanceClaim prioritizes first matching candidate in array', () => {
  const payload = {
    sub: 'auth0|98765',
    email: 'bob@example.com',
    preferred_username: 'bob_the_builder'
  };

  const res1 = resolveGlanceClaim(payload, ['preferred_username', 'email', 'sub']);
  assert.equal(res1, 'bob_the_builder');

  const res2 = resolveGlanceClaim(payload, ['email', 'preferred_username', 'sub']);
  assert.equal(res2, 'bob@example.com');
});

test('resolveGlanceClaim falls back to later candidates if earlier ones are missing or empty', () => {
  const payload = {
    email: '   ',
    sub: 'carol_99'
  };

  const res = resolveGlanceClaim(payload, ['preferred_username', 'email', 'sub']);
  assert.equal(res, 'carol_99');
});

test('resolveGlanceClaim accepts single string candidate', () => {
  const payload = { email: 'david@example.com', sub: 'd123' };
  const res = resolveGlanceClaim(payload, 'email');
  assert.equal(res, 'david@example.com');
});

test('resolveGlanceClaim resolves nested dot-notated claim paths', () => {
  const payload = {
    user: {
      profile: {
        email: 'nested@example.com'
      }
    },
    sub: 'root_sub'
  };

  const res = resolveGlanceClaim(payload, ['user.profile.email', 'sub']);
  assert.equal(res, 'nested@example.com');
});

test('resolveGlanceClaim formats numeric and boolean claims', () => {
  assert.equal(resolveGlanceClaim({ uid: 42 }, ['uid']), '42');
  assert.equal(resolveGlanceClaim({ verified: true }, ['verified']), 'true');
});

test('resolveGlanceClaim formats array claims with comma separation', () => {
  const payload = { roles: ['admin', 'billing'] };
  assert.equal(resolveGlanceClaim(payload, ['roles']), 'admin, billing');
});

test('resolveGlanceClaim truncates excessively long claim values with ellipsis', () => {
  const longEmail = 'a'.repeat(80) + '@example.com';
  const payload = { email: longEmail };
  const res = resolveGlanceClaim(payload, 'email');
  assert.ok(res !== null);
  assert.ok(res.length <= 60);
  assert.ok(res.endsWith('…'));
});

test('resolveGlanceClaim normalizes control characters and multi-line text to single line', () => {
  const payload = {
    name: "line1\r\nline2\t\x00with\x1fcontrols",
    roles: ["admin\nsuper", "user\r\nlevel"]
  };

  assert.equal(resolveGlanceClaim(payload, 'name'), 'line1 line2 with controls');
  assert.equal(resolveGlanceClaim(payload, 'roles'), 'admin super, user level');
});

test('resolveGlanceClaim returns null for empty/invalid payloads or missing candidates', () => {
  assert.equal(resolveGlanceClaim(undefined, ['sub']), null);
  assert.equal(resolveGlanceClaim({}, ['sub', 'email']), null);
  assert.equal(resolveGlanceClaim({ other: 'value' }, ['sub', 'email']), null);
});

test('resolveGlanceClaims returns up to 3 matching claims by default', () => {
  const payload = {
    sub: 'alice@example.com',
    name: 'Alice Smith',
    roles: ['admin', 'developer']
  };

  const res = resolveGlanceClaims(payload, ['roles', 'name', 'email', 'sub'], 3);
  assert.deepEqual(res, ['admin, developer', 'Alice Smith', 'alice@example.com']);
});

test('resolveGlanceClaims respects custom maxClaims limit', () => {
  const payload = {
    sub: 'alice@example.com',
    name: 'Alice Smith',
    roles: ['admin', 'developer']
  };

  const res2 = resolveGlanceClaims(payload, ['roles', 'name', 'sub'], 2);
  assert.deepEqual(res2, ['admin, developer', 'Alice Smith']);

  const res1 = resolveGlanceClaims(payload, ['roles', 'name', 'sub'], 1);
  assert.deepEqual(res1, ['admin, developer']);
});

test('resolveGlanceClaims deduplicates identical claim values', () => {
  const payload = {
    email: 'alice@example.com',
    sub: 'alice@example.com',
    name: 'Alice'
  };

  // 'sub' and 'email' share the same value; duplicate should not be emitted
  const res = resolveGlanceClaims(payload, ['email', 'sub', 'name'], 3);
  assert.deepEqual(res, ['alice@example.com', 'Alice']);
});
