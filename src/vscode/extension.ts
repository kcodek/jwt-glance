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
          interface JwtActionItem extends vscode.QuickPickItem {
            action?: () => Promise<void> | void;
          }

          const copyButton: vscode.QuickInputButton = {
            iconPath: new vscode.ThemeIcon('copy'),
            tooltip: 'Copy to clipboard'
          };

          const items: (JwtActionItem | vscode.QuickPickItem)[] = [
            {
              label: 'Actions',
              kind: vscode.QuickPickItemKind.Separator
            },
            {
              label: '$(json) Open Decoded Token in New Editor',
              description: 'View full formatted header and payload JSON in a dedicated editor tab',
              action: async () => {
                const parsed = parseJwt(rawToken);
                if (!('reason' in parsed)) {
                  const content = JSON.stringify(
                    {
                      _summary: {
                        algorithm: assessment.algorithm,
                        temporalStatus: assessment.temporalStatus,
                        expiresAtIso: assessment.expiresAtIso,
                        secondsUntilExpiration: assessment.secondsUntilExpiration,
                        subject: assessment.subject,
                        issuer: assessment.issuer,
                        audience: assessment.audience,
                        roles: assessment.roles
                      },
                      header: parsed.header,
                      payload: parsed.payload
                    },
                    null,
                    2
                  );
                  const doc = await vscode.workspace.openTextDocument({
                    language: 'json',
                    content
                  });
                  await vscode.window.showTextDocument(doc, { preview: true });
                }
              }
            },
            {
              label: '$(clippy) Decoded Payload JSON',
              description: 'Formatted payload claims',
              buttons: [copyButton],
              action: async () => {
                const parsed = parseJwt(rawToken);
                if (!('reason' in parsed)) {
                  await vscode.env.clipboard.writeText(JSON.stringify(parsed.payload, null, 2));
                  vscode.window.showInformationMessage('JWT Glance: Decoded payload copied to clipboard.');
                }
              }
            },
            {
              label: '$(key) Raw Token',
              description: 'Candidate token string',
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(rawToken);
                vscode.window.showInformationMessage('JWT Glance: Raw token copied to clipboard.');
              }
            }
          ];

          const claimItems: JwtActionItem[] = [];

          if (assessment.subject) {
            claimItems.push({
              label: '$(person) Subject (sub)',
              description: assessment.subject,
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(assessment.subject!);
                vscode.window.showInformationMessage(`JWT Glance: Copied Subject (${assessment.subject})`);
              }
            });
          }

          if (assessment.roles.length > 0) {
            const rolesStr = assessment.roles.join(', ');
            claimItems.push({
              label: '$(shield) Roles',
              description: rolesStr,
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(rolesStr);
                vscode.window.showInformationMessage(`JWT Glance: Copied Roles (${rolesStr})`);
              }
            });
          }

          if (assessment.issuer) {
            claimItems.push({
              label: '$(globe) Issuer (iss)',
              description: assessment.issuer,
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(assessment.issuer!);
                vscode.window.showInformationMessage(`JWT Glance: Copied Issuer (${assessment.issuer})`);
              }
            });
          }

          if (assessment.audience) {
            const audStr = Array.isArray(assessment.audience) ? assessment.audience.join(', ') : assessment.audience;
            claimItems.push({
              label: '$(organization) Audience (aud)',
              description: audStr,
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(audStr);
                vscode.window.showInformationMessage(`JWT Glance: Copied Audience (${audStr})`);
              }
            });
          }

          if (assessment.expiresAtIso) {
            claimItems.push({
              label: '$(clock) Expiration (exp)',
              description: assessment.expiresAtIso,
              buttons: [copyButton],
              action: async () => {
                await vscode.env.clipboard.writeText(assessment.expiresAtIso!);
                vscode.window.showInformationMessage(`JWT Glance: Copied Expiration (${assessment.expiresAtIso})`);
              }
            });
          }

          if (claimItems.length > 0) {
            items.push({
              label: 'Claims',
              kind: vscode.QuickPickItemKind.Separator
            });
            items.push(...claimItems);
          }

          return new Promise<void>((resolve) => {
            const qp = vscode.window.createQuickPick<JwtActionItem>();
            qp.title = `JWT Glance: [${formatBadgeLabel(assessment)}]`;
            qp.placeholder = 'Select an action or click copy on any claim';
            qp.items = items;

            const executeAction = async (item: JwtActionItem) => {
              qp.hide();
              if (typeof item.action === 'function') {
                await item.action();
              }
              resolve();
            };

            qp.onDidAccept(() => {
              const selected = qp.selectedItems[0];
              if (selected) {
                executeAction(selected);
              }
            });

            qp.onDidTriggerItemButton((e) => {
              executeAction(e.item);
            });

            qp.onDidHide(() => {
              qp.dispose();
              resolve();
            });

            qp.show();
          });
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
