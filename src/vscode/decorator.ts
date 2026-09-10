import * as vscode from 'vscode';
import { findCandidateTokens, assessToken, parseJwt } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import { formatHoverContent } from './hoverFormatter';

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
    const isEnabled = config.get<boolean>('enabled', true);
    const position = config.get<string>('position', 'top');
    if (!isEnabled || position === 'top') {
      editor.setDecorations(this.decorationType, []);
      return;
    }

    const maxLineLength = config.get<number>('maxLineLength', 10000);
    const document = editor.document;
    const nowEpoch = Math.floor(Date.now() / 1000);
    const decorations: vscode.DecorationOptions[] = [];

    const lineCount = document.lineCount;
    for (let lineNum = 0; lineNum < lineCount; lineNum++) {
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
            candidate.startIndex
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
                contentText: badgeText
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
