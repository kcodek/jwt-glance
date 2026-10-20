import * as vscode from 'vscode';
import { findCandidateTokens } from '../core/index';
import { isDocumentEligible } from './filter';
import { getJwtGlanceSetting } from './configHelper';

export interface CachedTokenEntry {
  raw: string;
  startIndex: number;
  endIndex: number;
  lineNum: number;
}

export function extractCandidateTokensFromLines(
  lines: string[],
  maxLineLength: number
): CachedTokenEntry[] {
  const entries: CachedTokenEntry[] = [];
  for (let lineNum = 0; lineNum < lines.length; lineNum++) {
    const lineText = lines[lineNum];
    if (!lineText || lineText.length > maxLineLength) {
      continue;
    }
    const candidates = findCandidateTokens(lineText);
    for (const c of candidates) {
      entries.push({
        raw: c.raw,
        startIndex: c.startIndex,
        endIndex: c.endIndex,
        lineNum
      });
    }
  }
  return entries;
}

export class DocumentTokenIndex {
  private readonly cache = new Map<string, { version: number; tokens: CachedTokenEntry[] }>();

  public hasTokens(document: vscode.TextDocument): boolean {
    if (!document || !document.uri) {
      return false;
    }
    const key = document.uri.toString();
    const cached = this.cache.get(key);
    return Boolean(cached && cached.version === document.version);
  }

  public getTokens(document: vscode.TextDocument): CachedTokenEntry[] {
    if (!document || !document.uri) {
      return [];
    }

    const key = document.uri.toString();
    const cached = this.cache.get(key);
    if (cached && cached.version === document.version) {
      return cached.tokens;
    }

    if (!isDocumentEligible(document)) {
      this.cache.set(key, { version: document.version, tokens: [] });
      return [];
    }

    const maxLineLength = getJwtGlanceSetting<number>('maxLineLength', 10000);

    const lineCount = document.lineCount;
    const lines: string[] = [];
    for (let i = 0; i < lineCount; i++) {
      lines.push(document.lineAt(i).text);
    }

    const tokens = extractCandidateTokensFromLines(lines, maxLineLength);
    this.cache.set(key, { version: document.version, tokens });
    return tokens;
  }

  public invalidate(uri: vscode.Uri | string): void {
    const key = typeof uri === 'string' ? uri : uri.toString();
    this.cache.delete(key);
  }

  public clear(): void {
    this.cache.clear();
  }
}
