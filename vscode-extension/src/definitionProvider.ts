import * as vscode from 'vscode';
import * as fs from 'fs';
import { parseWithSymbols, ISymbolInfo } from '../../dist/lib/transpiler.js';
import WorkspaceIndex from './workspace/WorkspaceIndex.js';

/**
 * Extended symbol info that includes source file path
 */
interface ISymbolWithFile extends ISymbolInfo {
    sourceFile?: string;
}

/**
 * C-Next Definition Provider
 * Provides "Go to Definition" support for C-Next source files
 * Supports cross-file navigation via WorkspaceIndex
 */
export default class CNextDefinitionProvider implements vscode.DefinitionProvider {
    constructor(private workspaceIndex?: WorkspaceIndex) {}

    /**
     * Provide definition location for the symbol at the given position
     */
    provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Definition | null {
        // Get the word at the cursor position
        const wordRange = document.getWordRangeAtPosition(position, /[a-zA-Z_][a-zA-Z0-9_]*/);
        if (!wordRange) {
            return null;
        }

        const word = document.getText(wordRange);
        const lineText = document.lineAt(position).text;
        const charBefore = wordRange.start.character > 0
            ? lineText.charAt(wordRange.start.character - 1)
            : '';

        // Check if this is a member access (word after a dot)
        let parentName: string | undefined;
        if (charBefore === '.') {
            // Find the word before the dot
            const beforeDot = lineText.substring(0, wordRange.start.character - 1);
            const parentMatch = beforeDot.match(/(\w+)$/);
            if (parentMatch) {
                parentName = parentMatch[1];
            }
        }

        // FAST PATH: Check current document first
        const localSymbol = this.findLocalSymbol(document, word, parentName);
        if (localSymbol) {
            return this.createLocation(document.uri, localSymbol, document);
        }

        // CROSS-FILE: Check workspace index
        if (this.workspaceIndex) {
            const workspaceSymbol = this.workspaceIndex.findDefinition(word, document.uri) as ISymbolWithFile;
            if (workspaceSymbol && workspaceSymbol.sourceFile) {
                const targetUri = vscode.Uri.file(workspaceSymbol.sourceFile);
                return this.createLocationFromFile(targetUri, workspaceSymbol);
            }
        }

        return null;
    }

    /**
     * Find a symbol in the current document
     */
    private findLocalSymbol(
        document: vscode.TextDocument,
        word: string,
        parentName?: string
    ): ISymbolInfo | undefined {
        const source = document.getText();
        const parseResult = parseWithSymbols(source);
        const symbols = parseResult.symbols;

        if (parentName) {
            // Looking for a member of parentName
            return symbols.find(s => s.name === word && s.parent === parentName);
        }

        // Looking for a top-level symbol or any symbol with this name
        let symbol = symbols.find(s => s.name === word && !s.parent);
        if (!symbol) {
            symbol = symbols.find(s => s.fullName === word);
        }
        if (!symbol) {
            symbol = symbols.find(s => s.name === word);
        }

        return symbol;
    }

    /**
     * Create a location for a symbol in the current document
     */
    private createLocation(
        uri: vscode.Uri,
        symbol: ISymbolInfo,
        document: vscode.TextDocument
    ): vscode.Location | null {
        if (!symbol.line) {
            return null;
        }

        const definitionLine = symbol.line - 1; // Convert to 0-based

        // Try to find the exact column of the symbol name on that line
        const defLineText = document.lineAt(definitionLine).text;
        const nameIndex = defLineText.indexOf(symbol.name);

        if (nameIndex >= 0) {
            const startPos = new vscode.Position(definitionLine, nameIndex);
            const endPos = new vscode.Position(definitionLine, nameIndex + symbol.name.length);
            return new vscode.Location(uri, new vscode.Range(startPos, endPos));
        }

        return new vscode.Location(uri, new vscode.Position(definitionLine, 0));
    }

    /**
     * Create a location for a symbol in another file (cross-file navigation)
     */
    private createLocationFromFile(
        uri: vscode.Uri,
        symbol: ISymbolWithFile
    ): vscode.Location | null {
        if (!symbol.line) {
            return null;
        }

        const definitionLine = symbol.line - 1; // Convert to 0-based

        try {
            // Read the target file to find exact column
            const content = fs.readFileSync(uri.fsPath, 'utf-8');
            const lines = content.split('\n');

            if (definitionLine < lines.length) {
                const defLineText = lines[definitionLine];
                const nameIndex = defLineText.indexOf(symbol.name);

                if (nameIndex >= 0) {
                    const startPos = new vscode.Position(definitionLine, nameIndex);
                    const endPos = new vscode.Position(definitionLine, nameIndex + symbol.name.length);
                    return new vscode.Location(uri, new vscode.Range(startPos, endPos));
                }
            }
        } catch {
            // File read error - return position at start of line
        }

        return new vscode.Location(uri, new vscode.Position(definitionLine, 0));
    }
}
