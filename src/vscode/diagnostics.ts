import * as vscode from 'vscode';
import {
  assessToken,
  matchesGlob,
  evaluatePolicy,
  normalizePolicy,
  type JwtWorkspacePolicy
} from '../core/index';
import { DocumentTokenIndex } from './tokenIndex';
import { isDocumentEligible } from './filter';
import { getJwtGlanceSetting } from './configHelper';

export function shouldApplyPolicyToFile(
  filePath: string,
  policy: JwtWorkspacePolicy
): boolean {
  const norm = normalizePolicy(policy);
  if (!norm.files || norm.files.length === 0) {
    return false;
  }
  return norm.files.some(glob => matchesGlob(glob, filePath));
}

export class JwtDiagnosticsProvider {
  private readonly collection: vscode.DiagnosticCollection;

  constructor(
    private readonly tokenIndex: DocumentTokenIndex,
    context: { subscriptions: vscode.Disposable[] }
  ) {
    this.collection = vscode.languages.createDiagnosticCollection('jwtGlance');
    context.subscriptions.push(this.collection);
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    if (!document || !document.uri || !isDocumentEligible(document)) {
      if (document && document.uri) {
        this.collection.delete(document.uri);
      }
      return;
    }

    const policies = getJwtGlanceSetting<JwtWorkspacePolicy[]>('policies', []);
    if (!policies || policies.length === 0) {
      this.collection.delete(document.uri);
      return;
    }

    const filePath = document.uri.fsPath || document.uri.path || document.uri.toString();
    const applicablePolicies = policies.filter(p =>
      shouldApplyPolicyToFile(filePath, p)
    );
    if (applicablePolicies.length === 0) {
      this.collection.delete(document.uri);
      return;
    }

    const cachedTokens = this.tokenIndex.getTokens(document);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const diagnostics: vscode.Diagnostic[] = [];

    for (const cached of cachedTokens) {
      const assessment = assessToken(cached.raw, nowEpoch);
      if (!assessment.recognized) continue;

      const range = new vscode.Range(
        cached.lineNum,
        cached.startIndex,
        cached.lineNum,
        cached.endIndex
      );

      for (const policy of applicablePolicies) {
        const results = evaluatePolicy(assessment, policy, nowEpoch);
        for (const res of results) {
          const severity =
            res.severity === 'error'
              ? vscode.DiagnosticSeverity.Error
              : res.severity === 'info'
              ? vscode.DiagnosticSeverity.Information
              : vscode.DiagnosticSeverity.Warning;

          const diag = new vscode.Diagnostic(
            range,
            `JWT Glance [${policy.name ?? 'Policy'}]: ${res.message}`,
            severity
          );
          diag.code = res.code;
          diag.source = 'JWT Glance';
          diagnostics.push(diag);
        }
      }
    }

    this.collection.set(document.uri, diagnostics);
  }

  public updateAllOpenDocuments(): void {
    for (const doc of vscode.workspace.textDocuments) {
      this.updateDiagnostics(doc);
    }
  }

  public clear(uri: vscode.Uri): void {
    this.collection.delete(uri);
  }

  public dispose(): void {
    this.collection.dispose();
  }
}
