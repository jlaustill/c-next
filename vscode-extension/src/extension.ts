import * as vscode from 'vscode';
import { transpile, ITranspileResult, ITranspileError } from '../../dist/lib/transpiler.js';
import PreviewProvider from './previewProvider.js';

// Re-export for use by other modules
export { transpile, ITranspileResult, ITranspileError };

let diagnosticCollection: vscode.DiagnosticCollection;
let previewProvider: PreviewProvider;

export function activate(context: vscode.ExtensionContext): void {
    console.log('C-Next extension activated');

    // Create diagnostic collection for errors
    diagnosticCollection = vscode.languages.createDiagnosticCollection('cnext');
    context.subscriptions.push(diagnosticCollection);

    // Create preview provider
    previewProvider = PreviewProvider.getInstance();
    context.subscriptions.push(previewProvider);

    // Register preview commands
    const openPreview = vscode.commands.registerCommand('cnext.openPreview', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'cnext') {
            previewProvider.show(editor.document, vscode.ViewColumn.Active);
        } else {
            vscode.window.showWarningMessage('C-Next: Open a .cnx file first');
        }
    });

    const openPreviewToSide = vscode.commands.registerCommand('cnext.openPreviewToSide', () => {
        const editor = vscode.window.activeTextEditor;
        if (editor && editor.document.languageId === 'cnext') {
            previewProvider.show(editor.document, vscode.ViewColumn.Beside);
        } else {
            vscode.window.showWarningMessage('C-Next: Open a .cnx file first');
        }
    });

    context.subscriptions.push(openPreview, openPreviewToSide);

    // Validate on document open
    if (vscode.window.activeTextEditor) {
        validateDocument(vscode.window.activeTextEditor.document);
    }

    // Document change handler with debouncing for diagnostics
    let validateTimeout: NodeJS.Timeout | null = null;

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor && editor.document.languageId === 'cnext') {
                validateDocument(editor.document);
                previewProvider.onActiveEditorChange(editor);
            }
        }),

        vscode.workspace.onDidChangeTextDocument(event => {
            if (event.document.languageId === 'cnext') {
                // Debounce diagnostics
                if (validateTimeout) {
                    clearTimeout(validateTimeout);
                }
                validateTimeout = setTimeout(() => {
                    validateDocument(event.document);
                }, 300);

                // Update preview (has its own debouncing)
                previewProvider.onDocumentChange(event.document);
            }
        }),

        vscode.workspace.onDidCloseTextDocument(doc => {
            diagnosticCollection.delete(doc.uri);
        })
    );
}

/**
 * Validate a C-Next document and update diagnostics
 */
function validateDocument(document: vscode.TextDocument): void {
    if (document.languageId !== 'cnext') {
        return;
    }

    const source = document.getText();
    const result = transpile(source, { parseOnly: true });

    const diagnostics: vscode.Diagnostic[] = result.errors.map(error => {
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
            endColumn
        );

        const diagnostic = new vscode.Diagnostic(
            range,
            error.message,
            error.severity === 'error'
                ? vscode.DiagnosticSeverity.Error
                : vscode.DiagnosticSeverity.Warning
        );
        diagnostic.source = 'C-Next';
        return diagnostic;
    });

    diagnosticCollection.set(document.uri, diagnostics);
}

export function deactivate(): void {
    console.log('C-Next extension deactivated');
    if (diagnosticCollection) {
        diagnosticCollection.dispose();
    }
}
