import { CompletionItem, CompletionItemKind, Position, InsertTextFormat } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextParser } from '../parser/CNextParser';
import { SymbolTable } from '../semantic/SymbolTable';
import { CNextSymbolKind } from '../types';

export class CNextCompletionProvider {
  constructor(
    private _parser: CNextParser,
    private symbolTable: SymbolTable
  ) {}

  async getCompletions(document: TextDocument, position: Position): Promise<CompletionItem[]> {
    const text = document.getText();
    const lines = text.split('\n');
    const currentLine = lines[position.line];
    const linePrefix = currentLine.substring(0, position.character);

    // Determine completion context
    const completions: CompletionItem[] = [];

    // Add type completions
    if (this.isTypeContext(linePrefix)) {
      completions.push(...this.getTypeCompletions());
    }

    // Add symbol completions
    completions.push(...this.getSymbolCompletions(document.uri));

    // Add keyword completions
    completions.push(...this.getKeywordCompletions(linePrefix));

    // Add snippet completions
    completions.push(...this.getSnippetCompletions(linePrefix));

    // Add Arduino-specific completions
    completions.push(...this.getArduinoCompletions());

    return completions;
  }

  private isTypeContext(linePrefix: string): boolean {
    // Check if we're in a variable declaration context
    const typePattern = /^\s*(public\s+)?$/;
    return typePattern.test(linePrefix) || linePrefix.trim() === '';
  }

  private getTypeCompletions(): CompletionItem[] {
    const types = this.symbolTable.getAllTypes();
    return types.map(type => ({
      label: type,
      kind: CompletionItemKind.Class,
      detail: `Type: ${type}`,
      documentation: `c-next type: ${type}`
    }));
  }

  private getSymbolCompletions(uri: string): CompletionItem[] {
    const symbols = this.symbolTable.getAllSymbols(uri);
    return symbols.map(symbol => {
      let kind: CompletionItemKind;
      
      switch (symbol.kind) {
        case CNextSymbolKind.Class:
          kind = CompletionItemKind.Class;
          break;
        case CNextSymbolKind.Function:
          kind = CompletionItemKind.Function;
          break;
        case CNextSymbolKind.Variable:
          kind = CompletionItemKind.Variable;
          break;
        case CNextSymbolKind.Constant:
          kind = CompletionItemKind.Constant;
          break;
        case CNextSymbolKind.Method:
          kind = CompletionItemKind.Method;
          break;
        default:
          kind = CompletionItemKind.Text;
      }

      return {
        label: symbol.name,
        kind,
        detail: symbol.type ? `${symbol.type} ${symbol.name}` : symbol.name,
        documentation: symbol.documentation || symbol.detail
      };
    });
  }

  private getKeywordCompletions(_linePrefix: string): CompletionItem[] {
    const keywords = [
      'class', 'public', 'private', 'static', 'void', 
      'if', 'else', 'while', 'for', 'return', 'break', 'continue',
      'true', 'false', 'null'
    ];

    return keywords.map(keyword => ({
      label: keyword,
      kind: CompletionItemKind.Keyword,
      detail: `Keyword: ${keyword}`,
      documentation: `c-next keyword: ${keyword}`
    }));
  }

  private getSnippetCompletions(_linePrefix: string): CompletionItem[] {
    const snippets: CompletionItem[] = [];

    // Class template
    snippets.push({
      label: 'class',
      kind: CompletionItemKind.Snippet,
      detail: 'Class template',
      documentation: 'Create a new c-next class',
      insertText: 'class ${1:ClassName} {\n\t$0\n}',
      insertTextFormat: InsertTextFormat.Snippet
    });

    // Function template
    snippets.push({
      label: 'function',
      kind: CompletionItemKind.Snippet,
      detail: 'Function template',
      documentation: 'Create a new function',
      insertText: '${1:returnType} ${2:functionName}(${3:parameters}) {\n\t$0\n}',
      insertTextFormat: InsertTextFormat.Snippet
    });

    // Variable declaration with assignment
    snippets.push({
      label: 'var',
      kind: CompletionItemKind.Snippet,
      detail: 'Variable declaration',
      documentation: 'Declare and initialize a variable',
      insertText: '${1:type} ${2:name} <- ${3:value};',
      insertTextFormat: InsertTextFormat.Snippet
    });

    // If statement
    snippets.push({
      label: 'if',
      kind: CompletionItemKind.Snippet,
      detail: 'If statement',
      documentation: 'Create an if statement',
      insertText: 'if (${1:condition}) {\n\t$0\n}',
      insertTextFormat: InsertTextFormat.Snippet
    });

    // While loop
    snippets.push({
      label: 'while',
      kind: CompletionItemKind.Snippet,
      detail: 'While loop',
      documentation: 'Create a while loop',
      insertText: 'while (${1:condition}) {\n\t$0\n}',
      insertTextFormat: InsertTextFormat.Snippet
    });

    // For loop
    snippets.push({
      label: 'for',
      kind: CompletionItemKind.Snippet,
      detail: 'For loop',
      documentation: 'Create a for loop',
      insertText: 'for (${1:init}; ${2:condition}; ${3:increment}) {\n\t$0\n}',
      insertTextFormat: InsertTextFormat.Snippet
    });

    return snippets;
  }

  private getArduinoCompletions(): CompletionItem[] {
    const completions: CompletionItem[] = [];

    // Arduino constants
    const constants = [
      { name: 'HIGH', detail: 'Digital pin high state (1)' },
      { name: 'LOW', detail: 'Digital pin low state (0)' },
      { name: 'INPUT', detail: 'Pin mode input' },
      { name: 'OUTPUT', detail: 'Pin mode output' },
      { name: 'LED_BUILTIN', detail: 'Built-in LED pin number' }
    ];

    constants.forEach(constant => {
      completions.push({
        label: constant.name,
        kind: CompletionItemKind.Constant,
        detail: constant.detail,
        documentation: `Arduino constant: ${constant.detail}`
      });
    });

    // Arduino functions
    const functions = [
      { 
        name: 'pinMode', 
        signature: 'void pinMode(uint8 pin, uint8 mode)',
        detail: 'Configure pin mode (INPUT/OUTPUT)',
        insertText: 'pinMode(${1:pin}, ${2:mode});'
      },
      { 
        name: 'digitalWrite', 
        signature: 'void digitalWrite(uint8 pin, uint8 value)',
        detail: 'Write digital value to pin (HIGH/LOW)',
        insertText: 'digitalWrite(${1:pin}, ${2:value});'
      },
      { 
        name: 'digitalRead', 
        signature: 'uint8 digitalRead(uint8 pin)',
        detail: 'Read digital value from pin',
        insertText: 'digitalRead(${1:pin})'
      },
      { 
        name: 'delay', 
        signature: 'void delay(uint32 ms)',
        detail: 'Delay execution for specified milliseconds',
        insertText: 'delay(${1:milliseconds});'
      }
    ];

    functions.forEach(func => {
      completions.push({
        label: func.name,
        kind: CompletionItemKind.Function,
        detail: func.signature,
        documentation: `Arduino function: ${func.detail}`,
        insertText: func.insertText,
        insertTextFormat: InsertTextFormat.Snippet
      });
    });

    return completions;
  }
}

export default CNextCompletionProvider;