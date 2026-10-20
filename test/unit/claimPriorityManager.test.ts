import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import Module from 'node:module';

const mockVscode = {
  ThemeIcon: class {
    constructor(public readonly id: string) {}
  },
  ConfigurationTarget: {
    Global: 1
  },
  QuickPickItemKind: {
    Separator: -1
  },
  window: {
    activeTextEditor: undefined,
    createQuickPick: () => ({
      title: '',
      placeholder: '',
      buttons: [],
      items: [],
      selectedItems: [],
      show: () => {},
      hide: () => {},
      dispose: () => {},
      onDidTriggerButton: () => {},
      onDidTriggerItemButton: () => {},
      onDidAccept: () => {},
      onDidHide: () => {}
    }),
    showInformationMessage: () => {},
    showQuickPick: async () => undefined,
    showInputBox: async () => undefined
  },
  workspace: {
    getConfiguration: () => ({
      get: (_key: string, defVal: unknown) => defVal,
      update: async () => {}
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
const {
  discoverClaimsFromPayload,
  insertClaimIntoPriorities,
  manageGlanceClaimPriorities,
  STANDARD_CLAIM_PRESETS
} = require('../../src/vscode/claimPriorityManager');

test('STANDARD_CLAIM_PRESETS includes roles as a preset', () => {
  assert.ok(STANDARD_CLAIM_PRESETS.includes('roles'));
  assert.ok(STANDARD_CLAIM_PRESETS.includes('sub'));
  assert.ok(STANDARD_CLAIM_PRESETS.includes('email'));
  assert.ok(STANDARD_CLAIM_PRESETS.includes('name'));
});

test('discoverClaimsFromPayload discovers scalar, array, and nested dot-notated claims', () => {
  const payload = {
    sub: 'user-123',
    email: 'user@example.com',
    age: 30,
    active: true,
    roles: ['admin', 'developer'],
    user: {
      profile: {
        name: 'Alice Smith',
        department: 'Engineering'
      }
    },
    _internal: 'should be excluded',
    emptyObj: {}
  };

  const discovered = discoverClaimsFromPayload(payload);
  const map = new Map(discovered.map((d: { path: string; value: string }) => [d.path, d.value]));

  assert.equal(map.get('sub'), 'user-123');
  assert.equal(map.get('email'), 'user@example.com');
  assert.equal(map.get('age'), '30');
  assert.equal(map.get('active'), 'true');
  assert.equal(map.get('roles'), 'admin, developer');
  assert.equal(map.get('user.profile.name'), 'Alice Smith');
  assert.equal(map.get('user.profile.department'), 'Engineering');

  // Verify internal _ keys are excluded
  assert.ok(!map.has('_internal'));
  assert.ok(!discovered.some((d: { path: string }) => d.path.startsWith('_')));
});

test('discoverClaimsFromPayload handles null, undefined, and respects maxDepth', () => {
  assert.deepEqual(discoverClaimsFromPayload(undefined), []);
  assert.deepEqual(discoverClaimsFromPayload(null as any), []);
  assert.deepEqual(discoverClaimsFromPayload({} as any), []);

  const deeplyNested = {
    l1: {
      l2: {
        l3: {
          l4: 'too deep'
        }
      }
    }
  };

  const discovered = discoverClaimsFromPayload(deeplyNested, 2);
  assert.ok(!discovered.some((d: { path: string }) => d.path.includes('l4')));
});

test('insertClaimIntoPriorities preserves existing priorities and trailing sub fallback', () => {
  // Case 1: default ['sub'] -> inserts before 'sub'
  const p1 = ['sub'];
  insertClaimIntoPriorities(p1, 'email');
  assert.deepEqual(p1, ['email', 'sub']);

  // Case 2: existing priority list ['name', 'roles', 'sub'] -> preserves order, inserts before 'sub'
  const p2 = ['name', 'roles', 'sub'];
  insertClaimIntoPriorities(p2, 'email');
  assert.deepEqual(p2, ['name', 'roles', 'email', 'sub']);

  // Case 3: strict list without 'sub' -> appends to end
  const p3 = ['roles'];
  insertClaimIntoPriorities(p3, 'email');
  assert.deepEqual(p3, ['roles', 'email']);

  // Case 4: duplicate claim is ignored
  const p4 = ['name', 'roles', 'sub'];
  insertClaimIntoPriorities(p4, 'name');
  assert.deepEqual(p4, ['name', 'roles', 'sub']);
});

test('manageGlanceClaimPriorities preserves existing priority list and allows reordering via interactive QuickPick', async () => {
  let savedSettingVal: string[] = [];

  const mockConfig = {
    get: (_key: string, _defVal: unknown) => ['name', 'roles', 'sub'],
    update: async (_key: string, val: string[]) => {
      savedSettingVal = val;
    }
  };

  let registeredButtons: any[] = [];
  let registeredItems: any[] = [];
  let triggerButtonHandler: ((btn: any) => Promise<void>) | undefined;
  let triggerItemButtonHandler: ((e: any) => Promise<void>) | undefined;
  let acceptHandler: (() => Promise<void>) | undefined;
  let selectedItemsMock: any[] = [];

  let hideHandler: (() => void) | undefined;

  const mockQuickPick = {
    title: '',
    placeholder: '',
    set buttons(b: any[]) { registeredButtons = b; },
    get buttons() { return registeredButtons; },
    set items(i: any[]) { registeredItems = i; },
    get items() { return registeredItems; },
    get selectedItems() { return selectedItemsMock; },
    show: () => {},
    hide: () => { if (hideHandler) hideHandler(); },
    dispose: () => {},
    onDidTriggerButton: (cb: (b: any) => Promise<void>) => { triggerButtonHandler = cb; },
    onDidTriggerItemButton: (cb: (e: any) => Promise<void>) => { triggerItemButtonHandler = cb; },
    onDidAccept: (cb: () => Promise<void>) => { acceptHandler = cb; },
    onDidHide: (cb: () => void) => { hideHandler = cb; }
  };

  const customVscode = {
    ...mockVscode,
    workspace: {
      getConfiguration: () => mockConfig
    },
    window: {
      ...mockVscode.window,
      createQuickPick: () => mockQuickPick
    }
  };

  // Launch manager
  const promise = manageGlanceClaimPriorities(undefined, customVscode as any);

  // 1. Verify existing priority list is preserved in UI
  const activeItems = registeredItems.filter((i: any) => i.type === 'active-claim' && i.claimKey);
  assert.deepEqual(activeItems.map((i: any) => i.claimKey), ['name', 'roles', 'sub']);

  // Pinned 'sub' fallback at index 2 cannot be moved up past preceding claims
  const subItem = activeItems.find((i: any) => i.claimKey === 'sub');
  assert.ok(subItem);
  const subMoveUp = subItem.buttons.find((b: any) => b.tooltip?.includes('up'));
  assert.equal(subMoveUp, undefined, 'Pinned sub fallback must not have move up button');

  // 2. Trigger Move Down on 'name' (index 0)
  assert.ok(triggerItemButtonHandler);
  const moveDownBtn = activeItems[0].buttons.find((b: any) => b.tooltip?.includes('down'));
  assert.ok(moveDownBtn);
  await triggerItemButtonHandler({ item: activeItems[0], button: moveDownBtn });

  // Re-check items after move: 'roles' should now be index 0, 'name' index 1
  const reorderedItems = registeredItems.filter((i: any) => i.type === 'active-claim' && i.claimKey);
  assert.deepEqual(reorderedItems.map((i: any) => i.claimKey), ['roles', 'name', 'sub']);

  // 3. Disable 'sub' fallback via toggle
  assert.ok(acceptHandler);
  const toggleFallbackItem = registeredItems.find((i: any) => i.type === 'toggle-fallback');
  assert.ok(toggleFallbackItem);
  selectedItemsMock = [toggleFallbackItem];
  await acceptHandler();

  // Re-check items: 'sub' should now be removed from active priorities
  const strictItems = registeredItems.filter((i: any) => i.type === 'active-claim' && i.claimKey);
  assert.deepEqual(strictItems.map((i: any) => i.claimKey), ['roles', 'name']);

  // 4. Save & Apply (triggers qp.hide() which calls hideHandler, verifying save is not clobbered)
  const applyBtn = mockQuickPick.buttons[0];
  assert.ok(applyBtn);
  assert.ok(triggerButtonHandler);
  await triggerButtonHandler(applyBtn);

  const result = await promise;
  assert.deepEqual(result, ['roles', 'name']);
  assert.deepEqual(savedSettingVal, { glanceClaims: ['roles', 'name'] });
});

test('manageGlanceClaimPriorities resolves with undefined when QuickPick is dismissed without saving', async () => {
  let hideHandler: (() => void) | undefined;
  const mockConfig = {
    get: (_key: string, _defVal: unknown) => ['roles', 'sub'],
    update: async () => {}
  };

  const mockQuickPick = {
    title: '',
    placeholder: '',
    set buttons(_b: any[]) {},
    get buttons() { return []; },
    set items(_i: any[]) {},
    get items() { return []; },
    get selectedItems() { return []; },
    show: () => {},
    hide: () => { if (hideHandler) hideHandler(); },
    dispose: () => {},
    onDidTriggerButton: () => {},
    onDidTriggerItemButton: () => {},
    onDidAccept: () => {},
    onDidHide: (cb: () => void) => { hideHandler = cb; }
  };

  const customVscode = {
    ...mockVscode,
    workspace: {
      getConfiguration: () => mockConfig
    },
    window: {
      ...mockVscode.window,
      createQuickPick: () => mockQuickPick
    }
  };

  const promise = manageGlanceClaimPriorities(undefined, customVscode as any);
  mockQuickPick.hide();
  const result = await promise;
  assert.equal(result, undefined);
});
