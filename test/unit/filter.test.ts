import { describe, it } from 'node:test';
import * as assert from 'node:assert';
import { matchesGlob, isPathExcluded, isEligible } from '../../src/core/filter';


describe('Document Filtering & Scope Gating', () => {
  describe('matchesGlob', () => {
    it('matches standard lockfile globs on Unix paths', () => {
      assert.strictEqual(matchesGlob('**/package-lock.json', '/repo/package-lock.json'), true);
      assert.strictEqual(matchesGlob('**/package-lock.json', '/repo/packages/core/package-lock.json'), true);
      assert.strictEqual(matchesGlob('**/package-lock.json', '/repo/package.json'), false);
    });

    it('matches Windows paths with backslashes', () => {
      assert.strictEqual(matchesGlob('**/package-lock.json', 'C:\\Users\\dev\\project\\package-lock.json'), true);
      assert.strictEqual(matchesGlob('**/*.min.*', 'C:\\Users\\dev\\project\\dist\\bundle.min.js'), true);
      assert.strictEqual(matchesGlob('**/*.min.*', 'C:\\Users\\dev\\project\\src\\bundle.js'), false);
    });

    it('matches minified files across extensions (.min.js, .min.css, .min.map)', () => {
      assert.strictEqual(matchesGlob('**/*.min.*', '/dist/bundle.min.js'), true);
      assert.strictEqual(matchesGlob('**/*.min.*', '/dist/styles.min.css'), true);
      assert.strictEqual(matchesGlob('**/*.min.*', '/src/index.ts'), false);
      assert.strictEqual(matchesGlob('**/*.min.*', 'minified.ts'), false);
    });

    it('matches untitled and single-segment documents', () => {
      assert.strictEqual(matchesGlob('**/package-lock.json', 'Untitled-1'), false);
      assert.strictEqual(matchesGlob('**/*.min.*', 'Untitled-1'), false);
    });

    it('matches virtual filesystem (VFS) and remote URIs', () => {
      assert.strictEqual(matchesGlob('**/package-lock.json', 'vscode-vfs://github/owner/repo/package-lock.json'), true);
      assert.strictEqual(matchesGlob('**/*.min.*', 'vscode-remote://wsl+Ubuntu/home/app/dist/app.min.js'), true);
    });

    it('handles malformed or adversarial user glob patterns gracefully without throwing', () => {
      assert.strictEqual(matchesGlob('[unclosed-bracket', '/path/to/file.ts'), false);
      assert.strictEqual(matchesGlob('((((', '/path/to/file.ts'), false);
      assert.strictEqual(matchesGlob('', '/path/to/file.ts'), false);
      assert.strictEqual(matchesGlob('**', ''), false);
    });
  });

  describe('isPathExcluded', () => {
    const defaultExclusions = [
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/*.min.*',
      '**/*.map'
    ];

    it('excludes matching lockfiles and sourcemaps', () => {
      assert.strictEqual(isPathExcluded('/workspace/package-lock.json', defaultExclusions), true);
      assert.strictEqual(isPathExcluded('/workspace/pnpm-lock.yaml', defaultExclusions), true);
      assert.strictEqual(isPathExcluded('/workspace/out/bundle.js.map', defaultExclusions), true);
    });

    it('allows regular source and environment files', () => {
      assert.strictEqual(isPathExcluded('/workspace/.env', defaultExclusions), false);
      assert.strictEqual(isPathExcluded('/workspace/src/auth.ts', defaultExclusions), false);
      assert.strictEqual(isPathExcluded('/workspace/requests.http', defaultExclusions), false);
    });

    it('handles empty or non-array exclusions safely', () => {
      assert.strictEqual(isPathExcluded('/workspace/test.ts', []), false);
      assert.strictEqual(isPathExcluded('/workspace/test.ts', null as unknown as string[]), false);
    });
  });

  describe('isEligible (Full Configuration & Boundary Checks)', () => {
    const baseConfig = {
      enabled: true,
      languages: ['*'],
      maxDocumentCharacters: 5000,
      exclude: ['**/*.min.*', '**/package-lock.json']
    };

    it('returns false when extension is disabled globally', () => {
      const eligible = isEligible('/path/to/file.ts', 'typescript', 100, { ...baseConfig, enabled: false });
      assert.strictEqual(eligible, false);
    });

    it('enforces language allowlists', () => {
      const langConfig = { ...baseConfig, languages: ['typescript', 'json'] };
      assert.strictEqual(isEligible('/src/app.ts', 'typescript', 100, langConfig), true);
      assert.strictEqual(isEligible('/config.json', 'json', 100, langConfig), true);
      assert.strictEqual(isEligible('/notes.md', 'markdown', 100, langConfig), false);
    });

    it('allows all languages when languages contains "*"', () => {
      assert.strictEqual(isEligible('/notes.md', 'markdown', 100, baseConfig), true);
      assert.strictEqual(isEligible('/query.sql', 'sql', 100, baseConfig), true);
    });

    it('enforces maxDocumentCharacters limits', () => {
      assert.strictEqual(isEligible('/src/small.ts', 'typescript', 4999, baseConfig), true);
      assert.strictEqual(isEligible('/src/boundary.ts', 'typescript', 5000, baseConfig), true);
      assert.strictEqual(isEligible('/src/oversized.ts', 'typescript', 5001, baseConfig), false);
    });

    it('supports legacy maxDocumentBytes fallback when maxDocumentCharacters is omitted', () => {
      const legacyConfig = {
        enabled: true,
        maxDocumentBytes: 1000
      };
      assert.strictEqual(isEligible('/src/small.ts', 'typescript', 500, legacyConfig), true);
      assert.strictEqual(isEligible('/src/large.ts', 'typescript', 1500, legacyConfig), false);
    });

    it('disables document size limits when set to 0 or negative', () => {
      assert.strictEqual(isEligible('/src/huge.ts', 'typescript', 1000000, { ...baseConfig, maxDocumentCharacters: 0 }), true);
      assert.strictEqual(isEligible('/src/huge.ts', 'typescript', 1000000, { ...baseConfig, maxDocumentCharacters: -1 }), true);
    });

    it('handles Unicode multibyte document character counts safely', () => {
      const unicodeString = '✨🔑🚀'.repeat(100); // 300 Unicode code points (600 UTF-16 code units)
      assert.strictEqual(isEligible('/src/unicode.ts', 'typescript', unicodeString.length, { ...baseConfig, maxDocumentCharacters: 1000 }), true);
      assert.strictEqual(isEligible('/src/unicode.ts', 'typescript', unicodeString.length, { ...baseConfig, maxDocumentCharacters: 200 }), false);
    });

    it('filters excluded files even if under size limit and matching language', () => {
      assert.strictEqual(isEligible('/dist/bundle.min.js', 'javascript', 100, baseConfig), false);
      assert.strictEqual(isEligible('/package-lock.json', 'json', 100, baseConfig), false);
    });
  });
});
