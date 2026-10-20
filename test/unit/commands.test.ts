import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import {
  resolveTokenAtPosition,
  resolveTokenFromText,
  extractClaimSummaries
} from '../../src/vscode/commandHelpers';
import type { RecognizedToken } from '../../src/core/types';

const NOW = 1516239022;
const TOKEN_A = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWEifQ.signatureA';
const TOKEN_B = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLWIifQ.signatureB';

test('resolveTokenAtPosition boundary conditions (start, inside, exclusive end, before, after, multiple tokens)', () => {
  const line = `AUTH_PRIMARY="${TOKEN_A}" AUTH_BACKUP="${TOKEN_B}"`;
  const tokenAStart = line.indexOf(TOKEN_A);
  const tokenAEnd = tokenAStart + TOKEN_A.length;
  const tokenBStart = line.indexOf(TOKEN_B);
  const tokenBEnd = tokenBStart + TOKEN_B.length;

  // 1. Cursor before token A -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenAStart - 1), undefined);

  // 2. Cursor at exact token A start -> matches TOKEN_A
  const atStartA = resolveTokenAtPosition(line, tokenAStart);
  assert.ok(atStartA);
  assert.equal(atStartA.raw, TOKEN_A);

  // 3. Cursor inside token A -> matches TOKEN_A
  const insideA = resolveTokenAtPosition(line, tokenAStart + 10);
  assert.ok(insideA);
  assert.equal(insideA.raw, TOKEN_A);

  // 4. Cursor at exclusive end of token A -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenAEnd), undefined);

  // 5. Cursor between token A and token B -> undefined (no silent fallback to first token!)
  const midIndex = Math.floor((tokenAEnd + tokenBStart) / 2);
  assert.equal(resolveTokenAtPosition(line, midIndex), undefined);

  // 6. Cursor at exact token B start -> matches TOKEN_B
  const atStartB = resolveTokenAtPosition(line, tokenBStart);
  assert.ok(atStartB);
  assert.equal(atStartB.raw, TOKEN_B);

  // 7. Cursor inside token B -> matches TOKEN_B
  const insideB = resolveTokenAtPosition(line, tokenBStart + 5);
  assert.ok(insideB);
  assert.equal(insideB.raw, TOKEN_B);

  // 8. Cursor at exclusive end of token B -> undefined
  assert.equal(resolveTokenAtPosition(line, tokenBEnd), undefined);

  // 9. Cursor after token B -> undefined
  assert.equal(resolveTokenAtPosition(line, line.length - 1), undefined);
});

test('resolveTokenAtPosition returns undefined when cursor is outside token on line with token', () => {
  const line = `export TOKEN="${TOKEN_A}" # some comment`;
  // Cursor at beginning of line (column 0) should return undefined (not fallback to TOKEN_A)
  const target = resolveTokenAtPosition(line, 0);
  assert.equal(target, undefined);
});

test('resolveTokenAtPosition returns undefined when no candidate exists on line', () => {
  const line = 'export DB_PASSWORD="regular-secure-password-12345"';
  const target = resolveTokenAtPosition(line, 5);
  assert.equal(target, undefined);
});

test('resolveTokenFromText recognizes clean raw token', () => {
  const resolved = resolveTokenFromText(TOKEN_A, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_A);
  assert.equal(resolved.assessment.recognized, true);
  assert.equal(resolved.assessment.subject, 'user-a');
});

test('resolveTokenFromText extracts token from Bearer prefix or header text', () => {
  const header = `Authorization: Bearer ${TOKEN_A}`;
  const resolved = resolveTokenFromText(header, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_A);
  assert.equal(resolved.assessment.subject, 'user-a');
});

test('resolveTokenFromText extracts token from quoted or json-wrapped string', () => {
  const jsonSnippet = `{"accessToken": "${TOKEN_B}"}`;
  const resolved = resolveTokenFromText(jsonSnippet, NOW);
  assert.ok(resolved);
  assert.equal(resolved.raw, TOKEN_B);
  assert.equal(resolved.assessment.subject, 'user-b');
});

test('resolveTokenFromText returns undefined for empty or invalid text', () => {
  assert.equal(resolveTokenFromText('', NOW), undefined);
  assert.equal(resolveTokenFromText('   ', NOW), undefined);
  assert.equal(resolveTokenFromText('not-a-jwt.token.string', NOW), undefined);
  assert.equal(resolveTokenFromText('v1.2.3 and 192.168.1.1', NOW), undefined);
});

test('extractClaimSummaries extracts all present claims and handles array audience', () => {
  const fullToken: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: '2026-09-10T14:00:00.000Z',
    secondsUntilExpiration: 3600,
    issuedAtIso: '2026-09-10T12:00:00.000Z',
    notBeforeIso: null,
    issuer: 'https://auth.company.internal',
    audience: ['api-service', 'billing-service'],
    subject: 'service-worker-99',
    roles: ['operator', 'auditor'],
    warnings: []
  };

  const summaries = extractClaimSummaries(fullToken);
  assert.equal(summaries.length, 5);

  const sub = summaries.find((s) => s.name.includes('Subject'));
  assert.ok(sub);
  assert.equal(sub.value, 'service-worker-99');
  assert.equal(sub.icon, 'account');

  const roles = summaries.find((s) => s.name.includes('Roles'));
  assert.ok(roles);
  assert.equal(roles.value, 'operator, auditor');
  assert.equal(roles.icon, 'shield');

  const iss = summaries.find((s) => s.name.includes('Issuer'));
  assert.ok(iss);
  assert.equal(iss.value, 'https://auth.company.internal');
  assert.equal(iss.icon, 'verified');

  const aud = summaries.find((s) => s.name.includes('Audience'));
  assert.ok(aud);
  assert.equal(aud.value, 'api-service, billing-service');

  const exp = summaries.find((s) => s.name.includes('Expiration'));
  assert.ok(exp);
  assert.equal(exp.value, '2026-09-10T14:00:00.000Z');

  // Verify developer-preferred order: Subject, Roles, Expiration, Issuer, Audience
  assert.equal(summaries[0]?.name, 'Subject (sub)');
  assert.equal(summaries[1]?.name, 'Roles');
  assert.equal(summaries[2]?.name, 'Expiration (exp)');
  assert.equal(summaries[3]?.name, 'Issuer (iss)');
  assert.equal(summaries[4]?.name, 'Audience (aud)');
});

test('extractClaimSummaries handles single string audience and omits absent claims', () => {
  const minimalToken: RecognizedToken = {
    recognized: true,
    algorithm: 'HS256',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: null,
    secondsUntilExpiration: null,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: 'single-client-app',
    subject: 'usr-1',
    roles: [],
    warnings: []
  };


  const summaries = extractClaimSummaries(minimalToken);
  assert.equal(summaries.length, 2); // Only subject and audience

  assert.equal(summaries[0]?.name, 'Subject (sub)');
  assert.equal(summaries[0]?.value, 'usr-1');

  assert.equal(summaries[1]?.name, 'Audience (aud)');
  assert.equal(summaries[1]?.value, 'single-client-app');
});

test('extractClaimSummaries includes keyId when present', () => {
  const tokenWithKid: RecognizedToken = {
    recognized: true,
    algorithm: 'RS256',
    keyId: 'rsa-signer-2026',
    isUnsecured: false,
    segmentCount: 3,
    signature: { presence: 'PRESENT', verification: 'NOT_PERFORMED' },
    temporalStatus: 'ACTIVE',
    expiresAtIso: null,
    secondsUntilExpiration: null,
    issuedAtIso: null,
    notBeforeIso: null,
    issuer: null,
    audience: null,
    subject: 'service-worker',
    roles: [],
    warnings: []
  };

  const summaries = extractClaimSummaries(tokenWithKid);
  const kidSummary = summaries.find((s) => s.name.includes('Key ID'));
  assert.ok(kidSummary);
  assert.equal(kidSummary.value, 'rsa-signer-2026');
  assert.equal(kidSummary.icon, 'key');
});

test('copyBearerToken writes "Authorization: Bearer <token>" to clipboard', async () => {
  let clipboardContent = '';
  let infoMessage = '';

  const mockVscode = {
    ThemeIcon: class {
      constructor(public readonly id: string) {}
    },
    env: {
      clipboard: {
        writeText: async (text: string) => {
          clipboardContent = text;
        },
        readText: async () => ''
      }
    },
    window: {
      activeTextEditor: undefined,
      showInformationMessage: (msg: string) => {
        infoMessage = msg;
      },
      showWarningMessage: () => {}
    }
  };

  const Module = require('node:module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (path: string) {
    if (path === 'vscode') {
      return mockVscode;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalRequire.apply(this, arguments as any);
  };

  const { copyBearerToken } = require('../../src/vscode/commands');
  await copyBearerToken(TOKEN_A);

  assert.equal(clipboardContent, `Authorization: Bearer ${TOKEN_A}`);
  assert.ok(infoMessage.includes('Authorization: Bearer'));

  Module.prototype.require = originalRequire;
});

test('openDecodedTokenInEditor opens document with ViewColumn.Beside and formatted JSON', async () => {
  const { openDecodedTokenInEditor } = require('../../src/vscode/commandHelpers');
  const { assessToken } = require('../../src/core/index');

  let openedDocOptions: { language?: string; content?: string } | undefined;
  let shownDoc: unknown;
  let shownOptions: { viewColumn?: unknown; preview?: boolean } | undefined;

  const mockVscode = {
    ViewColumn: {
      Beside: -2
    },
    workspace: {
      openTextDocument: async (options: { language?: string; content?: string }) => {
        openedDocOptions = options;
        return { fakeDoc: true, ...options };
      }
    },
    window: {
      showTextDocument: async (doc: unknown, options: { viewColumn?: unknown; preview?: boolean }) => {
        shownDoc = doc;
        shownOptions = options;
      }
    }
  };

  const assessment = assessToken(TOKEN_A, NOW);
  await openDecodedTokenInEditor(TOKEN_A, assessment, mockVscode as any);

  assert.ok(openedDocOptions);
  assert.equal(openedDocOptions.language, 'json');
  assert.ok(openedDocOptions.content);

  const parsed = JSON.parse(openedDocOptions.content);
  assert.equal(parsed.header.alg, 'HS256');
  assert.equal(parsed.payload.sub, 'user-a');
  assert.equal(parsed._summary.algorithm, 'HS256');

  assert.ok(shownDoc);
  assert.ok(shownOptions);
  assert.equal(shownOptions.viewColumn, -2); // ViewColumn.Beside
  assert.equal(shownOptions.preview, false);
});

test('chooseGlanceClaim prompts user with claims from active token and updates configuration', async () => {
  let updatedSettingKey = '';
  let updatedSettingVal: unknown;
  let quickPickItems: Array<{ label: string; claimKey?: string }> = [];

  const tokenWithClaims =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIiwibmFtZSI6IkFsaWNlIn0.sig';

  const mockVscode = {
    ThemeIcon: class {
      constructor(public readonly id: string) {}
    },
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, defVal: unknown) => defVal,
        update: async (key: string, val: unknown) => {
          updatedSettingKey = key;
          updatedSettingVal = val;
        }
      })
    },
    ConfigurationTarget: {
      Global: 1
    },
    QuickPickItemKind: {
      Separator: -1
    },
    window: {
      activeTextEditor: undefined,
      showQuickPick: async (items: Array<{ label: string; claimKey?: string }>) => {
        quickPickItems = items;
        // User selects 'email'
        return items.find((i) => i.claimKey === 'email');
      },
      showInformationMessage: () => {}
    }
  };

  const Module = require('node:module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (path: string) {
    if (path === 'vscode') {
      return mockVscode;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalRequire.apply(this, arguments as any);
  };

  delete require.cache[require.resolve('../../src/vscode/commands')];
  const { chooseGlanceClaim } = require('../../src/vscode/commands');
  await chooseGlanceClaim(tokenWithClaims);

  assert.equal(updatedSettingKey, 'jwtGlance');
  assert.deepEqual(updatedSettingVal, { glanceClaims: ['roles', 'name', 'email', 'sub'] });

  // Verify the QuickPick contained the extracted claims and presets
  assert.ok(quickPickItems.some((i) => i.claimKey === 'email'));
  assert.ok(quickPickItems.some((i) => i.claimKey === 'name'));
  assert.ok(quickPickItems.some((i) => i.claimKey === 'sub'));
  assert.ok(quickPickItems.some((i) => i.claimKey === 'roles'));

  delete require.cache[require.resolve('../../src/vscode/commands')];
  Module.prototype.require = originalRequire;
});

test('chooseGlanceClaim preserves existing priority list when adding new claims', async () => {
  let updatedSettingVal: unknown;
  const tokenWithClaims =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJlbWFpbCI6ImFsaWNlQGV4YW1wbGUuY29tIn0.sig';

  const mockVscode = {
    ThemeIcon: class {
      constructor(public readonly id: string) {}
    },
    workspace: {
      getConfiguration: () => ({
        // Existing user configuration has ['name', 'roles', 'sub']
        get: (_key: string, _defVal: unknown) => ['name', 'roles', 'sub'],
        update: async (_key: string, val: unknown) => {
          updatedSettingVal = val;
        }
      })
    },
    ConfigurationTarget: { Global: 1 },
    QuickPickItemKind: { Separator: -1 },
    window: {
      activeTextEditor: undefined,
      showQuickPick: async (items: Array<{ label: string; claimKey?: string }>) => {
        // User selects 'email' to add to list
        return items.find((i) => i.claimKey === 'email');
      },
      showInformationMessage: () => {}
    }
  };

  const Module = require('node:module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (path: string) {
    if (path === 'vscode') {
      return mockVscode;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalRequire.apply(this, arguments as any);
  };

  delete require.cache[require.resolve('../../src/vscode/commands')];
  delete require.cache[require.resolve('../../src/vscode/claimPriorityManager')];
  const { chooseGlanceClaim } = require('../../src/vscode/commands');
  await chooseGlanceClaim(tokenWithClaims);

  // Existing 'name' and 'roles' are preserved! 'email' is inserted before trailing 'sub' fallback
  assert.deepEqual(updatedSettingVal, { glanceClaims: ['name', 'roles', 'email', 'sub'] });

  delete require.cache[require.resolve('../../src/vscode/commands')];
  delete require.cache[require.resolve('../../src/vscode/claimPriorityManager')];
  Module.prototype.require = originalRequire;
});

test('chooseGlanceClaim allows disabling sub fallback', async () => {
  let updatedSettingVal: unknown;
  const tokenWithClaims =
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyLTEiLCJyb2xlcyI6WyJhZG1pbiJdfQ.sig';

  const mockVscode = {
    ThemeIcon: class {
      constructor(public readonly id: string) {}
    },
    workspace: {
      getConfiguration: () => ({
        get: (_key: string, _defVal: unknown) => ['roles', 'sub'],
        update: async (_key: string, val: unknown) => {
          updatedSettingVal = val;
        }
      })
    },
    ConfigurationTarget: { Global: 1 },
    QuickPickItemKind: { Separator: -1 },
    window: {
      activeTextEditor: undefined,
      showQuickPick: async (items: Array<{ label: string; isFallbackToggle?: boolean }>) => {
        // User toggles sub fallback off
        return items.find((i) => i.isFallbackToggle);
      },
      showInformationMessage: () => {}
    }
  };

  const Module = require('node:module');
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function (path: string) {
    if (path === 'vscode') {
      return mockVscode;
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return originalRequire.apply(this, arguments as any);
  };

  delete require.cache[require.resolve('../../src/vscode/commands')];
  delete require.cache[require.resolve('../../src/vscode/claimPriorityManager')];
  const { chooseGlanceClaim } = require('../../src/vscode/commands');
  await chooseGlanceClaim(tokenWithClaims);

  // 'sub' fallback was removed, resulting in strict ['roles']
  assert.deepEqual(updatedSettingVal, { glanceClaims: ['roles'] });

  delete require.cache[require.resolve('../../src/vscode/commands')];
  delete require.cache[require.resolve('../../src/vscode/claimPriorityManager')];
  Module.prototype.require = originalRequire;
});


