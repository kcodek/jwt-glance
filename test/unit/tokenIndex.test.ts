import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';

// Lightweight mock for vscode
const mockVscode = {
  Position: class {
    constructor(public readonly line: number, public readonly character: number) {}
  },
  workspace: {
    getConfiguration: () => ({
      get: <T>(k: string, d: T): T => {
        if (k === 'maxLineLength') return 10000 as T;
        if (k === 'enabled') return true as T;
        if (k === 'languages') return ['*'] as T;
        if (k === 'maxDocumentCharacters') return 524288 as T;
        if (k === 'exclude') return [] as T;
        return d;
      }
    })
  }
};

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'vscode') {
    return mockVscode;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { extractCandidateTokensFromLines, DocumentTokenIndex } = require('../../src/vscode/tokenIndex');

describe('DocumentTokenIndex', () => {
  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c';

  it('extracts candidate tokens with line numbers and character offsets', () => {
    const lines = [
      '# Configuration file',
      `AUTH_TOKEN="${sampleToken}"`,
      'PORT=8080'
    ];
    const tokens = extractCandidateTokensFromLines(lines, 10000);
    assert.strictEqual(tokens.length, 1);
    assert.strictEqual(tokens[0].lineNum, 1);
    assert.strictEqual(tokens[0].startIndex, 12);
    assert.strictEqual(tokens[0].endIndex, 12 + sampleToken.length);
    assert.strictEqual(tokens[0].raw, sampleToken);
  });

  it('skips lines exceeding maxLineLength', () => {
    const lines = [
      'X'.repeat(5000) + ' ' + sampleToken
    ];
    const tokens = extractCandidateTokensFromLines(lines, 1000);
    assert.strictEqual(tokens.length, 0);
  });

  it('caches tokens by document version and reuses without re-scanning', () => {
    const index = new DocumentTokenIndex();
    let readCount = 0;

    const mockDoc = {
      uri: { toString: () => 'file:///project/.env', fsPath: '/project/.env' },
      languageId: 'properties',
      version: 1,
      lineCount: 2,
      offsetAt: () => 50,
      getText: () => `TOKEN=${sampleToken}\nPORT=3000`,
      lineAt: (i: number) => {
        readCount++;
        return { text: i === 0 ? `TOKEN=${sampleToken}` : 'PORT=3000' };
      }
    };

    // First call: scans document (1 read for eligibility + 2 reads for line scanning = 3 reads)
    const tokens1 = index.getTokens(mockDoc);
    assert.strictEqual(tokens1.length, 1);
    const initialReads = readCount;
    assert.strictEqual(initialReads, 3);

    // Second call: version unchanged -> returns cached tokens without scanning lines
    const tokens2 = index.getTokens(mockDoc);
    assert.strictEqual(tokens2.length, 1);
    assert.strictEqual(readCount, initialReads); // Zero extra line reads!

    // Version bumped -> re-scans
    mockDoc.version = 2;
    const tokens3 = index.getTokens(mockDoc);
    assert.strictEqual(tokens3.length, 1);
    assert.strictEqual(readCount, initialReads + 3);

    // Invalidation works
    index.invalidate(mockDoc.uri);
    const tokens4 = index.getTokens(mockDoc);
    assert.strictEqual(tokens4.length, 1);
    assert.strictEqual(readCount, initialReads + 6);
  });

  it('handles empty document (0 lines) safely without error', () => {
    const index = new DocumentTokenIndex();
    const emptyDoc = {
      uri: { toString: () => 'file:///project/empty.env', fsPath: '/project/empty.env' },
      languageId: 'properties',
      version: 1,
      lineCount: 0,
      offsetAt: () => 0,
      lineAt: () => ({ text: '' })
    };
    const tokens = index.getTokens(emptyDoc);
    assert.deepStrictEqual(tokens, []);
  });

  it('handles null or undefined document references gracefully', () => {
    const index = new DocumentTokenIndex();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.deepStrictEqual(index.getTokens(null as any), []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.deepStrictEqual(index.getTokens(undefined as any), []);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    assert.deepStrictEqual(index.getTokens({} as any), []);
  });

  it('clear() flushes entire cache', () => {
    const index = new DocumentTokenIndex();
    const doc = {
      uri: { toString: () => 'file:///project/a.env', fsPath: '/project/a.env' },
      languageId: 'properties',
      version: 1,
      lineCount: 1,
      offsetAt: () => 10,
      lineAt: () => ({ text: `TOKEN="${sampleToken}"` })
    };
    const tokens1 = index.getTokens(doc);
    assert.strictEqual(tokens1.length, 1);

    index.clear();
    // After clear, cache is empty and will re-fetch
    const tokens2 = index.getTokens(doc);
    assert.strictEqual(tokens2.length, 1);
  });
});
