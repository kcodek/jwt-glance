import * as vscode from 'vscode';
import { findCandidateTokens, assessToken } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import { isDocumentEligible } from './filter';

export class JwtCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const config = vscode.workspace.getConfiguration('jwtGlance');
    const position = config.get<string>('position', 'top');

    if (position !== 'top' || !isDocumentEligible(document)) {
      return [];
    }

    const maxLineLength = config.get<number>('maxLineLength', 10000);
    const codeLenses: vscode.CodeLens[] = [];
    const nowEpoch = Math.floor(Date.now() / 1000);

    const lineCount = document.lineCount;
    for (let lineNum = 0; lineNum < lineCount; lineNum++) {
      if (_token.isCancellationRequested) {
        return [];
      }

      const line = document.lineAt(lineNum);
      if (line.text.length > maxLineLength) {
        continue;
      }

      const candidates = findCandidateTokens(line.text);
      for (const candidate of candidates) {
        const assessment = assessToken(candidate.raw, nowEpoch);
        if (assessment.recognized) {
          const range = new vscode.Range(
            lineNum,
            candidate.startIndex,
            lineNum,
            candidate.endIndex
          );

          const badgeTitle = `$(key) ${formatBadgeLabel(assessment)}`;
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: badgeTitle,
              command: 'jwtGlance.inspectToken',
              arguments: [document.uri, range, candidate.raw],
              tooltip: 'Click to inspect claims or copy payload'
            })
          );
        }
      }
    }

    return codeLenses;
  }
}
