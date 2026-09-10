import * as vscode from 'vscode';
import { findCandidateTokens, assessToken, type RecognizedToken } from '../core/index';
import { expandRangeToLineBoundaries } from './lineExpander';
import { formatBadgeLabel } from './badgeFormatter';

export class JwtInlayHintsProvider implements vscode.InlayHintsProvider {
  private readonly _onDidChangeInlayHints = new vscode.EventEmitter<void>();
  public readonly onDidChangeInlayHints = this._onDidChangeInlayHints.event;

  public refresh(): void {
    this._onDidChangeInlayHints.fire();
  }

  public provideInlayHints(
    document: vscode.TextDocument,
    range: vscode.Range,
    _token: vscode.CancellationToken
  ): vscode.InlayHint[] {
    const config = vscode.workspace.getConfiguration('jwtGlance');
    const isEnabled = config.get<boolean>('enabled', true);
    if (!isEnabled) {
      return [];
    }

    const maxLineLength = config.get<number>('maxLineLength', 10000);
    const expanded = expandRangeToLineBoundaries(document, range);
    const hints: vscode.InlayHint[] = [];
    const nowEpoch = Math.floor(Date.now() / 1000);

    for (let lineNum = expanded.start.line; lineNum <= expanded.end.line; lineNum++) {
      const line = document.lineAt(lineNum);
      if (line.text.length > maxLineLength) {
        continue;
      }

      const candidates = findCandidateTokens(line.text);
      for (const candidate of candidates) {
        const assessment = assessToken(candidate.raw, nowEpoch);
        if (assessment.recognized) {
          const position = new vscode.Position(lineNum, candidate.startIndex);
          const badgeText = `[${formatBadgeLabel(assessment)}]`;
          
          const labelPart = new vscode.InlayHintLabelPart(badgeText);
          labelPart.command = {
            title: badgeText,
            command: 'jwtGlance.inspectToken',
            arguments: [
              document.uri,
              new vscode.Range(lineNum, candidate.startIndex, lineNum, candidate.endIndex),
              candidate.raw
            ]
          };

          const hint = new vscode.InlayHint(position, [labelPart], vscode.InlayHintKind.Type);
          hint.paddingRight = true;
          hint.tooltip = this.createTooltip(assessment);
          hints.push(hint);
        }
      }
    }

    return hints;
  }

  private createTooltip(token: RecognizedToken): vscode.MarkdownString {
    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = false;
    tooltip.appendMarkdown(`**JWT Glance Assessment**\n\n`);
    tooltip.appendMarkdown(`- **Algorithm:** \`${token.algorithm}\`${token.isUnsecured ? ' *(UNSECURED)*' : ''}\n`);
    tooltip.appendMarkdown(`- **Status:** \`${token.temporalStatus}\`\n`);
    if (token.expiresAtIso) {
      tooltip.appendMarkdown(`- **Expires:** ${token.expiresAtIso}\n`);
    }
    if (token.issuer) {
      tooltip.appendMarkdown(`- **Issuer:** \`${token.issuer}\`\n`);
    }
    tooltip.appendMarkdown(`\n*Hover token for full decoded claims.*`);
    return tooltip;
  }
}
