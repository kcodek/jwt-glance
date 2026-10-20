import * as vscode from 'vscode';
import { JwtDecorationProvider } from './decorator';
import { JwtCodeLensProvider } from './codeLens';
import { JwtHoverProvider } from './hover';
import { DocumentTokenIndex } from './tokenIndex';
import { JwtDiagnosticsProvider } from './diagnostics';
import { JwtStatusBarItem } from './statusBar';
import {
  handleInspectTokenCommand,
  inspectAtCursor,
  inspectFromClipboard,
  toggleAmbientLens,
  copyRedactedToken,
  copyBearerToken,
  chooseGlanceClaim
} from './commands';

const DOCUMENT_SELECTOR: vscode.DocumentSelector = '*';
const INVALIDATION_INTERVAL_MS = 60_000; // 60 seconds

export function activate(context: vscode.ExtensionContext): void {
  const tokenIndex = new DocumentTokenIndex();
  const decorator = new JwtDecorationProvider(tokenIndex);
  const codeLensProvider = new JwtCodeLensProvider(tokenIndex);
  const hoverProvider = new JwtHoverProvider();
  const diagnosticsProvider = new JwtDiagnosticsProvider(tokenIndex, context);
  const statusBarItem = new JwtStatusBarItem();

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
    copyRedactedToken
  );

  const copyBearerTokenCmd = vscode.commands.registerCommand(
    'jwtGlance.copyBearerToken',
    copyBearerToken
  );

  const toggleEnabledCmd = vscode.commands.registerCommand(
    'jwtGlance.toggleEnabled',
    toggleAmbientLens
  );

  const chooseGlanceClaimCmd = vscode.commands.registerCommand(
    'jwtGlance.chooseGlanceClaim',
    chooseGlanceClaim
  );

  // Update decorations when editor visible ranges change (scrolling)
  const visibleRangesDisposable = vscode.window.onDidChangeTextEditorVisibleRanges((event) => {
    decorator.updateDecorations(event.textEditor);
  });

  // Update decorations when active editor changes
  const activeEditorDisposable = vscode.window.onDidChangeActiveTextEditor((editor) => {
    if (editor) {
      decorator.updateDecorations(editor);
      diagnosticsProvider.updateDiagnostics(editor.document);
    }
  });

  // Debounced update on document edits per document URI (150ms)
  const debounceTimeouts = new Map<string, NodeJS.Timeout>();
  const docChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
    tokenIndex.invalidate(event.document.uri);
    const uriKey = event.document.uri.toString();
    const existing = debounceTimeouts.get(uriKey);
    if (existing) {
      clearTimeout(existing);
    }
    const timeout = setTimeout(() => {
      debounceTimeouts.delete(uriKey);
      // Refresh visible editors matching the changed document (handles active editor & split panes)
      for (const editor of vscode.window.visibleTextEditors) {
        if (editor.document === event.document) {
          decorator.updateDecorations(editor);
        }
      }
      diagnosticsProvider.updateDiagnostics(event.document);
    }, 150);
    debounceTimeouts.set(uriKey, timeout);
  });

  // Evict cached tokens and clear pending debounce timers on document close
  const docCloseDisposable = vscode.workspace.onDidCloseTextDocument((doc) => {
    const uriKey = doc.uri.toString();
    const existing = debounceTimeouts.get(uriKey);
    if (existing) {
      clearTimeout(existing);
      debounceTimeouts.delete(uriKey);
    }
    tokenIndex.invalidate(doc.uri);
    diagnosticsProvider.clear(doc.uri);
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
      tokenIndex.clear();
      codeLensProvider.refresh();
      decorator.updateAllVisibleEditors();
      diagnosticsProvider.updateAllOpenDocuments();
      statusBarItem.update();
    }
  });

  // 60-Second Invalidation Loop: Refresh relative timestamps without document edits
  const timer = setInterval(() => {
    codeLensProvider.refresh();
    decorator.updateAllVisibleEditors();
    diagnosticsProvider.updateAllOpenDocuments();
  }, INVALIDATION_INTERVAL_MS);

  const cleanupDisposable = new vscode.Disposable(() => {
    clearInterval(timer);
    for (const timeout of debounceTimeouts.values()) {
      clearTimeout(timeout);
    }
    debounceTimeouts.clear();
    decorator.dispose();
    tokenIndex.clear();
    diagnosticsProvider.dispose();
    statusBarItem.dispose();
  });

  context.subscriptions.push(
    statusBarItem,
    codeLensDisposable,
    hoverDisposable,
    inspectTokenCmd,
    inspectAtCursorCmd,
    inspectFromClipboardCmd,
    copyRedactedTokenCmd,
    copyBearerTokenCmd,
    chooseGlanceClaimCmd,
    toggleEnabledCmd,
    visibleRangesDisposable,
    activeEditorDisposable,
    docChangeDisposable,
    docCloseDisposable,
    visibleEditorsDisposable,
    configDisposable,
    cleanupDisposable
  );

  // Immediate initial render on active editor
  if (vscode.window.activeTextEditor) {
    decorator.updateDecorations(vscode.window.activeTextEditor);
    diagnosticsProvider.updateDiagnostics(vscode.window.activeTextEditor.document);
  }
}

export function deactivate(): void {
  // Cleanups handled via context.subscriptions
}
