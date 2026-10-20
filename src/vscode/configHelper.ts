import type * as vscodeTypes from 'vscode';

/**
 * Retrieves a configuration setting under the 'jwtGlance' namespace.
 * Seamlessly resolves from:
 * 1. Scoped configuration: vscode.workspace.getConfiguration('jwtGlance').get(key)
 * 2. Root single object: vscode.workspace.getConfiguration().get('jwtGlance')[key]
 * 3. Legacy flat setting: vscode.workspace.getConfiguration().get('jwtGlance.' + key)
 * 4. Fallback default value
 */
export function getJwtGlanceSetting<T>(
  key: string,
  defaultValue: T,
  vscodeRef: typeof import('vscode') = require('vscode')
): T {
  try {
    // 1. Check scoped configuration (vscode.workspace.getConfiguration('jwtGlance'))
    const scoped = vscodeRef.workspace.getConfiguration('jwtGlance');
    const scopedVal = scoped.get<T>(key);
    if (scopedVal !== undefined) {
      return scopedVal;
    }

    // 2. Check root single object (settings.json with "jwtGlance": { ... })
    const root = vscodeRef.workspace.getConfiguration();
    const obj = root.get<Record<string, unknown>>('jwtGlance');
    if (obj && typeof obj === 'object' && !Array.isArray(obj) && key in obj) {
      const val = obj[key] as T;
      if (val !== undefined) {
        return val;
      }
    }

    // 3. Check legacy flat key (settings.json with "jwtGlance.key": ...)
    const flatVal = root.get<T>(`jwtGlance.${key}`);
    if (flatVal !== undefined) {
      return flatVal;
    }
  } catch {
    // Fall back to default if vscodeRef is not fully initialized
  }

  return defaultValue;
}

export const DEFAULT_GLANCE_CLAIMS = ['roles', 'name', 'email', 'sub'];

/**
 * Normalized helper to extract configured glance claims as a non-empty string array.
 */
export function getGlanceClaims(
  vscodeRef: typeof import('vscode') = require('vscode')
): string[] {
  const raw = getJwtGlanceSetting<string | string[]>('glanceClaims', DEFAULT_GLANCE_CLAIMS, vscodeRef);
  if (Array.isArray(raw)) {
    const filtered = raw.filter((c) => typeof c === 'string' && c.trim().length > 0);
    return filtered.length > 0 ? filtered : DEFAULT_GLANCE_CLAIMS;
  }
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return [raw.trim()];
  }
  return DEFAULT_GLANCE_CLAIMS;
}

/**
 * Updates a setting within the single "jwtGlance": { ... } object in configuration.
 */
export async function updateJwtGlanceSetting(
  key: string,
  value: unknown,
  target: vscodeTypes.ConfigurationTarget = 1 as vscodeTypes.ConfigurationTarget, // Global
  vscodeRef: typeof import('vscode') = require('vscode')
): Promise<void> {
  const root = vscodeRef.workspace.getConfiguration();
  const currentObj = root.get<Record<string, unknown>>('jwtGlance');
  const baseObj =
    currentObj && typeof currentObj === 'object' && !Array.isArray(currentObj)
      ? { ...currentObj }
      : {};

  baseObj[key] = value;
  await root.update('jwtGlance', baseObj, target);
}
