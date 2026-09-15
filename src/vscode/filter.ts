import * as vscode from 'vscode';
import { isEligible, FilterConfig } from '../core/index';

export * from '../core/filter';

export function isDocumentEligible(document: vscode.TextDocument): boolean {
  if (!document || !document.uri) {
    return false;
  }

  const vsConfig = vscode.workspace.getConfiguration('jwtGlance');
  const config: FilterConfig = {
    enabled: vsConfig.get<boolean>('enabled', true),
    languages: vsConfig.get<string[]>('languages', ['*']),
    maxDocumentCharacters: vsConfig.get<number>('maxDocumentCharacters', 524288),
    exclude: vsConfig.get<string[]>('exclude', [
      '**/package-lock.json',
      '**/pnpm-lock.yaml',
      '**/*.min.*',
      '**/*.map'
    ])
  };

  const path = document.uri.fsPath || document.uri.path || document.uri.toString();
  return isEligible(path, document.languageId, document.getText().length, config);
}
