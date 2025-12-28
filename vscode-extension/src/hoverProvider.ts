import * as vscode from 'vscode';
import {
    parseWithSymbols,
    ISymbolInfo
} from '../../dist/lib/transpiler.js';

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
    'void': { description: 'No return value', bits: 0 }
};

/**
 * C-Next keyword info for hover
 */
const KEYWORD_INFO: Record<string, string> = {
    'register': 'Declares a hardware register binding with memory-mapped I/O',
    'namespace': 'Declares a singleton service with prefixed member names',
    'class': 'Declares a type with fields and methods (instances via pointer)',
    'struct': 'Declares a data structure',
    'if': 'Conditional statement',
    'else': 'Alternative branch of conditional',
    'for': 'Loop with initialization, condition, and increment',
    'while': 'Loop with condition',
    'return': 'Return from function',
    'true': 'Boolean true value',
    'false': 'Boolean false value',
    'rw': 'Read-write access modifier for register members',
    'ro': 'Read-only access modifier for register members',
    'wo': 'Write-only access modifier for register members',
    'w1c': 'Write-1-to-clear access modifier for register members',
    'w1s': 'Write-1-to-set access modifier for register members'
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
 */
function buildSymbolHover(symbol: ISymbolInfo): vscode.MarkdownString {
    const md = new vscode.MarkdownString();
    md.isTrusted = true;

    switch (symbol.kind) {
        case 'namespace':
            md.appendMarkdown(`**namespace** \`${symbol.name}\`\n\n`);
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

    md.appendMarkdown(`\n\n*Line ${symbol.line}*`);
    return md;
}

/**
 * C-Next Hover Provider
 * Provides hover information for C-Next source files
 */
export default class CNextHoverProvider implements vscode.HoverProvider {
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

        // Parse document to get symbols
        const source = document.getText();
        const parseResult = parseWithSymbols(source);
        const symbols = parseResult.symbols;

        // Look for symbol
        let symbol: ISymbolInfo | undefined;

        if (parentName) {
            // Looking for a member of parentName
            symbol = symbols.find(s => s.name === word && s.parent === parentName);
        } else {
            // Looking for a top-level symbol or any symbol with this name
            symbol = symbols.find(s => s.name === word && !s.parent);
            if (!symbol) {
                // Try to find any symbol with this fullName
                symbol = symbols.find(s => s.fullName === word);
            }
            if (!symbol) {
                // Try to find any symbol with this name (could be a parent reference)
                symbol = symbols.find(s => s.name === word);
            }
        }

        if (symbol) {
            return new vscode.Hover(buildSymbolHover(symbol), wordRange);
        }

        return null;
    }
}
