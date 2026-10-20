import * as vscode from 'vscode';
import { parseJwt } from '../core/index';
import {
  resolveTokenAtPosition,
  resolveTokenFromText
} from './commandHelpers';
import {
  getGlanceClaims,
  updateJwtGlanceSetting
} from './configHelper';

export interface DiscoveredClaim {
  path: string;
  value: string;
}

export const STANDARD_CLAIM_PRESETS = [
  'sub',
  'email',
  'preferred_username',
  'name',
  'roles',
  'upn'
];

/**
 * Recursively inspects a JWT payload and discovers all scalar and string-array
 * claim paths (including nested dot-notation like user.profile.email).
 */
export function discoverClaimsFromPayload(
  payload?: Record<string, unknown>,
  maxDepth = 3
): DiscoveredClaim[] {
  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const results: DiscoveredClaim[] = [];

  function walk(current: unknown, currentPath: string, depth: number) {
    if (!current || depth > maxDepth) return;

    if (typeof current === 'object' && !Array.isArray(current)) {
      for (const [key, val] of Object.entries(current as Record<string, unknown>)) {
        if (key.startsWith('_')) continue;
        const nextPath = currentPath ? `${currentPath}.${key}` : key;

        if (val === null || val === undefined) {
          continue;
        } else if (
          typeof val === 'string' ||
          typeof val === 'number' ||
          typeof val === 'boolean'
        ) {
          results.push({ path: nextPath, value: String(val) });
        } else if (Array.isArray(val)) {
          const preview = val
            .filter((x) => typeof x === 'string' || typeof x === 'number')
            .join(', ');
          if (preview) {
            results.push({ path: nextPath, value: preview });
          }
        } else if (typeof val === 'object' && depth < maxDepth) {
          walk(val, nextPath, depth + 1);
        }
      }
    }
  }

  walk(payload, '', 1);
  return results;
}

/**
 * Inserts a claim into the priority list without duplicates.
 * If the list ends with 'sub' (acting as fallback), the new claim is inserted
 * immediately before 'sub' to preserve fallback behavior.
 */
export function insertClaimIntoPriorities(priorities: string[], claim: string): void {
  if (priorities.includes(claim)) return;
  const lastIdx = priorities.length - 1;
  if (lastIdx >= 0 && priorities[lastIdx] === 'sub') {
    priorities.splice(lastIdx, 0, claim);
  } else {
    priorities.push(claim);
  }
}

interface PriorityQuickPickItem extends vscode.QuickPickItem {
  type: 'active-claim' | 'add-claim' | 'custom' | 'save' | 'reset' | 'toggle-fallback';
  claimKey?: string;
  index?: number;
}

/**
 * Interactive QuickPick editor for managing and reordering glanceClaims priority.
 * Supports adding, moving up/down, removing fallback claims, and nested claim discovery.
 */
export async function manageGlanceClaimPriorities(
  rawTokenArg?: string,
  vscodeRef: typeof import('vscode') = vscode
): Promise<string[] | undefined> {
  let candidate = rawTokenArg;
  const now = Math.floor(Date.now() / 1000);

  if (!candidate) {
    const editor = vscodeRef.window.activeTextEditor;
    if (editor) {
      const selection = editor.selection;
      if (!selection.isEmpty) {
        const selectedText = editor.document.getText(selection).trim();
        const resolved = resolveTokenFromText(selectedText, now);
        if (resolved) {
          candidate = resolved.raw;
        }
      }

      if (!candidate) {
        const line = editor.document.lineAt(selection.active.line);
        const target = resolveTokenAtPosition(line.text, selection.active.character);
        if (target) {
          candidate = target.raw;
        }
      }
    }
  }

  let priorities = [...getGlanceClaims(vscodeRef)];

  if (priorities.length === 0) {
    priorities = ['sub'];
  }

  // Discover claims from candidate token (if any)
  const discoveredMap = new Map<string, string>();
  if (candidate) {
    const parsed = parseJwt(candidate);
    if (!('reason' in parsed) && parsed.payload && typeof parsed.payload === 'object') {
      const discovered = discoverClaimsFromPayload(parsed.payload as Record<string, unknown>);
      for (const d of discovered) {
        discoveredMap.set(d.path, d.value);
      }
    }
  }

  const moveUpBtn: vscode.QuickInputButton = {
    iconPath: new vscodeRef.ThemeIcon('arrow-up'),
    tooltip: 'Move up (higher priority)'
  };
  const moveDownBtn: vscode.QuickInputButton = {
    iconPath: new vscodeRef.ThemeIcon('arrow-down'),
    tooltip: 'Move down (lower priority)'
  };
  const removeBtn: vscode.QuickInputButton = {
    iconPath: new vscodeRef.ThemeIcon('close'),
    tooltip: 'Remove from priority list'
  };
  const applyBtn: vscode.QuickInputButton = {
    iconPath: new vscodeRef.ThemeIcon('check'),
    tooltip: 'Save & Apply Priority'
  };

  if (typeof vscodeRef.window.createQuickPick !== 'function') {
    const fallbackItems: Array<vscode.QuickPickItem & { claimKey?: string; isFallbackToggle?: boolean }> = [];

    // Current priorities
    fallbackItems.push({
      label: `Current Priority: [${priorities.join(' → ')}]`,
      kind: vscodeRef.QuickPickItemKind.Separator
    });
    for (const p of priorities) {
      fallbackItems.push({
        label: `$(check) ${p}`,
        description: 'Currently configured in priority list',
        claimKey: p
      });
    }

    // Available to add
    fallbackItems.push({
      label: 'Add to Priority List',
      kind: vscodeRef.QuickPickItemKind.Separator
    });
    for (const [path, val] of discoveredMap.entries()) {
      if (!priorities.includes(path)) {
        fallbackItems.push({
          label: `$(add) ${path}`,
          description: `"${val}"`,
          claimKey: path
        });
      }
    }
    for (const preset of STANDARD_CLAIM_PRESETS) {
      if (!priorities.includes(preset) && !discoveredMap.has(preset)) {
        fallbackItems.push({
          label: `$(add) ${preset}`,
          description: 'Standard preset',
          claimKey: preset
        });
      }
    }

    const isSubPinnedFallback = priorities.length > 1 && priorities[priorities.length - 1] === 'sub';
    if (priorities.length > 1 || (priorities.length === 1 && priorities[0] !== 'sub')) {
      fallbackItems.push({
        label: isSubPinnedFallback ? '$(shield) Disable "sub" Fallback' : '$(shield) Enable "sub" Fallback',
        description: isSubPinnedFallback
          ? 'Strict mode: badges will not display subject if configured claims are absent'
          : 'Appends "sub" fallback to the end of claim priorities',
        isFallbackToggle: true
      });
    }

    const selected = await vscodeRef.window.showQuickPick(fallbackItems, {
      title: 'JWT Glance: Claim Priority Editor',
      placeHolder: `Current: [${priorities.join(' → ')}]`
    });

    if (!selected) {
      return undefined;
    }

    if (selected.isFallbackToggle) {
      if (isSubPinnedFallback) {
        priorities.pop();
      } else {
        const subIdx = priorities.indexOf('sub');
        if (subIdx !== -1) {
          priorities.splice(subIdx, 1);
        }
        priorities.push('sub');
      }
    } else if (selected.claimKey) {
      insertClaimIntoPriorities(priorities, selected.claimKey);
    }

    const finalPriorities = priorities.length > 0 ? priorities : ['sub'];
    await updateJwtGlanceSetting('glanceClaims', finalPriorities, vscodeRef.ConfigurationTarget.Global, vscodeRef);
    return finalPriorities;
  }

  return new Promise<string[] | undefined>((resolve) => {
    let isSaved = false;
    const qp = vscodeRef.window.createQuickPick<PriorityQuickPickItem>();
    qp.title = 'JWT Glance: Claim Priority Editor';
    qp.placeholder = 'Use [↑]/[↓] to reorder, [×] to remove. Click an available claim below to add.';
    qp.buttons = [applyBtn];

    const refreshItems = () => {
      const items: PriorityQuickPickItem[] = [];
      const isSubPinnedFallback = priorities.length > 1 && priorities[priorities.length - 1] === 'sub';

      // 1. Current Active Priority
      items.push({
        label: `Active Priority (${priorities.join(' → ') || 'None'})`,
        kind: vscodeRef.QuickPickItemKind.Separator,
        type: 'active-claim'
      });

      if (priorities.length === 0) {
        items.push({
          label: '$(alert) No claims configured',
          description: 'Click an available claim below or reset to add',
          type: 'active-claim'
        });
      } else {
        priorities.forEach((claim, idx) => {
          const itemButtons: vscode.QuickInputButton[] = [];
          const isThisPinnedFallback = isSubPinnedFallback && idx === priorities.length - 1;

          if (isThisPinnedFallback) {
            // Pinned fallback claim at final position: cannot be moved up past preceding claims
            itemButtons.push(removeBtn);
          } else {
            if (idx > 0) itemButtons.push(moveUpBtn);
            if (idx < priorities.length - 1 && !(isSubPinnedFallback && idx === priorities.length - 2)) {
              itemButtons.push(moveDownBtn);
            }
            itemButtons.push(removeBtn);
          }

          const tokenVal = discoveredMap.get(claim);

          items.push({
            label: isThisPinnedFallback ? `$(shield) ${idx + 1}. ${claim}` : `$(list-ordered) ${idx + 1}. ${claim}`,
            description: tokenVal
              ? `"${tokenVal}"`
              : isThisPinnedFallback
              ? 'Subject (Fallback: pinned to end)'
              : claim === 'sub'
              ? 'Subject'
              : undefined,
            detail: idx === 0
              ? 'Primary: displayed first if present'
              : `Fallback #${idx}: displayed if previous claims missing`,
            buttons: itemButtons,
            type: 'active-claim',
            claimKey: claim,
            index: idx
          });
        });
      }

      // 2. Available Claims to Add
      items.push({
        label: 'Add to Priority List',
        kind: vscodeRef.QuickPickItemKind.Separator,
        type: 'add-claim'
      });

      // Claims from active token not yet in priorities
      for (const [path, val] of discoveredMap.entries()) {
        if (!priorities.includes(path)) {
          items.push({
            label: `$(add) ${path}`,
            description: `"${val}" (from active token)`,
            type: 'add-claim',
            claimKey: path
          });
        }
      }

      // Presets not yet in priorities or active token
      for (const preset of STANDARD_CLAIM_PRESETS) {
        if (!priorities.includes(preset) && !discoveredMap.has(preset)) {
          items.push({
            label: `$(add) ${preset}`,
            description: preset === 'sub' ? 'Subject' : preset === 'roles' ? 'Roles array/string' : 'Standard preset',
            type: 'add-claim',
            claimKey: preset
          });
        }
      }

      // 3. Custom Claim Entry
      items.push({
        label: 'Custom Claim',
        kind: vscodeRef.QuickPickItemKind.Separator,
        type: 'custom'
      });
      items.push({
        label: '$(edit) Add Custom Claim Path...',
        description: 'Enter any custom or dot-notated claim (e.g. user.profile.email)',
        type: 'custom'
      });

      // 4. Fallback Toggle & Actions
      items.push({
        label: 'Settings & Actions',
        kind: vscodeRef.QuickPickItemKind.Separator,
        type: 'save'
      });

      if (priorities.length > 1 || (priorities.length === 1 && priorities[0] !== 'sub')) {
        items.push({
          label: isSubPinnedFallback ? '$(shield) Disable "sub" Fallback' : '$(shield) Enable "sub" Fallback',
          description: isSubPinnedFallback
            ? 'Strict mode: badges will not display subject if configured claims are absent'
            : 'Appends "sub" fallback to the end of claim priorities',
          type: 'toggle-fallback'
        });
      }

      items.push({
        label: `$(check) Save & Apply Priority: [${priorities.join(' → ')}]`,
        description: 'Update settings and refresh all editor badges',
        type: 'save'
      });
      items.push({
        label: '$(discard) Reset to Default [sub]',
        description: 'Reset configuration back to default subject claim',
        type: 'reset'
      });

      qp.items = items;
    };

    const saveAndClose = async () => {
      isSaved = true;
      const finalPriorities = priorities.length > 0 ? priorities : ['sub'];
      await updateJwtGlanceSetting('glanceClaims', finalPriorities, vscodeRef.ConfigurationTarget.Global, vscodeRef);
      vscodeRef.window.showInformationMessage(
        `JWT Glance: Updated badge claim priority: [${finalPriorities.join(' → ')}].`
      );
      qp.hide();
      qp.dispose();
      resolve(finalPriorities);
    };

    qp.onDidTriggerButton(async (btn) => {
      if (btn === applyBtn) {
        await saveAndClose();
      }
    });

    qp.onDidTriggerItemButton(async (e) => {
      const idx = e.item.index;
      if (idx === undefined) return;

      const isSubPinnedFallback = priorities.length > 1 && priorities[priorities.length - 1] === 'sub';

      if (e.button === moveUpBtn && idx > 0) {
        if (isSubPinnedFallback && idx === priorities.length - 1) return;
        const temp = priorities[idx];
        const prev = priorities[idx - 1];
        if (temp !== undefined && prev !== undefined) {
          priorities[idx] = prev;
          priorities[idx - 1] = temp;
          refreshItems();
        }
      } else if (e.button === moveDownBtn && idx < priorities.length - 1) {
        if (isSubPinnedFallback && idx === priorities.length - 2) return;
        const temp = priorities[idx];
        const next = priorities[idx + 1];
        if (temp !== undefined && next !== undefined) {
          priorities[idx] = next;
          priorities[idx + 1] = temp;
          refreshItems();
        }
      } else if (e.button === removeBtn) {
        priorities.splice(idx, 1);
        refreshItems();
      }
    });

    qp.onDidAccept(async () => {
      const selected = qp.selectedItems[0];
      if (!selected) return;

      const isSubPinnedFallback = priorities.length > 1 && priorities[priorities.length - 1] === 'sub';

      if (selected.type === 'save') {
        await saveAndClose();
      } else if (selected.type === 'toggle-fallback') {
        if (isSubPinnedFallback) {
          priorities.pop();
        } else {
          const subIndex = priorities.indexOf('sub');
          if (subIndex !== -1) {
            priorities.splice(subIndex, 1);
          }
          priorities.push('sub');
        }
        refreshItems();
      } else if (selected.type === 'reset') {
        priorities = ['sub'];
        refreshItems();
      } else if (selected.type === 'add-claim' && selected.claimKey) {
        insertClaimIntoPriorities(priorities, selected.claimKey);
        refreshItems();
      } else if (selected.type === 'custom') {
        const input = await vscodeRef.window.showInputBox({
          title: 'JWT Glance: Add Custom Claim Path',
          prompt: 'Enter claim key or nested dot path (e.g. user.email, tenant_id)',
          placeHolder: 'user.email',
          validateInput: (val) => {
            const trimmed = val.trim();
            if (!trimmed) return 'Claim path cannot be empty';
            if (trimmed.includes(' ')) return 'Claim path cannot contain spaces';
            return null;
          }
        });
        if (input && input.trim()) {
          const trimmed = input.trim();
          insertClaimIntoPriorities(priorities, trimmed);
          refreshItems();
        }
      } else if (selected.type === 'active-claim' && selected.index !== undefined) {
        const i = selected.index;
        const isThisPinnedFallback = isSubPinnedFallback && i === priorities.length - 1;
        const reorderActions: Array<{ label: string; action: string }> = [];
        if (!isThisPinnedFallback) {
          if (i > 0) {
            reorderActions.push({ label: '$(arrow-up) Move to Top', action: 'top' });
            reorderActions.push({ label: '$(arrow-up) Move Up', action: 'up' });
          }
          if (i < priorities.length - 1 && !(isSubPinnedFallback && i === priorities.length - 2)) {
            reorderActions.push({ label: '$(arrow-down) Move Down', action: 'down' });
          }
        }
        reorderActions.push({ label: '$(trash) Remove', action: 'remove' });

        const choice = await vscodeRef.window.showQuickPick(
          reorderActions,
          { placeHolder: `Manage '${selected.claimKey}'` }
        );
        if (choice) {
          if (choice.action === 'top' && i > 0 && !isThisPinnedFallback) {
            const item = priorities.splice(i, 1)[0];
            if (item !== undefined) {
              priorities.unshift(item);
            }
          } else if (choice.action === 'up' && i > 0 && !isThisPinnedFallback) {
            const curr = priorities[i];
            const prev = priorities[i - 1];
            if (curr !== undefined && prev !== undefined) {
              priorities[i] = prev;
              priorities[i - 1] = curr;
            }
          } else if (choice.action === 'down' && i < priorities.length - 1 && !(isSubPinnedFallback && i === priorities.length - 2)) {
            const curr = priorities[i];
            const next = priorities[i + 1];
            if (curr !== undefined && next !== undefined) {
              priorities[i] = next;
              priorities[i + 1] = curr;
            }
          } else if (choice.action === 'remove') {
            priorities.splice(i, 1);
          }
          refreshItems();
        }
      }
    });

    qp.onDidHide(() => {
      qp.dispose();
      if (!isSaved) {
        resolve(undefined);
      }
    });

    refreshItems();
    qp.show();
  });
}
