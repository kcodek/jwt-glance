import * as vscode from 'vscode';
import { assessToken } from '../core/index';
import { formatCodeLensLabel } from './badgeFormatter';
import { isDocumentEligible } from './filter';
import { DocumentTokenIndex } from './tokenIndex';
import { getJwtGlanceSetting, getGlanceClaims } from './configHelper';

export class JwtCodeLensProvider implements vscode.CodeLensProvider {
  private readonly _onDidChangeCodeLenses = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses = this._onDidChangeCodeLenses.event;
  private readonly tokenIndex: DocumentTokenIndex;

  constructor(tokenIndex?: DocumentTokenIndex) {
    this.tokenIndex = tokenIndex ?? new DocumentTokenIndex();
  }

  public refresh(): void {
    this._onDidChangeCodeLenses.fire();
  }

  public provideCodeLenses(
    document: vscode.TextDocument,
    _token: vscode.CancellationToken
  ): vscode.CodeLens[] {
    const position = getJwtGlanceSetting<string>('position', 'top');

    if ((position !== 'top' && position !== 'both') || !isDocumentEligible(document)) {
      return [];
    }

    const expiringSoonThreshold = getJwtGlanceSetting('expiringSoonThreshold', 1800);
    const glanceClaims = getGlanceClaims();
    const maxGlanceClaims = getJwtGlanceSetting<number>('maxGlanceClaims', 3);
    const codeLenses: vscode.CodeLens[] = [];
    const nowEpoch = Math.floor(Date.now() / 1000);

    const cachedTokens = this.tokenIndex.getTokens(document);
    for (const cached of cachedTokens) {
      if (_token.isCancellationRequested) {
        return [];
      }
      const assessment = assessToken(cached.raw, nowEpoch);

      if (assessment.recognized) {
        const range = new vscode.Range(
          cached.lineNum,
          cached.startIndex,
          cached.lineNum,
          cached.endIndex
        );

        const badgeTitle = formatCodeLensLabel(assessment, expiringSoonThreshold, glanceClaims, maxGlanceClaims);
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: badgeTitle,
            command: 'jwtGlance.inspectToken',
            arguments: [document.uri, range, cached.raw],
            tooltip: 'Click to inspect claims or copy payload'
          })
        );
      }
    }

    return codeLenses;
  }
}
