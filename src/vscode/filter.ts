import * as vscode from 'vscode';
import { isEligible, FilterConfig } from '../core/index';
import { getJwtGlanceSetting } from './configHelper';

export * from '../core/filter';

export function isDocumentEligible(document: vscode.TextDocument): boolean {
  if (!document || !document.uri) {
    return false;
  }

  const config: FilterConfig = {
    enabled: getJwtGlanceSetting<boolean>('enabled', true),
    languages: getJwtGlanceSetting<string[]>('languages', ['*']),
    maxDocumentCharacters: getJwtGlanceSetting<number>('maxDocumentCharacters', 524288),
    exclude: getJwtGlanceSetting<string[]>('exclude', [
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/*.min.*',
      '**/*.map'
    ])
  };

  const path = document.uri.fsPath || document.uri.path || document.uri.toString();
  const lastLine = Math.max(0, document.lineCount - 1);
  const charCount = document.lineCount > 0
    ? document.offsetAt(new vscode.Position(lastLine, document.lineAt(lastLine).text.length))
    : 0;
  return isEligible(path, document.languageId, charCount, config);
}
