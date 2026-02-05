import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import {
  transpile,
  ITranspileResult,
  ITranspileError,
} from "../../src/lib/transpiler";
import PreviewProvider from "./previewProvider";
import CNextCompletionProvider from "./completionProvider";
import CNextHoverProvider from "./hoverProvider";
import CNextDefinitionProvider from "./definitionProvider";
import WorkspaceIndex from "./workspace/WorkspaceIndex";
import CNextExtensionContext from "./ExtensionContext";

// Re-export for use by other modules
export { transpile, ITranspileResult, ITranspileError };

/**
 * C-Next configuration file options
 */
interface ICNextConfig {
  outputExtension?: ".c" | ".cpp";
  debugMode?: boolean;
}

/**
 * Config file names in priority order (highest first)
 */
const CONFIG_FILES = ["cnext.config.json", ".cnext.json", ".cnextrc"];

/**
 * Load config from project directory, searching up the directory tree
 */
function loadConfig(startDir: string): ICNextConfig {
  let dir = path.resolve(startDir);

  while (dir !== path.dirname(dir)) {
    // Stop at filesystem root
    for (const configFile of CONFIG_FILES) {
      const configPath = path.join(dir, configFile);
      if (fs.existsSync(configPath)) {
        try {
          const content = fs.readFileSync(configPath, "utf-8");
          return JSON.parse(content) as ICNextConfig;
        } catch {
          console.error(`C-Next: Failed to parse ${configPath}`);
          return {};
        }
      }
    }
    dir = path.dirname(dir);
  }

  return {}; // No config found
}

let diagnosticCollection: vscode.DiagnosticCollection;
let previewProvider: PreviewProvider;
let workspaceIndex: WorkspaceIndex;
let extensionContext: CNextExtensionContext;

// Track last successful transpilation per file (to avoid writing bad code)
const lastGoodTranspile: Map<string, string> = new Map();

// Debounce timers for .c file generation
const transpileTimers: Map<string, NodeJS.Timeout> = new Map();

// Debounce timer for diagnostics validation
let validateTimeout: NodeJS.Timeout | null = null;

// Debounce timer for active editor switches
let editorSwitchTimeout: NodeJS.Timeout | null = null;

/**
 * Validate a C-Next document and update diagnostics
 */
function validateDocument(document: vscode.TextDocument): void {
  if (document.languageId !== "cnext") {
    return;
  }

  const source = document.getText();
  // Full transpile to catch code generation errors (not just parse errors)
  const result = transpile(source);

  // Clear diagnostics for this specific document
  diagnosticCollection.delete(document.uri);

  const diagnostics: vscode.Diagnostic[] = result.errors.map((error) => {
    // Try to find the end of the error token for better highlighting
    const line = document.lineAt(Math.max(0, error.line - 1));
    const lineText = line.text;

    // Find word boundary after error position
    let endColumn = error.column;
    while (endColumn < lineText.length && /\w/.test(lineText[endColumn])) {
      endColumn++;
    }
    // If no word found, highlight a few characters
    if (endColumn === error.column) {
      endColumn = Math.min(error.column + 5, lineText.length);
    }

    const range = new vscode.Range(
      error.line - 1,
      error.column,
      error.line - 1,
      endColumn,
    );

    const diagnostic = new vscode.Diagnostic(
      range,
      error.message,
      error.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : vscode.DiagnosticSeverity.Warning,
    );
    diagnostic.source = "C-Next";
    // Categorize error type based on message content
    if (error.message.includes("Code generation failed")) {
      diagnostic.code = "codegen-error";
    } else if (error.message.includes("error[")) {
      diagnostic.code = "analysis-error";
    } else {
      diagnostic.code = "parse-error";
    }
    return diagnostic;
  });

  diagnosticCollection.set(document.uri, diagnostics);
}

/**
 * Transpile a C-Next document and write the .c file alongside it
 * Only writes if transpilation succeeds (preserves last good .c file)
 */
function transpileToFile(document: vscode.TextDocument): void {
  if (document.languageId !== "cnext") {
    return;
  }

  // Check if feature is enabled
  const config = vscode.workspace.getConfiguration("cnext");
  if (!config.get<boolean>("transpile.generateCFile", true)) {
    return;
  }

  // Don't transpile untitled documents
  if (document.isUntitled) {
    return;
  }

  const source = document.getText();
  const result = transpile(source);

  if (result.success) {
    // Store as last good transpilation
    lastGoodTranspile.set(document.uri.toString(), result.code);

    // Load config to determine output extension
    const cnxPath = document.uri.fsPath;
    const projectConfig = loadConfig(path.dirname(cnxPath));
    const outputExt = projectConfig.outputExtension || ".c";
    const outputPath = cnxPath.replace(/\.cnx$/, outputExt);

    try {
      fs.writeFileSync(outputPath, result.code, "utf-8");
      // Cache the output path for completion/hover queries
      // This allows completions to work even when current code has parse errors
      extensionContext.lastGoodOutputPath.set(document.uri.toString(), outputPath);
    } catch (err) {
      // Silently fail - don't interrupt the user's workflow
      console.error("C-Next: Failed to write output file:", err);
    }
  }
  // If transpilation fails, we keep the last good .c/.cpp file
  // and the lastGoodOutputPath cache remains valid for completions
}

/**
 * Schedule a debounced transpile-to-file operation
 */
function scheduleTranspileToFile(document: vscode.TextDocument): void {
  const uri = document.uri.toString();

  // Clear existing timer
  const existingTimer = transpileTimers.get(uri);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Get debounce delay from settings
  const config = vscode.workspace.getConfiguration("cnext");
  const delay = config.get<number>("transpile.updateDelay", 500);

  // Schedule new transpile
  const timer = setTimeout(() => {
    transpileToFile(document);
    transpileTimers.delete(uri);
  }, delay);

  transpileTimers.set(uri, timer);
}

export function activate(context: vscode.ExtensionContext): void {
  console.log("C-Next extension activated");

  // Create output channel for debug logging
  const outputChannel = vscode.window.createOutputChannel("C-Next");
  context.subscriptions.push(outputChannel);
  extensionContext = new CNextExtensionContext(outputChannel);
  outputChannel.appendLine("C-Next extension activated");

  // Create diagnostic collection for errors
  diagnosticCollection = vscode.languages.createDiagnosticCollection("cnext");
  context.subscriptions.push(diagnosticCollection);

  // Create preview provider
  previewProvider = PreviewProvider.getInstance();
  context.subscriptions.push(previewProvider);

  // Initialize workspace-wide symbol index
  workspaceIndex = WorkspaceIndex.getInstance();

  // Create status bar item for index status
  const statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Right,
    100,
  );
  statusBarItem.text = "$(database) C-Next";
  statusBarItem.tooltip = "C-Next Workspace Index";
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
  workspaceIndex.setStatusBarItem(statusBarItem);

  // Initialize the workspace index with workspace folders
  workspaceIndex.initialize(vscode.workspace.workspaceFolders || []);

  // File watcher for .cnx files (cross-file symbol updates)
  const cnxWatcher = vscode.workspace.createFileSystemWatcher("**/*.cnx");
  cnxWatcher.onDidChange((uri) => workspaceIndex.onFileChanged(uri));
  cnxWatcher.onDidCreate((uri) => workspaceIndex.onFileCreated(uri));
  cnxWatcher.onDidDelete((uri) => workspaceIndex.onFileDeleted(uri));
  context.subscriptions.push(cnxWatcher);

  // File watcher for header files (.h, .c) - for re-indexing when headers change
  const headerWatcher = vscode.workspace.createFileSystemWatcher("**/*.{h,c}");
  headerWatcher.onDidChange((uri) => workspaceIndex.onFileChanged(uri));
  headerWatcher.onDidDelete((uri) => workspaceIndex.onFileDeleted(uri));
  context.subscriptions.push(headerWatcher);

  // Register preview commands
  const openPreview = vscode.commands.registerCommand(
    "cnext.openPreview",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === "cnext") {
        previewProvider.show(editor.document, vscode.ViewColumn.Active);
      } else {
        vscode.window.showWarningMessage("C-Next: Open a .cnx file first");
      }
    },
  );

  const openPreviewToSide = vscode.commands.registerCommand(
    "cnext.openPreviewToSide",
    () => {
      const editor = vscode.window.activeTextEditor;
      if (editor?.document.languageId === "cnext") {
        previewProvider.show(editor.document, vscode.ViewColumn.Beside);
      } else {
        vscode.window.showWarningMessage("C-Next: Open a .cnx file first");
      }
    },
  );

  context.subscriptions.push(openPreview, openPreviewToSide);

  // Register completion provider
  const completionProvider = vscode.languages.registerCompletionItemProvider(
    "cnext",
    new CNextCompletionProvider(workspaceIndex, extensionContext),
    ".", // Trigger on dot for member access
  );
  context.subscriptions.push(completionProvider);

  // Register hover provider
  const hoverProvider = vscode.languages.registerHoverProvider(
    "cnext",
    new CNextHoverProvider(workspaceIndex, extensionContext),
  );
  context.subscriptions.push(hoverProvider);

  // Register definition provider (Ctrl+Click / F12)
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "cnext",
    new CNextDefinitionProvider(workspaceIndex),
  );
  context.subscriptions.push(definitionProvider);

  // Validate and transpile on document open
  if (vscode.window.activeTextEditor) {
    const doc = vscode.window.activeTextEditor.document;
    validateDocument(doc);
    transpileToFile(doc); // Immediate transpile on open
  }

  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor((editor) => {
      if (editor?.document.languageId === "cnext") {
        if (editorSwitchTimeout) {
          clearTimeout(editorSwitchTimeout);
        }
        editorSwitchTimeout = setTimeout(() => {
          validateDocument(editor.document);
          previewProvider.onActiveEditorChange(editor);
          transpileToFile(editor.document);
          editorSwitchTimeout = null;
        }, 150);
      }
    }),

    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "cnext") {
        // Debounce diagnostics
        if (validateTimeout) {
          clearTimeout(validateTimeout);
        }
        validateTimeout = setTimeout(() => {
          validateDocument(event.document);
        }, 300);

        // Update preview (has its own debouncing)
        previewProvider.onDocumentChange(event.document);

        // Generate .c file (debounced)
        scheduleTranspileToFile(event.document);
      }
    }),

    vscode.workspace.onDidCloseTextDocument((doc) => {
      diagnosticCollection.delete(doc.uri);
    }),

    // Scroll sync: update preview when cursor moves
    vscode.window.onDidChangeTextEditorSelection((event) => {
      if (event.textEditor.document.languageId === "cnext") {
        const line = event.selections[0].active.line + 1; // Convert to 1-based
        previewProvider.scrollToLine(line);
      }
    }),
  );
}

export function deactivate(): void {
  console.log("C-Next extension deactivated");

  // Clear any pending validation timeout
  if (validateTimeout) {
    clearTimeout(validateTimeout);
    validateTimeout = null;
  }

  // Clear any pending editor switch timeout
  if (editorSwitchTimeout) {
    clearTimeout(editorSwitchTimeout);
    editorSwitchTimeout = null;
  }

  // Clear all pending transpile timers
  for (const timer of transpileTimers.values()) {
    clearTimeout(timer);
  }
  transpileTimers.clear();

  if (diagnosticCollection) {
    diagnosticCollection.dispose();
  }
  if (workspaceIndex) {
    workspaceIndex.dispose();
  }
}
