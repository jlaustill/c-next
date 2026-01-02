import * as vscode from 'vscode';
import * as path from 'path';
import {
    parseWithSymbols,
    ISymbolInfo
} from '../../dist/lib/transpiler.js';
import WorkspaceIndex from './workspace/WorkspaceIndex.js';

/**
 * Extended symbol info that includes source file path
 */
interface ISymbolWithFile extends ISymbolInfo {
    sourceFile?: string;
}

/**
 * C-Next primitive type info for hover
 */
const TYPE_INFO: Record<string, { description: string; bits: number }> = {
    'u8': { description: 'Unsigned 8-bit integer', bits: 8 },
    'u16': { description: 'Unsigned 16-bit integer', bits: 16 },
    'u32': { description: 'Unsigned 32-bit integer', bits: 32 },
    'u64': { description: 'Unsigned 64-bit integer', bits: 64 },
    'i8': { description: 'Signed 8-bit integer', bits: 8 },
    'i16': { description: 'Signed 16-bit integer', bits: 16 },
    'i32': { description: 'Signed 32-bit integer', bits: 32 },
    'i64': { description: 'Signed 64-bit integer', bits: 64 },
    'f32': { description: 'Single-precision floating point (32-bit)', bits: 32 },
    'f64': { description: 'Double-precision floating point (64-bit)', bits: 64 },
    'bool': { description: 'Boolean value (true/false)', bits: 1 },
    'void': { description: 'No return value', bits: 0 },
    'string': { description: 'Bounded string type. Use string<N> to specify capacity.', bits: 0 },
    'ISR': { description: 'Interrupt Service Routine type - void function with no parameters', bits: 0 }
};

/**
 * C-Next keyword info for hover
 */
const KEYWORD_INFO: Record<string, string> = {
    // Declaration keywords
    'register': 'Declares a hardware register binding with memory-mapped I/O',
    'scope': 'Declares a singleton service with prefixed member names (ADR-016)',
    'class': 'Declares a type with fields and methods (instances via pointer)',
    'struct': 'Declares a data structure (ADR-014)',
    'enum': 'Declares a type-safe enumeration (ADR-017)',
    'const': 'Declares a compile-time constant value (ADR-013)',

    // Control flow
    'if': 'Conditional statement',
    'else': 'Alternative branch of conditional',
    'for': 'Loop with initialization, condition, and increment',
    'while': 'Loop with condition',
    'do': 'Do-while loop - executes at least once (ADR-027)',
    'switch': 'Multi-way branch with required braces per case (ADR-025)',
    'case': 'Switch case label - use || for multiple values',
    'default': 'Default switch case - use default(n) for counted cases',
    'break': 'Exit from loop or switch',
    'continue': 'Skip to next loop iteration',
    'return': 'Return from function',

    // Boolean literals
    'true': 'Boolean true value',
    'false': 'Boolean false value',

    // Visibility modifiers (ADR-016)
    'public': 'Public visibility - accessible from outside the scope',
    'private': 'Private visibility - only accessible within the scope',

    // Overflow behavior (ADR-044)
    'clamp': 'Clamp overflow behavior - values saturate at min/max (default)',
    'wrap': 'Wrap overflow behavior - values wrap around on overflow',

    // Qualification keywords (ADR-016)
    'this': 'Refers to members of the current scope',
    'global': 'Refers to global scope members',

    // Operators
    'sizeof': 'Returns the size of a type or expression in bytes (ADR-023)',

    // Register access modifiers
    'rw': 'Read-write access modifier for register members',
    'ro': 'Read-only access modifier for register members',
    'wo': 'Write-only access modifier for register members',
    'w1c': 'Write-1-to-clear access modifier for register members',
    'w1s': 'Write-1-to-set access modifier for register members',

    // Legacy (kept for compatibility)
    'namespace': 'Legacy: Use "scope" instead (ADR-016)'
};

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
 * Build hover content for a symbol
 * @param symbol The symbol to build hover for
 * @param sourceFile Optional source file path (for cross-file symbols)
 */
function buildSymbolHover(symbol: ISymbolWithFile, sourceFile?: string): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    switch (symbol.kind) {
        case 'scope':
        case 'namespace':  // Legacy support
            md.appendMarkdown(`**scope** \`${symbol.name}\`\n\n`);
            md.appendMarkdown(`Singleton service with prefixed member names.`);
            break;

        case 'class':
            md.appendMarkdown(`**class** \`${symbol.name}\`\n\n`);
            md.appendMarkdown(`Type with fields and methods.`);
            break;

        case 'struct':
            md.appendMarkdown(`**struct** \`${symbol.name}\`\n\n`);
            md.appendMarkdown(`Data structure.`);
            break;

        case 'register':
            md.appendMarkdown(`**register** \`${symbol.name}\`\n\n`);
            md.appendMarkdown(`Hardware register binding for memory-mapped I/O.`);
            break;

        case 'function':
        case 'method':
            md.appendMarkdown(`**function** \`${symbol.fullName}\`\n\n`);
            md.appendCodeblock(symbol.signature || `${symbol.type || 'void'} ${symbol.name}()`, 'cnext');
            if (symbol.parent) {
                md.appendMarkdown(`\n*Defined in: ${symbol.parent} ${symbol.kind === 'method' ? 'class' : 'namespace'}*`);
            }
            break;

        case 'variable':
        case 'field':
            md.appendMarkdown(`**${symbol.parent ? 'field' : 'variable'}** \`${symbol.fullName}\`\n\n`);
            md.appendMarkdown(`*Type:* \`${symbol.type || 'unknown'}\``);
            if (symbol.size !== undefined) {
                md.appendMarkdown(`\n\n*Size:* ${symbol.size}`);
            }
            if (symbol.parent) {
                md.appendMarkdown(`\n\n*Defined in:* ${symbol.parent}`);
            }
            break;

        case 'registerMember':
            const access = symbol.accessModifier || 'rw';
            md.appendMarkdown(`**register member** \`${symbol.fullName}\`\n\n`);
            md.appendCodeblock(`${symbol.type || 'u32'} ${access}`, 'cnext');
            md.appendMarkdown(`\n*Access:* ${getAccessDescription(access)}`);
            if (symbol.parent) {
                md.appendMarkdown(`\n\n*Register:* ${symbol.parent}`);
            }
            break;

        default:
            md.appendMarkdown(`**${symbol.kind}** \`${symbol.name}\``);
    }

    // Show source file for cross-file symbols
    const displayFile = sourceFile || symbol.sourceFile;
    if (displayFile) {
        const fileName = path.basename(displayFile);
        md.appendMarkdown(`\n\n*From:* \`${fileName}\` (line ${symbol.line})`);
    } else {
        md.appendMarkdown(`\n\n*Line ${symbol.line}*`);
    }

    return md;
}

/**
 * C-Next Hover Provider
 * Provides hover information for C-Next source files
 * Supports cross-file symbol lookup via WorkspaceIndex
 */
export default class CNextHoverProvider implements vscode.HoverProvider {
    constructor(private workspaceIndex?: WorkspaceIndex) {}

    /**
     * Provide hover information for the given position
     */
    provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        _token: vscode.CancellationToken
    ): vscode.Hover | null {
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

        // Check for primitive type
        if (TYPE_INFO[word]) {
            const info = TYPE_INFO[word];
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**type** \`${word}\`\n\n`);
            md.appendMarkdown(info.description);
            if (info.bits > 0) {
                md.appendMarkdown(`\n\n*Bit width:* ${info.bits}`);
            }
            return new vscode.Hover(md, wordRange);
        }

        // Check for keyword
        if (KEYWORD_INFO[word]) {
            const md = new vscode.MarkdownString();
            md.appendMarkdown(`**keyword** \`${word}\`\n\n`);
            md.appendMarkdown(KEYWORD_INFO[word]);
            return new vscode.Hover(md, wordRange);
        }

        // FAST PATH: Parse current document to get local symbols
        const source = document.getText();
        const parseResult = parseWithSymbols(source);
        const symbols = parseResult.symbols;

        // Look for symbol in current document
        let symbol: ISymbolInfo | undefined;

        if (parentName) {
            symbol = symbols.find(s => s.name === word && s.parent === parentName);
        } else {
            symbol = symbols.find(s => s.name === word && !s.parent);
            if (!symbol) {
                symbol = symbols.find(s => s.fullName === word);
            }
            if (!symbol) {
                symbol = symbols.find(s => s.name === word);
            }
        }

        if (symbol) {
            return new vscode.Hover(buildSymbolHover(symbol), wordRange);
        }

        // CROSS-FILE: Check workspace index for symbols from other files
        if (this.workspaceIndex) {
            const workspaceSymbol = this.workspaceIndex.findDefinition(word, document.uri) as ISymbolWithFile;
            if (workspaceSymbol) {
                return new vscode.Hover(buildSymbolHover(workspaceSymbol), wordRange);
            }
        }

        return null;
    }
}
