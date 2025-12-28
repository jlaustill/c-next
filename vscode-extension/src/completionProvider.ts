import * as vscode from 'vscode';
import {
    parseWithSymbols,
    ISymbolInfo,
    TSymbolKind
} from '../../dist/lib/transpiler.js';

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
 */
export default class CNextCompletionProvider implements vscode.CompletionItemProvider {
    /**
     * Provide completion items for the given position
     */
    provideCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken,
        _context: vscode.CompletionContext
    ): vscode.CompletionItem[] {
        const lineText = document.lineAt(position).text;
        const linePrefix = lineText.substring(0, position.character);

        // Parse document to get symbols
        const source = document.getText();
        const parseResult = parseWithSymbols(source);
        const symbols = parseResult.symbols;

        // Check for member access context (after a dot)
        const memberMatch = linePrefix.match(/(\w+)\.\s*(\w*)$/);
        if (memberMatch) {
            const parentName = memberMatch[1];
            return this.getMemberCompletions(symbols, parentName);
        }

        // Check if we're in a register member context (after access modifier)
        if (this.isInRegisterContext(linePrefix)) {
            return this.getAccessModifierCompletions();
        }

        // Check if we're in a type context
        if (this.isInTypeContext(linePrefix)) {
            return this.getTypeCompletions();
        }

        // Default: return all top-level symbols + keywords + types
        return this.getGlobalCompletions(symbols);
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
     * Get global completions (keywords, types, top-level symbols)
     */
    private getGlobalCompletions(symbols: ISymbolInfo[]): vscode.CompletionItem[] {
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
}
