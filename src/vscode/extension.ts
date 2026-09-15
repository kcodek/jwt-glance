import * as vscode from 'vscode';
import { JwtDecorationProvider } from './decorator';
import { JwtCodeLensProvider } from './codeLens';
import { JwtHoverProvider } from './hover';
import {
  handleInspectTokenCommand,
  inspectAtCursor,
  inspectFromClipboard,
  toggleAmbientLens,
  copySanitizedToken
} from './commands';

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

  // Register Commands
  const inspectTokenCmd = vscode.commands.registerCommand(
    'jwtGlance.inspectToken',
    handleInspectTokenCommand
  );

  const inspectAtCursorCmd = vscode.commands.registerCommand(
    'jwtGlance.inspectAtCursor',
    inspectAtCursor
  );

  const inspectFromClipboardCmd = vscode.commands.registerCommand(
    'jwtGlance.inspectFromClipboard',
    inspectFromClipboard
  );

  const copyRedactedTokenCmd = vscode.commands.registerCommand(
    'jwtGlance.copyRedactedToken',
    copySanitizedToken
  );

  const copySanitizedTokenCmd = vscode.commands.registerCommand(
    'jwtGlance.copySanitizedToken',
    copySanitizedToken
  );


  const toggleEnabledCmd = vscode.commands.registerCommand(
    'jwtGlance.toggleEnabled',
    toggleAmbientLens
  );

  const showHoverCmd = vscode.commands.registerCommand('jwtGlance.showHover', (...args: unknown[]) => {
    vscode.commands.executeCommand('jwtGlance.inspectToken', ...args);
  });

  // Update decorations when editor visible ranges change (scrolling)
  const visibleRangesDisposable = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    decorator.updateDecorations(event.textEditor);
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
  const configDisposable = vscode.workspace.onDidChangeConfiguration((e) => {
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
    inspectAtCursorCmd,
    inspectFromClipboardCmd,
    copyRedactedTokenCmd,
    copySanitizedTokenCmd,
    toggleEnabledCmd,

    showHoverCmd,
    visibleRangesDisposable,
    activeEditorDisposable,
    docChangeDisposable,
    visibleEditorsDisposable,
    configDisposable,
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
