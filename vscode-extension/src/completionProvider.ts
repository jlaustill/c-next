import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import {
    parseWithSymbols,
    ISymbolInfo,
    TSymbolKind
} from '../../dist/lib/transpiler.js';
import WorkspaceIndex from './workspace/WorkspaceIndex.js';
import { lastGoodOutputPath } from './extension.js';

/**
 * C-Next keywords for autocomplete
 */
const KEYWORDS = [
    'register', 'namespace', 'class', 'struct', 'enum',
    'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'default',
    'break', 'continue', 'return', 'goto',
    'const', 'volatile', 'static', 'extern', 'inline',
    'typedef', 'sizeof'
];

/**
 * C-Next primitive types
 */
const TYPES = [
    'u8', 'u16', 'u32', 'u64',
    'i8', 'i16', 'i32', 'i64',
    'f32', 'f64',
    'bool', 'void'
];

/**
 * Register access modifiers
 */
const ACCESS_MODIFIERS = ['rw', 'ro', 'wo', 'w1c', 'w1s'];

/**
 * Boolean literals
 */
const BOOL_LITERALS = ['true', 'false'];

/**
 * Common Arduino symbols that might not be returned by executeCompletionItemProvider
 * These serve as a fallback to ensure essential Arduino functions appear
 */
const ARDUINO_GLOBALS: Array<{name: string, kind: vscode.CompletionItemKind, detail: string}> = [
    { name: 'Serial', kind: vscode.CompletionItemKind.Variable, detail: 'USB serial port (usb_serial_class)' },
    { name: 'Serial1', kind: vscode.CompletionItemKind.Variable, detail: 'Hardware serial port 1' },
    { name: 'Serial2', kind: vscode.CompletionItemKind.Variable, detail: 'Hardware serial port 2' },
    { name: 'pinMode', kind: vscode.CompletionItemKind.Function, detail: 'void pinMode(uint8_t pin, uint8_t mode)' },
    { name: 'digitalWrite', kind: vscode.CompletionItemKind.Function, detail: 'void digitalWrite(uint8_t pin, uint8_t val)' },
    { name: 'digitalRead', kind: vscode.CompletionItemKind.Function, detail: 'int digitalRead(uint8_t pin)' },
    { name: 'analogRead', kind: vscode.CompletionItemKind.Function, detail: 'int analogRead(uint8_t pin)' },
    { name: 'analogWrite', kind: vscode.CompletionItemKind.Function, detail: 'void analogWrite(uint8_t pin, int val)' },
    { name: 'delay', kind: vscode.CompletionItemKind.Function, detail: 'void delay(uint32_t msec)' },
    { name: 'delayMicroseconds', kind: vscode.CompletionItemKind.Function, detail: 'void delayMicroseconds(uint32_t usec)' },
    { name: 'millis', kind: vscode.CompletionItemKind.Function, detail: 'uint32_t millis(void)' },
    { name: 'micros', kind: vscode.CompletionItemKind.Function, detail: 'uint32_t micros(void)' },
    { name: 'HIGH', kind: vscode.CompletionItemKind.Constant, detail: 'Digital HIGH (1)' },
    { name: 'LOW', kind: vscode.CompletionItemKind.Constant, detail: 'Digital LOW (0)' },
    { name: 'INPUT', kind: vscode.CompletionItemKind.Constant, detail: 'Pin mode INPUT' },
    { name: 'OUTPUT', kind: vscode.CompletionItemKind.Constant, detail: 'Pin mode OUTPUT' },
    { name: 'INPUT_PULLUP', kind: vscode.CompletionItemKind.Constant, detail: 'Pin mode INPUT with internal pull-up' },
    { name: 'INPUT_PULLDOWN', kind: vscode.CompletionItemKind.Constant, detail: 'Pin mode INPUT with internal pull-down' },
    { name: 'LED_BUILTIN', kind: vscode.CompletionItemKind.Constant, detail: 'Built-in LED pin number' },
];

/**
 * Map symbol kind to VS Code completion item kind
 */
function mapToCompletionKind(kind: TSymbolKind): vscode.CompletionItemKind {
    switch (kind) {
        case 'namespace':
            return vscode.CompletionItemKind.Module;
        case 'class':
            return vscode.CompletionItemKind.Class;
        case 'struct':
            return vscode.CompletionItemKind.Struct;
        case 'register':
            return vscode.CompletionItemKind.Module;
        case 'function':
        case 'method':
            return vscode.CompletionItemKind.Function;
        case 'variable':
        case 'field':
            return vscode.CompletionItemKind.Variable;
        case 'registerMember':
            return vscode.CompletionItemKind.Field;
        default:
            return vscode.CompletionItemKind.Text;
    }
}

/**
 * Create a completion item from a symbol
 */
function createSymbolCompletion(symbol: ISymbolInfo): vscode.CompletionItem {
    const item = new vscode.CompletionItem(symbol.name, mapToCompletionKind(symbol.kind));

    // Build detail string
    if (symbol.kind === 'function' || symbol.kind === 'method') {
        item.detail = symbol.signature || `${symbol.type || 'void'} ${symbol.name}()`;
        item.insertText = symbol.name + (symbol.kind === 'function' ? '()' : '()');
    } else if (symbol.kind === 'registerMember') {
        const access = symbol.accessModifier || 'rw';
        item.detail = `${symbol.type || 'u32'} ${access}`;
        item.documentation = new vscode.MarkdownString(
            `**Register member** \`${symbol.fullName}\`\n\n` +
            `Access: ${getAccessDescription(access)}`
        );
    } else if (symbol.kind === 'variable' || symbol.kind === 'field') {
        item.detail = symbol.type || 'unknown';
    } else {
        item.detail = symbol.kind;
    }

    return item;
}

/**
 * Get human-readable access modifier description
 */
function getAccessDescription(access: string): string {
    switch (access) {
        case 'rw': return 'read-write';
        case 'ro': return 'read-only';
        case 'wo': return 'write-only';
        case 'w1c': return 'write-1-to-clear';
        case 'w1s': return 'write-1-to-set';
        default: return access;
    }
}

/**
 * C-Next Completion Provider
 * Provides context-aware autocomplete for C-Next source files
 * Queries C/C++ extension for stdlib and Arduino completions via generated .c/.cpp files
 */
export default class CNextCompletionProvider implements vscode.CompletionItemProvider {
    constructor(private workspaceIndex?: WorkspaceIndex) {}

    /**
     * Find the output file path (.c or .cpp) for a .cnx document
     * Uses cache if current files don't exist (allows completions during parse errors)
     */
    private findOutputPath(document: vscode.TextDocument): string | null {
        const cnxPath = document.uri.fsPath;

        // Check for .cpp first (PlatformIO/Arduino projects often use .cpp)
        const cppPath = cnxPath.replace(/\.cnx$/, '.cpp');
        if (fs.existsSync(cppPath)) {
            return cppPath;
        }

        // Check for .c
        const cPath = cnxPath.replace(/\.cnx$/, '.c');
        if (fs.existsSync(cPath)) {
            return cPath;
        }

        // Neither exists - check the cache for last-known-good path
        const cachedPath = lastGoodOutputPath.get(document.uri.toString());
        if (cachedPath && fs.existsSync(cachedPath)) {
            return cachedPath;
        }

        return null;
    }

    /**
     * Provide completion items for the given position
     */
    async provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        context: vscode.CompletionContext
    ): Promise<vscode.CompletionItem[]> {
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.substring(0, position.character);

        console.log(`C-Next: provideCompletionItems called, linePrefix="${linePrefix}"`);

        // Parse document to get symbols
        const source = document.getText();
        const parseResult = parseWithSymbols(source);
        const symbols = parseResult.symbols;

        // Check for member access context (after a dot)
        const memberMatch = linePrefix.match(/(\w+)\.\s*(\w*)$/);
        if (memberMatch) {
            const parentName = memberMatch[1];

            // Get C-Next member completions
            const cnextMembers = this.getMemberCompletions(symbols, parentName);

            // If we found C-Next members, use ONLY those (e.g., GPIO7_CNX.DR)
            // This prevents polluting register completions with C/C++ noise
            if (cnextMembers.length > 0) {
                return cnextMembers;
            }

            // No C-Next members found - fall back to C/C++ extension (e.g., Serial.begin)
            // Pass parentName so we can find the correct position in the output file
            const cppMembers = await this.queryCExtensionCompletions(document, position, context, parentName);
            return cppMembers;
        }

        // Check if we're in a register member context (after access modifier)
        if (this.isInRegisterContext(linePrefix)) {
            return this.getAccessModifierCompletions();
        }

        // Check if we're in a type context
        if (this.isInTypeContext(linePrefix)) {
            return this.getTypeCompletions();
        }

        // Default: return all top-level symbols + keywords + types + header symbols
        const cnextCompletions = this.getGlobalCompletions(symbols, document.uri);
        console.log(`C-Next: Got ${cnextCompletions.length} C-Next completions`);

        // Get the current word prefix for filtering C/C++ completions
        const wordMatch = linePrefix.match(/(\w+)$/);
        const prefix = wordMatch ? wordMatch[1].toLowerCase() : '';
        console.log(`C-Next: Word prefix="${prefix}", length=${prefix.length}`);

        // Only query C/C++ if user has typed at least 2 characters (reduces noise)
        if (prefix.length >= 2) {
            console.log(`C-Next: Querying C/C++ extension for prefix "${prefix}"`);
            const cppCompletions = await this.queryCExtensionGlobalCompletions(document, prefix);
            console.log(`C-Next: Got ${cppCompletions.length} C/C++ completions`);
            const merged = this.mergeCompletions(cnextCompletions, cppCompletions);
            console.log(`C-Next: Returning ${merged.length} total completions`);
            return merged;
        }

        console.log(`C-Next: Prefix too short, returning only C-Next completions`);
        return cnextCompletions;
    }

    /**
     * Get completions for member access (after a dot)
     */
    private getMemberCompletions(symbols: ISymbolInfo[], parentName: string): vscode.CompletionItem[] {
        // Find all symbols with this parent
        const members = symbols.filter(s => s.parent === parentName);

        if (members.length > 0) {
            return members.map(createSymbolCompletion);
        }

        // Check if parentName is a known namespace/class/register
        const parentSymbol = symbols.find(s => s.name === parentName && !s.parent);
        if (parentSymbol) {
            // Find members by parent
            const memberSymbols = symbols.filter(s => s.parent === parentName);
            return memberSymbols.map(createSymbolCompletion);
        }

        return [];
    }

    /**
     * Get completions for register access modifiers
     */
    private getAccessModifierCompletions(): vscode.CompletionItem[] {
        return ACCESS_MODIFIERS.map(mod => {
            const item = new vscode.CompletionItem(mod, vscode.CompletionItemKind.Keyword);
            item.detail = getAccessDescription(mod);
            return item;
        });
    }

    /**
     * Get completions for type contexts
     */
    private getTypeCompletions(): vscode.CompletionItem[] {
        return TYPES.map(type => {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = 'C-Next type';
            return item;
        });
    }

    /**
     * Get global completions (keywords, types, top-level symbols, header symbols)
     */
    private getGlobalCompletions(symbols: ISymbolInfo[], documentUri?: vscode.Uri): vscode.CompletionItem[] {
        const items: vscode.CompletionItem[] = [];

        // Add keywords
        for (const keyword of KEYWORDS) {
            const item = new vscode.CompletionItem(keyword, vscode.CompletionItemKind.Keyword);
            item.detail = 'keyword';
            items.push(item);
        }

        // Add types
        for (const type of TYPES) {
            const item = new vscode.CompletionItem(type, vscode.CompletionItemKind.TypeParameter);
            item.detail = 'type';
            items.push(item);
        }

        // Add boolean literals
        for (const lit of BOOL_LITERALS) {
            const item = new vscode.CompletionItem(lit, vscode.CompletionItemKind.Constant);
            item.detail = 'bool';
            items.push(item);
        }

        // Add top-level symbols (no parent)
        const topLevel = symbols.filter(s => !s.parent);
        for (const sym of topLevel) {
            items.push(createSymbolCompletion(sym));
        }

        // Add symbols from included headers
        if (this.workspaceIndex && documentUri) {
            const headerSymbols = this.workspaceIndex.getIncludedSymbols(documentUri);
            for (const sym of headerSymbols) {
                const item = createSymbolCompletion(sym);
                // Mark as coming from a header
                if (sym.sourceFile) {
                    item.detail = `${item.detail || ''} (${path.basename(sym.sourceFile)})`;
                }
                items.push(item);
            }
        }

        return items;
    }

    /**
     * Check if cursor is in a register member definition context
     */
    private isInRegisterContext(linePrefix: string): boolean {
        // Inside register block, after type declaration
        // e.g., "    DR: u32 " <- expecting access modifier
        return /^\s+\w+\s*:\s*\w+\s+$/.test(linePrefix);
    }

    /**
     * Check if cursor is in a type context
     */
    private isInTypeContext(linePrefix: string): boolean {
        // After colon in register member: "DR: "
        if (/:\s*$/.test(linePrefix)) {
            return true;
        }
        // At start of variable declaration (simplified check)
        if (/^\s*$/.test(linePrefix)) {
            return true;
        }
        return false;
    }

    /**
     * Query the C/C++ extension for completions via the generated .c/.cpp file
     * This gives us Arduino functions, stdlib functions, etc. automatically
     *
     * @param parentName For member access (e.g., "Serial" for "Serial."), search for this in output file
     */
    private async queryCExtensionCompletions(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.CompletionContext,
        parentName?: string
    ): Promise<vscode.CompletionItem[]> {
        // Find the output file (uses cache if current file has parse errors)
        const outputPath = this.findOutputPath(document);
        if (!outputPath) {
            return [];
        }

        try {
            const outputUri = vscode.Uri.file(outputPath);
            let queryPosition = position;

            // For member access, find the parent symbol in the output file
            // This handles line number mismatches between .cnx and output
            if (parentName) {
                const outputSource = fs.readFileSync(outputPath, 'utf-8');
                const memberPosition = this.findMemberAccessPosition(outputSource, parentName);
                console.log(`C-Next: Looking for "${parentName}." in output file`);
                if (memberPosition) {
                    queryPosition = memberPosition;
                    console.log(`C-Next: Found "${parentName}." at ${memberPosition.line}:${memberPosition.character}`);
                } else {
                    console.log(`C-Next: "${parentName}." not found in output file`);
                    // Parent not found in output - can't provide completions
                    return [];
                }
            }

            // Query the C/C++ extension's completion provider
            const completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                outputUri,
                queryPosition,
                context.triggerCharacter || '.'
            );

            console.log(`C-Next: Member completion query returned ${completionList?.items?.length || 0} items`);

            if (completionList && completionList.items) {
                // Log first few items for debugging
                const firstFew = completionList.items.slice(0, 5).map(i =>
                    typeof i.label === 'string' ? i.label : i.label.label
                );
                console.log(`C-Next: First 5 member completions: ${firstFew.join(', ')}`);

                // Mark items as coming from C/C++ extension
                return completionList.items.map(item => {
                    // Clone the item to avoid modifying the original
                    const newItem = new vscode.CompletionItem(
                        typeof item.label === 'string' ? item.label : item.label.label,
                        item.kind
                    );
                    newItem.detail = item.detail;
                    newItem.documentation = item.documentation;
                    newItem.insertText = item.insertText;
                    newItem.filterText = item.filterText;
                    newItem.sortText = item.sortText;
                    newItem.preselect = item.preselect;
                    // Add a marker to show this came from C/C++
                    if (!newItem.detail) {
                        newItem.detail = '(C/C++)';
                    }
                    return newItem;
                });
            }
        } catch (err) {
            // Silently fail - C/C++ extension might not be installed
            console.error('C-Next: Failed to query C/C++ completions:', err);
        }

        return [];
    }

    /**
     * Query C/C++ extension for global completions (e.g., Serial, pinMode, delay)
     * Queries at a position after includes and filters by prefix
     */
    private async queryCExtensionGlobalCompletions(
        document: vscode.TextDocument,
        prefix: string
    ): Promise<vscode.CompletionItem[]> {
        console.log(`C-Next: queryCExtensionGlobalCompletions called with prefix="${prefix}"`);

        // Find the output file (uses cache if current file has parse errors)
        const outputPath = this.findOutputPath(document);
        console.log(`C-Next: findOutputPath returned: ${outputPath}`);
        if (!outputPath) {
            console.log('C-Next: No output path found, returning empty');
            return [];
        }

        try {
            const outputUri = vscode.Uri.file(outputPath);

            // Open the document to ensure C/C++ extension has it indexed
            const outputDoc = await vscode.workspace.openTextDocument(outputUri);
            const outputSource = outputDoc.getText();

            // Find a position inside a function body where global objects are valid
            const queryPosition = this.findPositionInsideFunction(outputSource);
            console.log(`C-Next: Querying C/C++ at position ${queryPosition.line}:${queryPosition.character}`);

            // Query C/C++ extension with trigger character to simulate typing
            const completionList = await vscode.commands.executeCommand<vscode.CompletionList>(
                'vscode.executeCompletionItemProvider',
                outputUri,
                queryPosition,
                prefix.charAt(0)  // Pass first char as trigger
            );

            console.log(`C-Next: C/C++ returned ${completionList?.items?.length || 0} items`);

            const allItems: vscode.CompletionItem[] = [];

            if (completionList && completionList.items) {
                // Log ALL items to a file for debugging
                const allLabels = completionList.items.map(item =>
                    typeof item.label === 'string' ? item.label : item.label.label
                );
                // Write to temp file for inspection
                const debugPath = '/tmp/cnext-completions.txt';
                fs.writeFileSync(debugPath, allLabels.join('\n'), 'utf-8');
                console.log(`C-Next: Wrote ${allLabels.length} items to ${debugPath}`);

                // Check if Serial is in the list
                const hasSerial = allLabels.some(l => l.toLowerCase().includes('serial'));
                console.log(`C-Next: Contains 'serial': ${hasSerial}`);

                // Add filtered completion items
                for (const item of completionList.items) {
                    const label = typeof item.label === 'string' ? item.label : item.label.label;
                    if (label.toLowerCase().startsWith(prefix)) {
                        const newItem = new vscode.CompletionItem(label, item.kind);
                        newItem.detail = item.detail || '(C/C++)';
                        newItem.documentation = item.documentation;
                        newItem.insertText = item.insertText;
                        allItems.push(newItem);
                    }
                }
            }

            // Also query workspace symbols to find globals like Serial
            console.log(`C-Next: Querying workspace symbols for "${prefix}"`);
            const symbols = await vscode.commands.executeCommand<vscode.SymbolInformation[]>(
                'vscode.executeWorkspaceSymbolProvider',
                prefix
            );

            // Write workspace symbols to separate debug file
            const wsDebugPath = '/tmp/cnext-workspace-symbols.txt';
            if (symbols && symbols.length > 0) {
                console.log(`C-Next: Found ${symbols.length} workspace symbols`);
                const symbolDetails = symbols.map(s => `${s.name} (${vscode.SymbolKind[s.kind]}) - ${s.location.uri.fsPath}`);
                fs.writeFileSync(wsDebugPath, symbolDetails.join('\n'), 'utf-8');
                console.log(`C-Next: Wrote workspace symbols to ${wsDebugPath}`);
                const symbolLabels = symbols.slice(0, 10).map(s => s.name);
                console.log(`C-Next: First 10 workspace symbols: ${symbolLabels.join(', ')}`);

                // Add symbols that aren't already in completions
                const existingLabels = new Set(allItems.map(i =>
                    typeof i.label === 'string' ? i.label : i.label.label
                ));

                for (const sym of symbols) {
                    if (!existingLabels.has(sym.name) && sym.name.toLowerCase().startsWith(prefix)) {
                        const kind = this.mapSymbolKindToCompletionKind(sym.kind);
                        const item = new vscode.CompletionItem(sym.name, kind);
                        item.detail = `(${vscode.SymbolKind[sym.kind]})`;
                        allItems.push(item);
                    }
                }
            }

            // Add Arduino globals as fallback if they match prefix
            // These ensure essential Arduino symbols appear even if C/C++ extension doesn't return them
            const existingLabels = new Set(allItems.map(i =>
                typeof i.label === 'string' ? i.label : i.label.label
            ));

            for (const arduino of ARDUINO_GLOBALS) {
                if (arduino.name.toLowerCase().startsWith(prefix) && !existingLabels.has(arduino.name)) {
                    const item = new vscode.CompletionItem(arduino.name, arduino.kind);
                    item.detail = arduino.detail;
                    allItems.push(item);
                    console.log(`C-Next: Added Arduino fallback: ${arduino.name}`);
                }
            }

            // Limit results
            const limited = allItems.slice(0, 30);
            console.log(`C-Next: Returning ${limited.length} total items`);
            return limited;
        } catch (err) {
            console.error('C-Next: Failed to query C/C++ global completions:', err);
        }

        return [];
    }

    /**
     * Map VS Code SymbolKind to CompletionItemKind
     */
    private mapSymbolKindToCompletionKind(kind: vscode.SymbolKind): vscode.CompletionItemKind {
        switch (kind) {
            case vscode.SymbolKind.Class:
                return vscode.CompletionItemKind.Class;
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method:
                return vscode.CompletionItemKind.Function;
            case vscode.SymbolKind.Variable:
            case vscode.SymbolKind.Field:
                return vscode.CompletionItemKind.Variable;
            case vscode.SymbolKind.Constant:
                return vscode.CompletionItemKind.Constant;
            case vscode.SymbolKind.Struct:
                return vscode.CompletionItemKind.Struct;
            case vscode.SymbolKind.Enum:
                return vscode.CompletionItemKind.Enum;
            case vscode.SymbolKind.Module:
            case vscode.SymbolKind.Namespace:
                return vscode.CompletionItemKind.Module;
            default:
                return vscode.CompletionItemKind.Variable;
        }
    }

    /**
     * Find a position inside a function body where global objects like Serial are valid
     * Returns position at the START of a line inside a function body (where new statements go)
     */
    private findPositionInsideFunction(source: string): vscode.Position {
        const lines = source.split('\n');

        // Strategy: Find a function body and position at the start of an indented line
        // This simulates where a user would type a new statement
        let inFunction = false;
        let braceDepth = 0;

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const trimmed = line.trim();

            // Track function entry
            if (trimmed.match(/^(void|int|bool|char|float|double|uint\d+_t|int\d+_t)\s+\w+\s*\([^)]*\)\s*\{?$/)) {
                inFunction = true;
            }

            // Track braces
            for (const ch of line) {
                if (ch === '{') braceDepth++;
                if (ch === '}') braceDepth--;
            }

            // If we're inside a function (braceDepth > 0) and see an indented line
            // Return position at the START of the indentation (where typing begins)
            if (inFunction && braceDepth > 0 && /^\s{4,}/.test(line) && trimmed.length > 0 && !trimmed.startsWith('//')) {
                // Find the indentation level
                const indent = line.match(/^(\s+)/)?.[1].length || 4;
                console.log(`C-Next: Querying inside function at line ${i}, indent ${indent}: "${trimmed.substring(0, 20)}..."`);
                return new vscode.Position(i, indent);
            }
        }

        // Fallback: look for opening brace of a function and position after it
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('{') && (line.includes('void ') || line.includes('int ') || line.includes('setup') || line.includes('loop'))) {
                console.log(`C-Next: Found function opening at line ${i}`);
                return new vscode.Position(i + 1, 4);  // Position inside function with indent
            }
        }

        console.log(`C-Next: Fallback to line 0`);
        return new vscode.Position(0, 0);
    }

    /**
     * Find a position in the source where we can query member completions
     * Searches for "parentName." and returns the position right after the dot
     */
    private findMemberAccessPosition(source: string, parentName: string): vscode.Position | null {
        const lines = source.split('\n');
        const pattern = new RegExp('\\b' + parentName + '\\.');

        for (let lineNum = 0; lineNum < lines.length; lineNum++) {
            const line = lines[lineNum];
            const match = pattern.exec(line);

            if (match) {
                // Return position right after the dot
                const dotPosition = match.index + parentName.length + 1;
                return new vscode.Position(lineNum, dotPosition);
            }
        }

        return null;
    }

    /**
     * Merge C-Next and C/C++ completions, preferring C-Next items for duplicates
     */
    private mergeCompletions(
        cnextItems: vscode.CompletionItem[],
        cppItems: vscode.CompletionItem[]
    ): vscode.CompletionItem[] {
        // Build a set of C-Next item names for deduplication
        const cnextNames = new Set(cnextItems.map(item =>
            typeof item.label === 'string' ? item.label : item.label.label
        ));

        // Filter out C++ items that duplicate C-Next items
        const uniqueCppItems = cppItems.filter(item => {
            const name = typeof item.label === 'string' ? item.label : item.label.label;
            return !cnextNames.has(name);
        });

        // C-Next items first (higher priority), then C++ items
        return [...cnextItems, ...uniqueCppItems];
    }
}
