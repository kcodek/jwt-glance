import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';

interface MockStatusBarConfig {
  enabled: boolean;
  showStatusBarItem: boolean;
}

const currentConfig: MockStatusBarConfig = {
  enabled: true,
  showStatusBarItem: true
};

class MockStatusBarItem {
  public text = '';
  public tooltip = '';
  public command?: string;
  public backgroundColor?: unknown;
  public isVisible = false;
  public isDisposed = false;

  constructor(public readonly alignment: number, public readonly priority: number) {}

  public show(): void {
    this.isVisible = true;
  }

  public hide(): void {
    this.isVisible = false;
  }

  public dispose(): void {
    this.isDisposed = true;
  }
}

let createdStatusBarItem: MockStatusBarItem | null = null;

const mockVscode = {
  StatusBarAlignment: { Left: 1, Right: 2 },
  ThemeColor: class {
    constructor(public readonly id: string) {}
  },
  window: {
    createStatusBarItem: (alignment: number, priority: number) => {
      createdStatusBarItem = new MockStatusBarItem(alignment, priority);
      return createdStatusBarItem;
    }
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

const originalRequire = Module.prototype.require;
Module.prototype.require = function (path: string) {
  if (path === 'vscode') {
    return mockVscode;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return originalRequire.apply(this, arguments as any);
};

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { JwtStatusBarItem } = require('../../src/vscode/statusBar');

test('JwtStatusBarItem initializes with active shield icon and right alignment', () => {
  currentConfig.enabled = true;
  currentConfig.showStatusBarItem = true;

  const statusBar = new JwtStatusBarItem();
  assert.ok(createdStatusBarItem);
  assert.equal(createdStatusBarItem.alignment, 2);
  assert.equal(createdStatusBarItem.command, 'jwtGlance.toggleEnabled');
  assert.equal(createdStatusBarItem.text, '$(jwt-glance)');
  assert.ok(createdStatusBarItem.tooltip.includes('active'));
  assert.equal(createdStatusBarItem.isVisible, true);

  statusBar.dispose();
  assert.equal(createdStatusBarItem.isDisposed, true);
});

test('JwtStatusBarItem reflects paused state when enabled is false', () => {
  currentConfig.enabled = false;
  currentConfig.showStatusBarItem = true;

  const statusBar = new JwtStatusBarItem();
  assert.ok(createdStatusBarItem);
  assert.equal(createdStatusBarItem.text, '$(jwt-glance-paused)');
  assert.ok(createdStatusBarItem.tooltip.includes('paused'));
  assert.equal(createdStatusBarItem.backgroundColor, undefined);
  assert.equal(createdStatusBarItem.isVisible, true);

  statusBar.dispose();
  });

test('JwtStatusBarItem is hidden when showStatusBarItem is false', () => {
  currentConfig.enabled = true;
  currentConfig.showStatusBarItem = false;

  const statusBar = new JwtStatusBarItem();
  assert.ok(createdStatusBarItem);
  assert.equal(createdStatusBarItem.isVisible, false);

  // Re-enable and update
  currentConfig.showStatusBarItem = true;
  statusBar.update();
  assert.equal(createdStatusBarItem.isVisible, true);
  assert.equal(createdStatusBarItem.text, '$(jwt-glance)');

  statusBar.dispose();
});

test('configuration changes dynamically update status bar item state post-activation', () => {
  currentConfig.enabled = true;
  currentConfig.showStatusBarItem = true;

  const statusBar = new JwtStatusBarItem();
  assert.ok(createdStatusBarItem);
  assert.equal(createdStatusBarItem.text, '$(jwt-glance)');
  assert.equal(createdStatusBarItem.isVisible, true);

  // User pauses inspection via config/command
  currentConfig.enabled = false;
  statusBar.update();
  assert.equal(createdStatusBarItem.text, '$(jwt-glance-paused)');
  assert.equal(createdStatusBarItem.isVisible, true);

  // User hides status bar item via config
  currentConfig.showStatusBarItem = false;
  statusBar.update();
  assert.equal(createdStatusBarItem.isVisible, false);

  // User re-enables both
  currentConfig.enabled = true;
  currentConfig.showStatusBarItem = true;
  statusBar.update();
  assert.equal(createdStatusBarItem.text, '$(jwt-glance)');
  assert.equal(createdStatusBarItem.isVisible, true);

  statusBar.dispose();
});
