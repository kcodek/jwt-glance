import * as vscode from 'vscode';

function matchesGlob(pattern: string, filePath: string): boolean {
  // Convert standard glob (*, **, ?) to regex
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '.*')
    .replace(/(?<!\.)\*/g, '[^/]*')
    .replace(/\?/g, '.');
  try {
    const regex = new RegExp(`(^|/)${regexStr}($|/)`);
    return regex.test(filePath);
  } catch {
    return false;
  }
}

export function isDocumentEligible(document: vscode.TextDocument): boolean {
  if (!document || !document.uri) {
    return false;
  }

  const config = vscode.workspace.getConfiguration('jwtGlance');
  const isEnabled = config.get<boolean>('enabled', true);
  if (!isEnabled) {
    return false;
  }

  // 1. Language check
  const languages = config.get<string[]>('languages', ['*']);
  if (Array.isArray(languages) && !languages.includes('*') && !languages.includes(document.languageId)) {
    return false;
  }

  // 2. Document file size check (default 512KB)
  const maxBytes = config.get<number>('maxDocumentBytes', 524288);
  if (typeof maxBytes === 'number' && maxBytes > 0) {
    // Fast length check (avoid scanning huge minified files)
    if (document.getText().length > maxBytes) {
      return false;
    }
  }

  // 3. Exclusions check
  const exclusions = config.get<string[]>('exclude', [
    '**/package-lock.json',
    '**/pnpm-lock.yaml',
    '**/*.min.*',
    '**/*.map'
  ]);

  if (Array.isArray(exclusions) && exclusions.length > 0) {
    const normalizedPath = document.uri.fsPath.replace(/\\/g, '/');
    for (const pattern of exclusions) {
      if (matchesGlob(pattern, normalizedPath)) {
        return false;
      }
    }
  }

  return true;
}
