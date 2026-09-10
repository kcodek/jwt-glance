import * as vscode from 'vscode';
import { JwtDecorationProvider } from './decorator';
import { JwtCodeLensProvider } from './codeLens';
import { JwtHoverProvider } from './hover';
import { assessToken, parseJwt } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';

const DOCUMENT_SELECTOR: vscode.DocumentSelector = [
  { scheme: 'file' },
  { scheme: 'untitled' },
  { scheme: 'vscode-remote' },
  { scheme: 'vscode-vfs' },
  '*'
];
const INVALIDATION_INTERVAL_MS = 60_000; // 60 seconds

export function activate(context: vscode.ExtensionContext): void {
  const decorator = new JwtDecorationProvider();
  const codeLensProvider = new JwtCodeLensProvider();
  const hoverProvider = new JwtHoverProvider();

  // Register CodeLens Provider (Renders on top of the line)
  const codeLensDisposable = vscode.languages.registerCodeLensProvider(
    DOCUMENT_SELECTOR,
    codeLensProvider
  );

  // Register Hover Provider for token text
  const hoverDisposable = vscode.languages.registerHoverProvider(
    DOCUMENT_SELECTOR,
    hoverProvider
  );

  // Command triggered when clicking the badge (CodeLens or InlayHint)
  const inspectTokenCmd = vscode.commands.registerCommand(
    'jwtGlance.inspectToken',
    async (_uri?: vscode.Uri, range?: vscode.Range, rawToken?: string) => {
      const editor = vscode.window.activeTextEditor;
      if (editor && range) {
        editor.selection = new vscode.Selection(range.start, range.end);
        editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
      }

      if (rawToken) {
        const now = Math.floor(Date.now() / 1000);
        const assessment = assessToken(rawToken, now);
        if (assessment.recognized) {
          const items: vscode.QuickPickItem[] = [
            {
              label: `$(key) ${formatBadgeLabel(assessment)}`,
              description: assessment.isUnsecured ? '⚠️ UNSECURED (alg:none)' : `Alg: ${assessment.algorithm}`,
              detail: assessment.expiresAtIso ? `Expires: ${assessment.expiresAtIso}` : 'No expiration claim'
            }
          ];

          if (assessment.subject) {
            items.push({
              label: '$(person) Subject (sub)',
              description: assessment.subject
            });
          }

          if (assessment.roles.length > 0) {
            items.push({
              label: '$(shield) Roles',
              description: assessment.roles.join(', ')
            });
          }

          if (assessment.issuer) {
            items.push({
              label: '$(globe) Issuer (iss)',
              description: assessment.issuer
            });
          }

          if (assessment.audience) {
            const audStr = Array.isArray(assessment.audience) ? assessment.audience.join(', ') : assessment.audience;
            items.push({
              label: '$(organization) Audience (aud)',
              description: audStr
            });
          }

          items.push(
            {
              label: '$(clippy) Copy Decoded Payload JSON',
              description: 'Copy formatted payload claims to clipboard'
            },
            {
              label: '$(copy) Copy Raw Token',
              description: 'Copy candidate token string to clipboard'
            }
          );

          const selected = await vscode.window.showQuickPick(items, {
            title: 'JWT Glance Credential Inspector',
            placeHolder: 'View claim summary or select an action'
          });

          if (selected?.label.includes('Copy Decoded Payload JSON')) {
            const parsed = parseJwt(rawToken);
            if (!('reason' in parsed)) {
              await vscode.env.clipboard.writeText(JSON.stringify(parsed.payload, null, 2));
              vscode.window.showInformationMessage('JWT Glance: Decoded payload copied to clipboard.');
            }
          } else if (selected?.label.includes('Copy Raw Token')) {
            await vscode.env.clipboard.writeText(rawToken);
            vscode.window.showInformationMessage('JWT Glance: Raw token copied to clipboard.');
          }
          return;
        }
      }

      // Fallback to hover action
      await vscode.commands.executeCommand('editor.action.showHover');
    }
  );

  const showHoverCmd = vscode.commands.registerCommand('jwtGlance.showHover', (...args: unknown[]) => {
    vscode.commands.executeCommand('jwtGlance.inspectToken', ...args);
  });

  // Update decorations when active editor changes
  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      decorator.updateDecorations(editor);
    }
  });

  // Debounced update on document edits (150ms)
  let debounceTimeout: NodeJS.Timeout | undefined;
  const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    const activeEditor = vscode.window.activeTextEditor;
    if (activeEditor && activeEditor.document === event.document) {
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      debounceTimeout = setTimeout(() => {
        decorator.updateDecorations(activeEditor);
      }, 150);
    }
  });

  // Update when visible editors change (e.g. split panes)
  const visibleEditorsDisposable = vscode.window.onDidChangeVisibleTextEditors((editors) => {
    for (const editor of editors) {
      decorator.updateDecorations(editor);
    }
  });

  // Listen for configuration changes
  const configChangeDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
    if (e.affectsConfiguration('jwtGlance')) {
      codeLensProvider.refresh();
      decorator.updateAllVisibleEditors();
    }
  });

  // 60-Second Invalidation Loop: Refresh relative timestamps without document edits
  const timer = setInterval(() => {
    codeLensProvider.refresh();
    decorator.updateAllVisibleEditors();
  }, INVALIDATION_INTERVAL_MS);

  const cleanupDisposable = new vscode.Disposable(() => {
    clearInterval(timer);
    if (debounceTimeout) {
      clearTimeout(debounceTimeout);
    }
    decorator.dispose();
  });

  context.subscriptions.push(
    codeLensDisposable,
    hoverDisposable,
    inspectTokenCmd,
    showHoverCmd,
    activeEditorDisposable,
    docChangeDisposable,
    visibleEditorsDisposable,
    configChangeDisposable,
    cleanupDisposable
  );

  // Immediate initial render on active editor
  if (vscode.window.activeTextEditor) {
    decorator.updateDecorations(vscode.window.activeTextEditor);
  }
}

export function deactivate(): void {
  // Cleanups handled via context.subscriptions
}
