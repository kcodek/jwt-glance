import * as vscode from 'vscode';
import { findCandidateTokens, assessToken, parseJwt } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import { formatHoverContent } from './hoverFormatter';
import { isDocumentEligible } from './filter';

export class JwtDecorationProvider {
  private readonly decorationType: vscode.TextEditorDecorationType;

  constructor() {
    this.decorationType = vscode.window.createTextEditorDecorationType({
      before: {
        color: new vscode.ThemeColor('editorInlayHint.foreground'),
        backgroundColor: new vscode.ThemeColor('editorInlayHint.background'),
        margin: '0 6px 0 0'
      }
    });
  }

  public updateDecorations(editor?: vscode.TextEditor): void {
    if (!editor || !editor.document) {
      return;
    }

    const config = vscode.workspace.getConfiguration('jwtGlance');
    const position = config.get<string>('position', 'top');
    const document = editor.document;

    if (position === 'top' || !isDocumentEligible(document)) {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const maxLineLength = config.get<number>('maxLineLength', 10000);
    const nowEpoch = Math.floor(Date.now() / 1000);
    const decorations: vscode.DecorationOptions[] = [];

    // Scan only visible ranges (plus 10 lines padding buffer) for high performance
    const ranges = editor.visibleRanges && editor.visibleRanges.length > 0
      ? editor.visibleRanges
      : [new vscode.Range(0, 0, Math.min(document.lineCount - 1, 100), 0)];

    const linesToScan = new Set<number>();
    for (const r of ranges) {
      const startLine = Math.max(0, r.start.line - 10);
      const endLine = Math.min(document.lineCount - 1, r.end.line + 10);
      for (let l = startLine; l <= endLine; l++) {
        linesToScan.add(l);
      }
    }

    for (const lineNum of linesToScan) {
      const line = document.lineAt(lineNum);
      if (line.text.length > maxLineLength) {
        continue;
      }

      const candidates = findCandidateTokens(line.text);
      for (const candidate of candidates) {
        const assessment = assessToken(candidate.raw, nowEpoch);
        if (assessment.recognized) {
          const badgeText = `[${formatBadgeLabel(assessment)}]`;
          const range = new vscode.Range(
            lineNum,
            candidate.startIndex,
            lineNum,
            candidate.endIndex
          );

          let payload: Record<string, unknown> | undefined;
          const parsed = parseJwt(candidate.raw);
          if (!('reason' in parsed)) {
            payload = parsed.payload;
          }

          const hoverMd = new vscode.MarkdownString(formatHoverContent(assessment, payload));
          hoverMd.isTrusted = false;

          decorations.push({
            range,
            hoverMessage: hoverMd,
            renderOptions: {
              before: {
                contentText: ` ${badgeText} `,
                color: new vscode.ThemeColor('editorInlayHint.foreground'),
                backgroundColor: new vscode.ThemeColor('editorInlayHint.background'),
                margin: '0 6px 0 0'
              }
            }
          });
        }
      }
    }

    editor.setDecorations(this.decorationType, decorations);
  }

  public updateAllVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  public dispose(): void {
    this.decorationType.dispose();
  }
}
