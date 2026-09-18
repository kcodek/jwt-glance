import * as vscode from 'vscode';
import { findCandidateTokens, assessToken, parseJwt } from '../core/index';
import { formatHoverContent } from './hoverFormatter';
import { isDocumentEligible } from './filter';

export class JwtHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (!isDocumentEligible(document)) {
      return null;
    }

    const config = vscode.workspace.getConfiguration('jwtGlance');
    const line = document.lineAt(position.line);
    const maxLineLength = config.get<number>('maxLineLength', 10000);
    if (line.text.length > maxLineLength) {
      return null;
    }

    const candidates = findCandidateTokens(line.text);
    const char = position.character;

    for (const candidate of candidates) {
      if (char >= candidate.startIndex && char < candidate.endIndex) {
        const nowEpoch = Math.floor(Date.now() / 1000);
        const assessment = assessToken(candidate.raw, nowEpoch);
        if (!assessment.recognized) {
          continue;
        }

        let payload: Record<string, unknown> | undefined;
        const parsed = parseJwt(candidate.raw);
        if (!('reason' in parsed)) {
          payload = parsed.payload;
        }

        const mdContent = formatHoverContent(assessment, payload);
        const mdString = new vscode.MarkdownString(mdContent);
        mdString.isTrusted = false;

        const range = new vscode.Range(
          position.line,
          candidate.startIndex,
          position.line,
          candidate.endIndex
        );

        return new vscode.Hover(mdString, range);
      }
    }

    return null;
  }
}
