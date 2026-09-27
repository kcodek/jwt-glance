import * as vscode from 'vscode';
import { findCandidateTokens, assessToken } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import { isDocumentEligible } from './filter';
import {
  SemanticTier,
  getTokenSemanticTier
} from './semanticTier';

interface TierDecorationConfig {
  color: vscode.ThemeColor;
  backgroundColor: vscode.ThemeColor;
  borderColor: vscode.ThemeColor;
  overviewRulerColor: vscode.ThemeColor;
}

const TIER_THEME_COLORS: Record<SemanticTier, TierDecorationConfig> = {
  ACTIVE: {
    color: new vscode.ThemeColor('testing.iconPassed'),
    backgroundColor: new vscode.ThemeColor('diffEditor.insertedLineBackground'),
    borderColor: new vscode.ThemeColor('testing.iconPassed'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.addedForeground')
  },
  EXPIRING_SOON: {
    color: new vscode.ThemeColor('editorWarning.foreground'),
    backgroundColor: new vscode.ThemeColor('inputValidation.warningBackground'),
    borderColor: new vscode.ThemeColor('editorWarning.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.warningForeground')
  },
  EXPIRED: {
    color: new vscode.ThemeColor('editorError.foreground'),
    backgroundColor: new vscode.ThemeColor('diffEditor.removedLineBackground'),
    borderColor: new vscode.ThemeColor('editorError.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground')
  },
  UNSECURED: {
    color: new vscode.ThemeColor('errorForeground'),
    backgroundColor: new vscode.ThemeColor('inputValidation.errorBackground'),
    borderColor: new vscode.ThemeColor('errorForeground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.errorForeground')
  },
  NO_EXPIRATION: {
    color: new vscode.ThemeColor('editorInfo.foreground'),
    backgroundColor: new vscode.ThemeColor('inputValidation.infoBackground'),
    borderColor: new vscode.ThemeColor('editorInfo.foreground'),
    overviewRulerColor: new vscode.ThemeColor('editorOverviewRuler.infoForeground')
  },
  INDETERMINATE: {
    color: new vscode.ThemeColor('editorInlayHint.foreground'),
    backgroundColor: new vscode.ThemeColor('editorInlayHint.background'),
    borderColor: new vscode.ThemeColor('editorInlayHint.foreground'),
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

  constructor() {
    for (const tier of ALL_TIERS) {
      const colors = TIER_THEME_COLORS[tier];

      // 1. Inline pill badge decoration (for position: left or both) — no overview ruler attached
      this.badgeDecorationTypes.set(
        tier,
        vscode.window.createTextEditorDecorationType({
          before: {
            color: colors.color,
            backgroundColor: colors.backgroundColor,
            border: '1px solid',
            borderColor: colors.borderColor,
            fontWeight: '500',
            margin: '0 6px 0 0'
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

    const config = vscode.workspace.getConfiguration('jwtGlance');
    const position = config.get<string>('position', 'top');
    const showOverviewRuler = config.get<boolean>('overviewRuler', true);
    const dimExpired = config.get<boolean>('dimExpiredTokens', true);
    const expiringSoonThreshold = config.get<number>('expiringSoonThreshold', 1800);
    const maxLineLength = config.get<number>('maxLineLength', 10000);

    const showBadges = position === 'left' || position === 'both';
    const nowEpoch = Math.floor(Date.now() / 1000);

    const badgeDecorationsByTier = new Map<SemanticTier, vscode.DecorationOptions[]>();
    const overviewRulerByTier = new Map<SemanticTier, vscode.DecorationOptions[]>();
    const expiredRanges: vscode.Range[] = [];

    for (const tier of ALL_TIERS) {
      badgeDecorationsByTier.set(tier, []);
      overviewRulerByTier.set(tier, []);
    }

    // Scan visible ranges (plus 10 lines padding buffer) for high performance
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
          const tier = getTokenSemanticTier(assessment, expiringSoonThreshold);
          const badgeText = `[${formatBadgeLabel(assessment)}]`;
          const range = new vscode.Range(
            lineNum,
            candidate.startIndex,
            lineNum,
            candidate.endIndex
          );

          if (tier === 'EXPIRED') {
            expiredRanges.push(range);
          }

          const options: vscode.DecorationOptions = {
            range,
            renderOptions: {
              before: {
                contentText: ` ${badgeText} `
              }
            }
          };

          badgeDecorationsByTier.get(tier)?.push(options);
          overviewRulerByTier.get(tier)?.push({ range });
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
