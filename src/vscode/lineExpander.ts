import * as vscode from 'vscode';

export function expandRangeToLineBoundaries(
  document: vscode.TextDocument,
  range: vscode.Range
): vscode.Range {
  const startLine = range.start.line;
  const endLine = Math.min(range.end.line, document.lineCount - 1);
  const endLineLength = document.lineAt(endLine).text.length;
  return new vscode.Range(startLine, 0, endLine, endLineLength);
}
