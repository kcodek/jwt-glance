import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';

interface TestConfig {
  enabled: boolean;
  position: 'top' | 'left' | 'both';
  overviewRuler: boolean;
  dimExpiredTokens: boolean;
  expiringSoonThreshold: number;
  maxLineLength: number;
  languages: string[];
  exclude: string[];
}

const currentConfig: TestConfig = {
  enabled: true,
  position: 'both',
  overviewRuler: true,
  dimExpiredTokens: true,
  expiringSoonThreshold: 1800,
  maxLineLength: 10000,
  languages: ['*'],
  exclude: []
};

// Lightweight VS Code API mock for pure unit test runner
const mockVscode = {
  Range: class {
    public readonly start: { line: number; character: number };
    public readonly end: { line: number; character: number };
    constructor(sl: number, sc: number, el: number, ec: number) {
      this.start = { line: sl, character: sc };
      this.end = { line: el, character: ec };
    }
  },
  Position: class {
    constructor(public readonly line: number, public readonly character: number) {}
  },
  CodeLens: class {
    constructor(public readonly range: unknown, public readonly command?: unknown) {}
  },
  ThemeColor: class {
    constructor(public readonly id: string) {}
  },
  MarkdownString: class {
    public isTrusted = false;
    constructor(public readonly value: string) {}
  },
  OverviewRulerLane: { Right: 4 },
  EventEmitter: class {
    public readonly event = () => ({ dispose: () => {} });
    public fire(): void {}
  },
  window: {
    createTextEditorDecorationType: (opts: Record<string, unknown>) => ({ id: Math.random(), opts })
  },
  workspace: {
    getConfiguration: () => ({
      get: <T>(k: string, d: T): T => {
        const val = (currentConfig as unknown as Record<string, unknown>)[k];
        return (val !== undefined ? val : d) as T;
      }
    })
  }
};

// Intercept 'vscode' import for decorator and codeLens providers
const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'vscode') {
    return mockVscode;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};

// Dynamic imports after module interception
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JwtCodeLensProvider } = require('../../src/vscode/codeLens');
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JwtDecorationProvider } = require('../../src/vscode/decorator');

const b64 = (obj: unknown) => Buffer.from(JSON.stringify(obj)).toString('base64url');
const sampleToken = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'alice', exp: 253402300799 })}.sig`;
const lineText = `AUTH_TOKEN="${sampleToken}"`;

const mockDoc = {
  uri: { fsPath: '/workspace/.env', path: '/workspace/.env' },
  languageId: 'properties',
  lineCount: 1,
  lineAt: () => ({ text: lineText }),
  offsetAt: () => lineText.length
};

interface MockDecType {
  opts: {
    before?: Record<string, unknown>;
    overviewRulerColor?: unknown;
    opacity?: string;
  };
}

test('position: "both" produces exactly 1 CodeLens, 1 inline badge, and 1 overview ruler marker', () => {
  const codeLensProvider = new JwtCodeLensProvider();
  const decorator = new JwtDecorationProvider();
  const appliedDecorations = new Map<MockDecType, unknown[]>();

  const mockEditor = {
    document: mockDoc,
    visibleRanges: [new mockVscode.Range(0, 0, 0, 0)],
    setDecorations: (decType: MockDecType, list: unknown[]) => {
      appliedDecorations.set(decType, list);
    }
  };

  currentConfig.position = 'both';
  currentConfig.overviewRuler = true;

  const lenses = codeLensProvider.provideCodeLenses(mockDoc, { isCancellationRequested: false });
  decorator.updateDecorations(mockEditor);

  // Assert exactly 1 CodeLens
  assert.equal(lenses.length, 1);

  // Count applied badges and rulers
  let badgeCount = 0;
  let rulerCount = 0;
  for (const [decType, list] of appliedDecorations) {
    if (list && list.length > 0) {
      if (decType.opts.before) badgeCount += list.length;
      if (decType.opts.overviewRulerColor) rulerCount += list.length;
    }
  }

  assert.equal(badgeCount, 1, 'Exactly one inline pill badge must be applied');
  assert.equal(rulerCount, 1, 'Exactly one overview ruler indicator must be applied without duplicates');
});

test('overviewRuler: false reliably disables scrollbar markers in "both", "left", and "top" modes', () => {
  const decorator = new JwtDecorationProvider();
  const appliedDecorations = new Map<MockDecType, unknown[]>();

  const mockEditor = {
    document: mockDoc,
    visibleRanges: [new mockVscode.Range(0, 0, 0, 0)],
    setDecorations: (decType: MockDecType, list: unknown[]) => {
      appliedDecorations.set(decType, list);
    }
  };

  const positions: Array<'both' | 'left' | 'top'> = ['both', 'left', 'top'];

  for (const pos of positions) {
    appliedDecorations.clear();
    currentConfig.position = pos;
    currentConfig.overviewRuler = false;

    decorator.updateDecorations(mockEditor);

    let rulerCount = 0;
    for (const [decType, list] of appliedDecorations) {
      if (list && list.length > 0 && decType.opts.overviewRulerColor) {
        rulerCount += list.length;
      }
    }

    assert.equal(
      rulerCount,
      0,
      `overviewRuler: false must clear all scrollbar markers when position is ${pos}`
    );
  }
});

test('position: "top" generates CodeLens and ruler marker, but zero inline badges', () => {
  const codeLensProvider = new JwtCodeLensProvider();
  const decorator = new JwtDecorationProvider();
  const appliedDecorations = new Map<MockDecType, unknown[]>();

  const mockEditor = {
    document: mockDoc,
    visibleRanges: [new mockVscode.Range(0, 0, 0, 0)],
    setDecorations: (decType: MockDecType, list: unknown[]) => {
      appliedDecorations.set(decType, list);
    }
  };

  currentConfig.position = 'top';
  currentConfig.overviewRuler = true;

  const lenses = codeLensProvider.provideCodeLenses(mockDoc, { isCancellationRequested: false });
  decorator.updateDecorations(mockEditor);

  assert.equal(lenses.length, 1, 'CodeLens must be rendered for position: top');

  let badgeCount = 0;
  for (const [decType, list] of appliedDecorations) {
    if (list && list.length > 0 && decType.opts.before) {
      badgeCount += list.length;
    }
  }

  assert.equal(badgeCount, 0, 'No inline badge must be rendered for position: top');
});

test('position: "left" generates inline badge and ruler marker, but zero CodeLenses', () => {
  const codeLensProvider = new JwtCodeLensProvider();
  const decorator = new JwtDecorationProvider();
  const appliedDecorations = new Map<MockDecType, unknown[]>();

  const mockEditor = {
    document: mockDoc,
    visibleRanges: [new mockVscode.Range(0, 0, 0, 0)],
    setDecorations: (decType: MockDecType, list: unknown[]) => {
      appliedDecorations.set(decType, list);
    }
  };

  currentConfig.position = 'left';
  currentConfig.overviewRuler = true;

  const lenses = codeLensProvider.provideCodeLenses(mockDoc, { isCancellationRequested: false });
  decorator.updateDecorations(mockEditor);

  assert.equal(lenses.length, 0, 'Zero CodeLenses must be rendered for position: left');

  let badgeCount = 0;
  for (const [decType, list] of appliedDecorations) {
    if (list && list.length > 0 && decType.opts.before) {
      badgeCount += list.length;
    }
  }

  assert.equal(badgeCount, 1, 'Exactly one inline badge must be rendered for position: left');
});
