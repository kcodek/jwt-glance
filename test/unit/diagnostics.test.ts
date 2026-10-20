import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';

const diagnosticsMap = new Map<string, unknown[]>();

const mockVscode = {
  Range: class {
    constructor(
      public readonly sl: number,
      public readonly sc: number,
      public readonly el: number,
      public readonly ec: number
    ) {}
  },
  Position: class {
    constructor(public readonly line: number, public readonly character: number) {}
  },
  Diagnostic: class {
    public code?: string;
    public source?: string;
    constructor(
      public readonly range: unknown,
      public readonly message: string,
      public readonly severity: number
    ) {}
  },
  DiagnosticSeverity: {
    Error: 0,
    Warning: 1,
    Information: 2,
    Hint: 3
  },
  languages: {
    createDiagnosticCollection: (name: string) => ({
      name,
      set: (uri: { toString: () => string }, diags: unknown[]) => {
        diagnosticsMap.set(uri.toString(), diags);
      },
      delete: (uri: { toString: () => string }) => {
        diagnosticsMap.delete(uri.toString());
      },
      dispose: () => {
        diagnosticsMap.clear();
      }
    })
  },
  workspace: {
    getConfiguration: () => ({
      get: <T>(k: string, d: T): T => {
        if (k === 'policies') return testPolicies as unknown as T;
        if (k === 'enabled') return true as T;
        if (k === 'languages') return ['*'] as T;
        if (k === 'maxDocumentCharacters') return 524288 as T;
        if (k === 'exclude') return [] as T;
        if (k === 'maxLineLength') return 10000 as T;
        return d;
      }
    })
  }
};

let testPolicies: unknown[] = [];

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'vscode') {
    return mockVscode;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { shouldApplyPolicyToFile, JwtDiagnosticsProvider } = require('../../src/vscode/diagnostics');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { DocumentTokenIndex } = require('../../src/vscode/tokenIndex');

describe('Policy File Matching', () => {
  it('matches files matching policy glob array', () => {
    const policy = {
      files: ['**/*.http', '**/.env*']
    };
    assert.strictEqual(shouldApplyPolicyToFile('/project/api.http', policy), true);
    assert.strictEqual(shouldApplyPolicyToFile('/project/.env.local', policy), true);
    assert.strictEqual(shouldApplyPolicyToFile('/project/src/index.ts', policy), false);
  });

  it('defaults to http and env files if files array is omitted', () => {
    const policy = {};
    assert.strictEqual(shouldApplyPolicyToFile('/project/api.http', policy), true);
    assert.strictEqual(shouldApplyPolicyToFile('/project/.env.local', policy), true);
    assert.strictEqual(shouldApplyPolicyToFile('/project/src/index.ts', policy), false);
  });

  it('matches all eligible files if wildcard glob is specified', () => {
    const policy = { files: ['*'] };
    assert.strictEqual(shouldApplyPolicyToFile('/project/src/index.ts', policy), true);
  });
});

describe('JwtDiagnosticsProvider', () => {
  const tokenIndex = new DocumentTokenIndex();
  const mockContext = { subscriptions: [] };
  const provider = new JwtDiagnosticsProvider(tokenIndex, mockContext);

  const sampleToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJpc3MiOiJhdXRoLmV4YW1wbGUuY29tIiwiYXVkIjoib3JkZXJzLWFwaSIsImV4cCI6MTgwMDAwMDAwMCwiaWF0IjoxNzAwMDAwMDAwfQ.sig';

  it('does not emit diagnostics when policies array is empty', () => {
    testPolicies = [];
    const mockDoc = {
      uri: { fsPath: '/project/.env', toString: () => 'file:///project/.env' },
      languageId: 'properties',
      version: 1,
      lineCount: 1,
      offsetAt: () => 10,
      lineAt: () => ({ text: `TOKEN="${sampleToken}"` })
    };

    provider.updateDiagnostics(mockDoc);
    assert.strictEqual(diagnosticsMap.has('file:///project/.env'), false);
  });

  it('emits diagnostic when policy issuer does not match token issuer', () => {
    testPolicies = [
      {
        name: 'Strict Prod',
        files: ['**/.env*'],
        issuer: 'different-auth.example.com'
      }
    ];

    const mockDoc = {
      uri: { fsPath: '/project/.env', toString: () => 'file:///project/.env' },
      languageId: 'properties',
      version: 1,
      lineCount: 1,
      offsetAt: () => 10,
      lineAt: () => ({ text: `TOKEN="${sampleToken}"` })
    };

    provider.updateDiagnostics(mockDoc);
    const diags = diagnosticsMap.get('file:///project/.env') as { message: string; code: string }[];
    assert.ok(diags);
    assert.strictEqual(diags.length, 1);
    assert.strictEqual(diags[0]?.code, 'ISSUER_MISMATCH');
    assert.ok(diags[0]?.message.includes('Strict Prod'));
  });
});
