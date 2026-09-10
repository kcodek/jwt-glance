import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { sanitizeMarkdown } from '../../src/core/sanitize';

test('sanitizeMarkdown escapes markdown formatting characters', () => {
  const untrusted = 'admin | *bold* _italic_ `code` [link](http://evil.com) <script>';
  const sanitized = sanitizeMarkdown(untrusted);
  assert.ok(!sanitized.includes('*bold*'));
  assert.ok(!sanitized.includes('`code`'));
  assert.ok(!sanitized.includes('[link]'));
  assert.ok(!sanitized.includes('<script>'));
  assert.ok(sanitized.includes('\\|'));
});

test('sanitizeMarkdown handles non-string values safely', () => {
  assert.equal(sanitizeMarkdown(123 as unknown as string), '123');
  assert.equal(sanitizeMarkdown(null as unknown as string), '');
  assert.equal(sanitizeMarkdown(undefined as unknown as string), '');
});
