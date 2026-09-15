import * as vscode from 'vscode';
import { assessToken, parseJwt, createSanitizedJwt } from '../core/index';
import { formatBadgeLabel } from './badgeFormatter';
import {
  extractClaimSummaries,
  resolveTokenAtPosition,
  resolveTokenFromText
} from './commandHelpers';

export interface JwtActionItem extends vscode.QuickPickItem {
  action?: () => Promise<void> | void;
}

const copyButton: vscode.QuickInputButton = {
  iconPath: new vscode.ThemeIcon('copy'),
  tooltip: 'Copy to clipboard'
};

/**
 * Renders an interactive QuickPick action sheet for any recognized JWT.
 */
export async function showJwtActionPalette(
  rawToken: string,
  range?: vscode.Range
): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (editor && range) {
    editor.selection = new vscode.Selection(range.start, range.end);
    editor.revealRange(range, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
  }

  const now = Math.floor(Date.now() / 1000);
  const assessment = assessToken(rawToken, now);
  if (!assessment.recognized) {
    vscode.window.showWarningMessage('JWT Glance: Unrecognized or malformed token string.');
    return;
  }

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
      label: '$(shield) Copy Sanitized Token (Safe for Bug Reports)',
      description: 'Structurally valid token with sensitive claims redacted',
      buttons: [copyButton],
      action: async () => {
        const sanitized = createSanitizedJwt(rawToken);
        await vscode.env.clipboard.writeText(sanitized);
        vscode.window.showInformationMessage('JWT Glance: Sanitized token copied to clipboard.');
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

  const claimSummaries = extractClaimSummaries(assessment);
  if (claimSummaries.length > 0) {
    items.push({
      label: 'Claims',
      kind: vscode.QuickPickItemKind.Separator
    });
    for (const claim of claimSummaries) {
      items.push({
        label: `$(${claim.icon}) ${claim.name}`,
        description: claim.value,
        buttons: [copyButton],
        action: async () => {
          await vscode.env.clipboard.writeText(claim.value);
          vscode.window.showInformationMessage(`JWT Glance: Copied ${claim.name} (${claim.value})`);
        }
      });
    }
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

/**
 * Command: JWT Glance: Inspect Token at Cursor
 */
export async function inspectAtCursor(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showInformationMessage('JWT Glance: No active editor open.');
    return;
  }

  const selection = editor.selection;
  const line = editor.document.lineAt(selection.active.line);

  // If user has highlighted text, check if selection itself is a token
  if (!selection.isEmpty) {
    const selectedText = editor.document.getText(selection).trim();
    const resolved = resolveTokenFromText(selectedText, Math.floor(Date.now() / 1000));
    if (resolved) {
      await showJwtActionPalette(resolved.raw, new vscode.Range(selection.start, selection.end));
      return;
    }
  }

  // Scan current line for tokens
  const targetCandidate = resolveTokenAtPosition(line.text, selection.active.character);
  if (!targetCandidate) {
    const choice = await vscode.window.showInformationMessage(
      'JWT Glance: No JWT found at cursor.',
      'Inspect Clipboard'
    );
    if (choice === 'Inspect Clipboard') {
      await inspectFromClipboard();
    }
    return;
  }

  const range = new vscode.Range(
    selection.active.line,
    targetCandidate.startIndex,
    selection.active.line,
    targetCandidate.endIndex
  );
  await showJwtActionPalette(targetCandidate.raw, range);
}

/**
 * Command: JWT Glance: Inspect Token from Clipboard
 */
export async function inspectFromClipboard(): Promise<void> {
  const clipText = await vscode.env.clipboard.readText();
  const resolved = resolveTokenFromText(clipText || '', Math.floor(Date.now() / 1000));

  if (resolved) {
    await showJwtActionPalette(resolved.raw);
  } else if (!clipText || !clipText.trim()) {
    vscode.window.showWarningMessage('JWT Glance: Clipboard is empty.');
  } else {
    vscode.window.showWarningMessage('JWT Glance: Clipboard does not contain a recognized JWT.');
  }
}

/**
 * Command: JWT Glance: Toggle Ambient Lens
 */
export async function toggleAmbientLens(): Promise<void> {
  const config = vscode.workspace.getConfiguration('jwtGlance');
  const current = config.get<boolean>('enabled', true);
  await config.update('enabled', !current, vscode.ConfigurationTarget.Global);
  vscode.window.setStatusBarMessage(
    `JWT Glance: Ambient inspection ${!current ? 'Enabled' : 'Disabled'}`,
    3000
  );
}

/**
  * Command: JWT Glance: Copy Sanitized Token
  */
export async function copySanitizedToken(): Promise<void> {
  const editor = vscode.window.activeTextEditor;
  const now = Math.floor(Date.now() / 1000);

  let candidate: string | undefined;
  if (editor) {
    const selection = editor.selection;
    if (!selection.isEmpty) {
      const selectedText = editor.document.getText(selection).trim();
      const resolved = resolveTokenFromText(selectedText, now);
      if (resolved) {
        candidate = resolved.raw;
      }
    }

    if (!candidate) {
      const line = editor.document.lineAt(selection.active.line);
      const target = resolveTokenAtPosition(line.text, selection.active.character);
      if (target) {
        candidate = target.raw;
      }
    }
  }

  if (!candidate) {
    const clipboardText = await vscode.env.clipboard.readText();
    const resolved = resolveTokenFromText(clipboardText || '', now);
    if (resolved) {
      candidate = resolved.raw;
    }
  }

  if (!candidate) {
    vscode.window.showWarningMessage('JWT Glance: No token found under cursor or in clipboard.');
    return;
  }

  const sanitized = createSanitizedJwt(candidate);
  await vscode.env.clipboard.writeText(sanitized);
  vscode.window.showInformationMessage('JWT Glance: Sanitized token copied to clipboard.');
}

/**
 * Handler for CodeLens or badge click
 */
export async function handleInspectTokenCommand(
  _uri?: vscode.Uri,
  range?: vscode.Range,
  rawToken?: string
): Promise<void> {
  if (rawToken) {
    await showJwtActionPalette(rawToken, range);
    return;
  }
  // If called without arguments (e.g., direct command execution), fall back to cursor inspection
  await inspectAtCursor();
}
