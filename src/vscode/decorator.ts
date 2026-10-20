import * as vscode from 'vscode';
import { assessToken, findCandidateTokens } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import { isDocumentEligible } from './filter';
import { DocumentTokenIndex, type CachedTokenEntry } from './tokenIndex';
import {
  SemanticTier,
  getTokenSemanticTier
} from './semanticTier';
import { getJwtGlanceSetting, getGlanceClaims } from './configHelper';

interface TierDecorationConfig {
  color: vscode.ThemeColor;
  overviewRulerColor: vscode.ThemeColor;
}

const TIER_THEME_COLORS: Record<SemanticTier, TierDecorationConfig> = {
  ACTIVE: {
    color: new vscode.ThemeColor('testing.iconPassed'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground')
  },
  EXPIRING_SOON: {
    color: new vscode.ThemeColor('editorWarning.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground')
  },
  EXPIRED: {
    color: new vscode.ThemeColor('editorError.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground')
  },
  UNSECURED: {
    color: new vscode.ThemeColor('errorForeground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground')
  },
  NO_EXPIRATION: {
    color: new vscode.ThemeColor('editorInfo.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground')
  },
  INDETERMINATE: {
    color: new vscode.ThemeColor('editorInlayHint.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground')
  }
};

const ALL_TIERS: SemanticTier[] = [
  'ACTIVE',
  'EXPIRING_SOON',
  'EXPIRED',
  'UNSECURED',
  'NO_EXPIRATION',
  'INDETERMINATE'
];

export class JwtDecorationProvider {
  private readonly badgeDecorationTypes = new Map<SemanticTier, vscode.TextEditorDecorationType>();
  private readonly overviewRulerDecorationTypes = new Map<SemanticTier, vscode.TextEditorDecorationType>();
  private readonly dimmedExpiredDecoration: vscode.TextEditorDecorationType;
  private readonly tokenIndex: DocumentTokenIndex;

  constructor(tokenIndex?: DocumentTokenIndex) {
    this.tokenIndex = tokenIndex ?? new DocumentTokenIndex();

    for (const tier of ALL_TIERS) {
      const colors = TIER_THEME_COLORS[tier];

      // 1. Inline colored text decoration (for position: left or both) — clean text without background boxes
      this.badgeDecorationTypes.set(
        tier,
        vscode.window.createTextEditorDecorationType({
          before: {
            color: colors.color,
            margin: '0 8px 0 0'
          }
        })
      );

      // 2. Dedicated scrollbar overview ruler decoration (controlled strictly by jwtGlance.overviewRuler)
      this.overviewRulerDecorationTypes.set(
        tier,
        vscode.window.createTextEditorDecorationType({
          overviewRulerColor: colors.overviewRulerColor,
          overviewRulerLane: vscode.OverviewRulerLane.Right
        })
      );
    }

    // 3. Subtle text dimming for expired tokens so dead credentials visually recede
    this.dimmedExpiredDecoration = vscode.window.createTextEditorDecorationType({
      opacity: '0.55'
    });
  }

  public updateDecorations(editor?: vscode.TextEditor): void {
    if (!editor || !editor.document) {
      return;
    }

    const document = editor.document;
    if (!isDocumentEligible(document)) {
      this.clearAllDecorations(editor);
      return;
    }

    const position = getJwtGlanceSetting<string>('position', 'top');
    const showOverviewRuler = getJwtGlanceSetting<boolean>('overviewRuler', true);
    const maxOverviewRulerTokens = getJwtGlanceSetting<number>('maxOverviewRulerTokens', 50);
    const dimExpired = getJwtGlanceSetting<boolean>('dimExpiredTokens', true);
    const expiringSoonThreshold = getJwtGlanceSetting<number>('expiringSoonThreshold', 1800);
    const glanceClaims = getGlanceClaims();
    const maxGlanceClaims = getJwtGlanceSetting<number>('maxGlanceClaims', 3);

    const showBadges = position === 'left' || position === 'both';
    const nowEpoch = Math.floor(Date.now() / 1000);

    const badgeDecorationsByTier = new Map<SemanticTier, vscode.DecorationOptions[]>();
    const overviewRulerByTier = new Map<SemanticTier, vscode.DecorationOptions[]>();
    const expiredRanges: vscode.Range[] = [];

    for (const tier of ALL_TIERS) {
      badgeDecorationsByTier.set(tier, []);
      overviewRulerByTier.set(tier, []);
    }

    const needsFullDocument = showOverviewRuler && maxOverviewRulerTokens > 0;
    const isCached = this.tokenIndex.hasTokens(document);

    // Compute visible lines (+/- 10 buffer) used for inline badges and viewport-lazy scanning
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

    let candidateTokens: CachedTokenEntry[];
    if (needsFullDocument || isCached) {
      candidateTokens = this.tokenIndex.getTokens(document);
    } else {
      // Viewport-scoped scan: only read and scan lines in visibleRanges +/- 10 lines
      // when no full-document consumer is active, preserving high performance on large files.
      const maxLineLength = getJwtGlanceSetting<number>('maxLineLength', 10000);
      const viewportEntries: CachedTokenEntry[] = [];
      for (const lineNum of linesToScan) {
        if (lineNum >= document.lineCount) continue;
        const lineText = document.lineAt(lineNum).text;
        if (!lineText || lineText.length > maxLineLength) continue;
        const candidates = findCandidateTokens(lineText);
        for (const c of candidates) {
          viewportEntries.push({
            raw: c.raw,
            startIndex: c.startIndex,
            endIndex: c.endIndex,
            lineNum
          });
        }
      }
      candidateTokens = viewportEntries;
    }

    // 1. Overview Ruler: covers the entire document up to maxOverviewRulerTokens
    if (needsFullDocument) {
      let rulerCount = 0;
      for (const candidate of candidateTokens) {
        if (rulerCount >= maxOverviewRulerTokens) {
          break;
        }
        const assessment = assessToken(candidate.raw, nowEpoch);
        if (assessment.recognized) {
          const tier = getTokenSemanticTier(assessment, expiringSoonThreshold);
          const range = new vscode.Range(
            candidate.lineNum,
            candidate.startIndex,
            candidate.lineNum,
            candidate.endIndex
          );
          overviewRulerByTier.get(tier)?.push({ range });
          rulerCount++;
        }
      }
    }

    // 2. Viewport-lazy Inline Badges & Expired Text Dimming (only for visible lines +/- 10 lines)
    if (showBadges || dimExpired) {
      for (const candidate of candidateTokens) {
        if ((needsFullDocument || isCached) && !linesToScan.has(candidate.lineNum)) {
          continue;
        }

        const assessment = assessToken(candidate.raw, nowEpoch);
        if (assessment.recognized) {
          const tier = getTokenSemanticTier(assessment, expiringSoonThreshold);
          const range = new vscode.Range(
            candidate.lineNum,
            candidate.startIndex,
            candidate.lineNum,
            candidate.endIndex
          );

          if (dimExpired && tier === 'EXPIRED') {
            expiredRanges.push(range);
          }

          if (showBadges) {
            const badgeText = formatBadgeLabel(assessment, { glanceClaims, maxGlanceClaims });
            const options: vscode.DecorationOptions = {
              range,
              renderOptions: {
                before: {
                  contentText: `${badgeText} `
                }
              }
            };
            badgeDecorationsByTier.get(tier)?.push(options);
          }
        }
      }
    }

    // Apply or clear inline badge decorations (left / both)
    for (const [tier, decType] of this.badgeDecorationTypes) {
      editor.setDecorations(decType, showBadges ? (badgeDecorationsByTier.get(tier) || []) : []);
    }

    // Apply or clear scrollbar overview indicators (strictly controlled by showOverviewRuler across all positions)
    for (const [tier, decType] of this.overviewRulerDecorationTypes) {
      editor.setDecorations(
        decType,
        showOverviewRuler ? (overviewRulerByTier.get(tier) || []) : []
      );
    }

    // Apply or clear expired text dimming
    editor.setDecorations(this.dimmedExpiredDecoration, dimExpired ? expiredRanges : []);
  }

  private clearAllDecorations(editor: vscode.TextEditor): void {
    for (const decType of this.badgeDecorationTypes.values()) {
      editor.setDecorations(decType, []);
    }
    for (const decType of this.overviewRulerDecorationTypes.values()) {
      editor.setDecorations(decType, []);
    }
    editor.setDecorations(this.dimmedExpiredDecoration, []);
  }

  public updateAllVisibleEditors(): void {
    for (const editor of vscode.window.visibleTextEditors) {
      this.updateDecorations(editor);
    }
  }

  public dispose(): void {
    for (const decType of this.badgeDecorationTypes.values()) {
      decType.dispose();
    }
    for (const decType of this.overviewRulerDecorationTypes.values()) {
      decType.dispose();
    }
    this.dimmedExpiredDecoration.dispose();
    this.badgeDecorationTypes.clear();
    this.overviewRulerDecorationTypes.clear();
  }
}
