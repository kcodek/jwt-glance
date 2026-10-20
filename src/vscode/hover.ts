import * as vscode from 'vscode';
import {
  findCandidateTokens,
  assessToken,
  parseJwt,
  evaluatePolicy,
  type JwtWorkspacePolicy,
  type PolicyDiagnostic
} from '../core/index';
import { formatHoverContent } from './hoverFormatter';
import { isDocumentEligible } from './filter';
import { shouldApplyPolicyToFile } from './diagnostics';
import { getJwtGlanceSetting } from './configHelper';

export class JwtHoverProvider implements vscode.HoverProvider {
  public provideHover(
    document: vscode.TextDocument,
    position: vscode.Position,
    _token: vscode.CancellationToken
  ): vscode.ProviderResult<vscode.Hover> {
    if (!isDocumentEligible(document)) {
      return null;
    }

    const line = document.lineAt(position.line);
    const maxLineLength = getJwtGlanceSetting<number>('maxLineLength', 10000);
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

        const expiringSoonThreshold = getJwtGlanceSetting<number>('expiringSoonThreshold', 1800);
        const policies = getJwtGlanceSetting<JwtWorkspacePolicy[]>('policies', []);
        let policyDiagnostics: PolicyDiagnostic[] | undefined;

        if (policies && policies.length > 0) {
          const filePath = document.uri.fsPath || document.uri.path || document.uri.toString();
          const applicable = policies.filter(p => shouldApplyPolicyToFile(filePath, p));
          if (applicable.length > 0) {
            policyDiagnostics = [];
            for (const p of applicable) {
              policyDiagnostics.push(...evaluatePolicy(assessment, p, nowEpoch));
            }
          }
        }

        const mdContent = formatHoverContent(assessment, payload, { expiringSoonThreshold, policyDiagnostics });
        const mdString = new vscode.MarkdownString(mdContent);
        mdString.isTrusted = false;
        mdString.supportThemeIcons = true;

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
