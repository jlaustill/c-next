import * as vscode from "vscode";
import * as crypto from "node:crypto";
import CNextExtensionContext from "./ExtensionContext";

/**
 * Manages C-Next preview panels with live updates
 */
export default class PreviewProvider implements vscode.Disposable {
  private static instance: PreviewProvider | null = null;

  private panel: vscode.WebviewPanel | null = null;

  private currentDocument: vscode.TextDocument | null = null;

  private lastGoodCode: string = "";

  private lastError: string | null = null;

  private updateTimeout: NodeJS.Timeout | null = null;

  private disposables: vscode.Disposable[] = [];

  private statusBarItem: vscode.StatusBarItem;

  private extensionContext: CNextExtensionContext | null = null;

  private constructor() {
    // Create status bar item
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100,
    );
    this.statusBarItem.command = "workbench.actions.view.problems";
    this.updateStatusBar(true, 0);
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): PreviewProvider {
    if (!PreviewProvider.instance) {
      PreviewProvider.instance = new PreviewProvider();
    }
    return PreviewProvider.instance;
  }

  /**
   * Set the extension context for server communication
   */
  public setExtensionContext(context: CNextExtensionContext): void {
    this.extensionContext = context;
  }

  /**
   * Show preview for a document
   */
  public show(document: vscode.TextDocument, column: vscode.ViewColumn): void {
    this.currentDocument = document;

    if (this.panel) {
      // Reveal existing panel
      this.panel.reveal(column);
    } else {
      // Create new panel
      this.panel = vscode.window.createWebviewPanel(
        "cnextPreview",
        "C-Next Preview",
        column,
        {
          enableScripts: true,
          retainContextWhenHidden: true,
        },
      );

      // Handle panel disposal
      this.panel.onDidDispose(
        () => {
          this.panel = null;
          this.statusBarItem.hide();
        },
        null,
        this.disposables,
      );

      // Handle visibility changes
      this.panel.onDidChangeViewState(
        (e) => {
          if (e.webviewPanel.visible) {
            this.statusBarItem.show();
          } else {
            this.statusBarItem.hide();
          }
        },
        null,
        this.disposables,
      );
    }

    // Update title
    this.updateTitle();

    // Show status bar
    this.statusBarItem.show();

    // Initial render
    this.updatePreview();
  }

  /**
   * Handle document change with debouncing
   */
  public onDocumentChange(document: vscode.TextDocument): void {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    // Only update if this is the document we're previewing
    if (document.uri.toString() !== this.currentDocument.uri.toString()) {
      return;
    }

    // Get debounce delay from settings
    const config = vscode.workspace.getConfiguration("cnext");
    const delay = config.get<number>("preview.updateDelay", 300);

    // Clear existing timeout
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }

    // Schedule update
    this.updateTimeout = setTimeout(() => {
      this.updatePreview();
    }, delay);
  }

  /**
   * Handle active editor change
   */
  public onActiveEditorChange(editor: vscode.TextEditor | undefined): void {
    if (!this.panel) {
      return;
    }

    if (editor?.document.languageId === "cnext") {
      this.currentDocument = editor.document;
      this.updateTitle();
      this.updatePreview();
    }
  }

  /**
   * Scroll preview to show line corresponding to source line
   * Uses a simple 1:1 mapping (source line → generated line)
   */
  public scrollToLine(sourceLine: number): void {
    if (!this.panel) {
      return;
    }
    this.panel.webview.postMessage({
      type: "scrollToLine",
      line: sourceLine,
    });
  }

  /**
   * Update the preview panel content
   */
  private async updatePreview(): Promise<void> {
    if (!this.panel || !this.currentDocument) {
      return;
    }

    // Check if server is available
    const serverClient = this.extensionContext?.serverClient;
    if (!serverClient || !serverClient.isRunning()) {
      this.lastError = "Server not available";
      this.updateStatusBar(false, 1);
      this.panel.webview.html = this.getHtml(this.lastGoodCode, this.lastError);
      return;
    }

    try {
      const source = this.currentDocument.getText();
      const result = await serverClient.transpile(
        source,
        this.currentDocument.uri.fsPath,
      );

      if (result.success) {
        this.lastGoodCode = result.code;
        this.lastError = null;
        this.updateStatusBar(true, 0);
      } else {
        this.lastError = result.errors
          .map(
            (e: { line: number; column: number; message: string }) =>
              `Line ${e.line}:${e.column} - ${e.message}`,
          )
          .join("\n");
        this.updateStatusBar(false, result.errors.length);
      }

      this.panel.webview.html = this.getHtml(this.lastGoodCode, this.lastError);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.lastError = `Internal error: ${message}`;
      this.updateStatusBar(false, 1);
      if (this.panel) {
        this.panel.webview.html = this.getHtml(
          this.lastGoodCode,
          this.lastError,
        );
      }
      console.error("C-Next preview update failed:", error);
    }
  }

  /**
   * Update panel title with current file name
   */
  private updateTitle(): void {
    if (!this.panel || !this.currentDocument) {
      return;
    }
    const fileName =
      this.currentDocument.fileName.split("/").pop() || "Preview";
    this.panel.title = `C Preview: ${fileName}`;
  }

  /**
   * Update status bar item
   */
  private updateStatusBar(success: boolean, errorCount: number): void {
    if (success) {
      this.statusBarItem.text = "$(check) C-Next";
      this.statusBarItem.tooltip = "C-Next: No errors";
      this.statusBarItem.backgroundColor = undefined;
    } else {
      this.statusBarItem.text = `$(error) C-Next: ${errorCount} error${errorCount !== 1 ? "s" : ""}`;
      this.statusBarItem.tooltip = "C-Next: Click to view errors";
      this.statusBarItem.backgroundColor = new vscode.ThemeColor(
        "statusBarItem.errorBackground",
      );
    }
  }

  /**
   * Apply simple C syntax highlighting
   */
  private highlightC(code: string): string {
    // Escape HTML first
    let html = code
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Order matters - do strings/comments first to avoid highlighting inside them

    // Block comments /* */
    html = html.replace(
      /(\/\*[\s\S]*?\*\/)/g,
      '<span class="comment">$1</span>',
    );

    // Line comments //
    html = html.replace(/(\/\/.*$)/gm, '<span class="comment">$1</span>');

    // Strings
    html = html.replace(
      /("(?:[^"\\]|\\.)*")/g,
      '<span class="string">$1</span>',
    );

    // Character literals
    html = html.replace(
      /('(?:[^'\\]|\\.)*')/g,
      '<span class="string">$1</span>',
    );

    // Preprocessor directives
    html = html.replace(
      /^(\s*#\s*\w+)/gm,
      '<span class="preprocessor">$1</span>',
    );

    // Keywords
    const keywords =
      /\b(if|else|for|while|do|switch|case|default|break|continue|return|goto|sizeof|typedef|struct|union|enum|const|volatile|static|extern|inline|void|register)\b/g;
    html = html.replace(keywords, '<span class="keyword">$1</span>');

    // Types
    const types =
      /\b(int|char|short|long|float|double|signed|unsigned|bool|uint8_t|uint16_t|uint32_t|uint64_t|int8_t|int16_t|int32_t|int64_t|size_t)\b/g;
    html = html.replace(types, '<span class="type">$1</span>');

    // Numbers (hex, binary, decimal, float)
    html = html.replace(
      /\b(0[xX][0-9a-fA-F]+|0[bB][01]+|\d+\.?\d*[fF]?|\d+[uUlL]*)\b/g,
      '<span class="number">$1</span>',
    );

    // Function calls (word followed by parenthesis)
    html = html.replace(
      /\b([a-zA-Z_]\w*)\s*(?=\()/g,
      '<span class="function">$1</span>',
    );

    return html;
  }

  /**
   * Generate a cryptographic nonce for CSP
   */
  private getNonce(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  /**
   * Generate HTML for the webview
   */
  private getHtml(code: string, error: string | null): string {
    const nonce = this.getNonce();
    const config = vscode.workspace.getConfiguration("cnext");
    const showLineNumbers = config.get<boolean>(
      "preview.showLineNumbers",
      true,
    );

    // Apply syntax highlighting
    const highlightedCode = this.highlightC(code);

    // Add line numbers and data-line attributes for scroll sync
    let codeHtml: string;
    if (code) {
      const lines = highlightedCode.split("\n");
      codeHtml = lines
        .map((line, i) => {
          const lineNum = i + 1;
          const lineNumStr = showLineNumbers
            ? `<span class="line-number">${String(lineNum).padStart(4, " ")}</span>`
            : "";
          return `<div class="code-line" data-line="${lineNum}">${lineNumStr}${line}</div>`;
        })
        .join("");
    } else {
      codeHtml = highlightedCode;
    }

    const errorBanner = error
      ? `<div class="error-banner">
                <span class="error-icon">$(error)</span>
                <span>Parse Error - showing last successful output</span>
               </div>
               <pre class="error-details">${error.replace(/</g, "&lt;").replace(/>/g, "&gt;")}</pre>`
      : "";

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}';">
    <title>C-Next Preview</title>
    <style nonce="${nonce}">
        * {
            box-sizing: border-box;
            background: none;
        }
        /* Dark theme (default) */
        body {
            font-family: var(--vscode-editor-font-family, Consolas, 'Courier New', monospace);
            font-size: var(--vscode-editor-font-size, 14px);
            line-height: 1.5;
            background: #1e1e1e;
            color: #d4d4d4;
            padding: 0;
            margin: 0;
        }
        /* Light theme */
        body.vscode-light {
            background: #ffffff;
            color: #000000;
        }
        /* High contrast */
        body.vscode-high-contrast {
            background: #000000;
            color: #ffffff;
        }
        .header {
            color: #858585;
            padding: 8px 16px;
            border-bottom: 1px solid #454545;
            font-size: 12px;
            font-weight: 500;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            background: none;
        }
        body.vscode-light .header {
            color: #6e6e6e;
            border-color: #e0e0e0;
        }
        .error-banner {
            background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            border: 1px solid var(--vscode-inputValidation-errorBorder, #be1100);
            color: var(--vscode-errorForeground, #f48771);
            padding: 8px 16px;
            display: flex;
            align-items: center;
            gap: 8px;
        }
        .error-icon {
            font-size: 16px;
        }
        .error-details {
            background-color: var(--vscode-inputValidation-errorBackground, #5a1d1d);
            color: var(--vscode-errorForeground, #f48771);
            padding: 8px 16px;
            margin: 0;
            font-size: 12px;
            border-bottom: 1px solid var(--vscode-panel-border);
            white-space: pre-wrap;
        }
        .code-container {
            padding: 16px;
            overflow: auto;
        }
        pre {
            margin: 0;
            white-space: pre;
            tab-size: 4;
        }
        code {
            font-family: inherit;
            color: #d4d4d4;
            display: block;
        }
        body.vscode-light code {
            color: #000000;
        }
        /* Default span color inherits from code */
        code span {
            color: inherit;
        }
        .code-line {
            min-height: 1.5em;
            white-space: pre;
        }
        .code-line.highlight {
            background-color: rgba(255, 255, 0, 0.1);
        }
        body.vscode-light .code-line.highlight {
            background-color: rgba(255, 255, 0, 0.2);
        }
        .line-number {
            color: #858585;
            margin-right: 16px;
            user-select: none;
            display: inline-block;
            text-align: right;
            min-width: 3em;
        }
        /* C syntax highlighting - dark theme */
        code .keyword { color: #569cd6 !important; }
        code .type { color: #4ec9b0 !important; }
        code .number { color: #b5cea8 !important; }
        code .string { color: #ce9178 !important; }
        code .comment { color: #6a9955 !important; font-style: italic; }
        code .preprocessor { color: #c586c0 !important; }
        code .function { color: #dcdcaa !important; }
        /* Light theme overrides */
        body.vscode-light code .keyword { color: #0000ff !important; }
        body.vscode-light code .type { color: #267f99 !important; }
        body.vscode-light code .number { color: #098658 !important; }
        body.vscode-light code .string { color: #a31515 !important; }
        body.vscode-light code .comment { color: #008000 !important; }
        body.vscode-light code .preprocessor { color: #af00db !important; }
        body.vscode-light code .function { color: #795e26 !important; }
        body.vscode-light .line-number { color: #237893; }
    </style>
</head>
<body>
    <div class="header">Generated C Code</div>
    ${errorBanner}
    <div class="code-container">
        <pre><code>${codeHtml}</code></pre>
    </div>
    <script nonce="${nonce}">
        // Handle scroll sync messages from extension
        window.addEventListener('message', event => {
            const message = event.data;
            if (message.type === 'scrollToLine') {
                const line = message.line;
                // Remove previous highlight
                document.querySelectorAll('.code-line.highlight').forEach(el => {
                    el.classList.remove('highlight');
                });
                // Find and scroll to line
                const lineElement = document.querySelector('.code-line[data-line="' + line + '"]');
                if (lineElement) {
                    lineElement.classList.add('highlight');
                    lineElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
        });
    </script>
</body>
</html>`;
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.updateTimeout) {
      clearTimeout(this.updateTimeout);
    }
    if (this.panel) {
      this.panel.dispose();
    }
    this.statusBarItem.dispose();
    this.disposables.forEach((d) => d.dispose());
    PreviewProvider.instance = null;
  }
}
