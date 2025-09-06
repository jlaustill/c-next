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
    
    console.log(`[COMPLETION] ==========================================`);
    console.log(`[COMPLETION] getCompletions called for line: "${currentLine}"`);
    console.log(`[COMPLETION] Line prefix: "${linePrefix}"`);
    console.log(`[COMPLETION] Position: line ${position.line}, char ${position.character}`);

    // Determine completion context
    const completions: CompletionItem[] = [];

    // Check if we're completing object methods (e.g., "blinker.")
    const objectMethodMatch = linePrefix.match(/(\w+)\.$/);
    if (objectMethodMatch) {
      const objectName = objectMethodMatch[1];
      console.log(`[COMPLETION] Object method completion for: "${objectName}" from line prefix: "${linePrefix}"`);
      const objectCompletions = this.getObjectMethodCompletions(objectName);
      console.log(`[COMPLETION] Found ${objectCompletions.length} completions for ${objectName}`);
      
      // If we found any completions, return them
      if (objectCompletions.length > 0) {
        completions.push(...objectCompletions);
        return completions;
      }
      
      // If no completions found, add a debug completion to show we detected the pattern
      completions.push({
        label: `DEBUG: No completions for ${objectName}`,
        kind: CompletionItemKind.Text,
        detail: `Object completion was triggered for ${objectName} but no methods found`,
        insertText: `/* DEBUG: ${objectName} not found */`
      });
      return completions; // Only show object methods, not global symbols
    }

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

    console.log(`[COMPLETION] Returning ${completions.length} total completions`);
    console.log(`[COMPLETION] ==========================================`);
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

  private getObjectMethodCompletions(objectName: string): CompletionItem[] {
    const completions: CompletionItem[] = [];
    console.log(`[COMPLETION] Looking up completions for object: ${objectName}`);

    // First check if it's a direct object (like Serial)
    const objectMethods = this.symbolTable.getObjectMethods(objectName);
    console.log(`[COMPLETION] Direct object methods for ${objectName}:`, objectMethods.length);
    if (objectMethods && objectMethods.length > 0) {
      console.log(`[COMPLETION] Using direct object methods for ${objectName}`);
      return objectMethods.map(method => ({
        label: method.name,
        kind: CompletionItemKind.Method,
        detail: method.type ? `${method.type} ${objectName}.${method.name}()` : `${objectName}.${method.name}()`,
        documentation: method.documentation || method.detail,
        insertText: `${method.name}(\${1})`,
        insertTextFormat: InsertTextFormat.Snippet
      }));
    }

    // Then check if it's a class instance
    const className = this.symbolTable.getObjectInstanceType(objectName);
    console.log(`[COMPLETION] Object ${objectName} instance type:`, className);
    if (className) {
      const classMembers = this.symbolTable.getClassMembers(className);
      console.log(`[COMPLETION] Class ${className} has ${classMembers?.length || 0} members`);
      if (classMembers && classMembers.length > 0) {
        // Separate public and private members
        const publicMembers: CompletionItem[] = [];
        const privateMembers: CompletionItem[] = [];

        classMembers.forEach(member => {
          const isPublic = this.isPublicMember(member);
          const isMethod = member.kind === 'method';
          const completionItem: CompletionItem = {
            label: member.name,
            kind: isMethod ? CompletionItemKind.Method : 
                  (member.kind === 'constant' ? CompletionItemKind.Constant : CompletionItemKind.Property),
            detail: member.type ? (isMethod ? `${member.type} ${member.name}()` : `${member.type} ${member.name}`) : member.name,
            documentation: member.documentation || member.detail,
            insertText: isMethod ? `${member.name}(\${1})` : member.name,
            insertTextFormat: isMethod ? InsertTextFormat.Snippet : InsertTextFormat.PlainText
          };

          if (isPublic) {
            publicMembers.push({
              ...completionItem,
              sortText: `0_${member.name}` // Sort public members first (0_ prefix)
            });
          } else {
            // Gray out private members and add (private) indicator
            privateMembers.push({
              ...completionItem,
              label: `${member.name} (private)`,
              detail: `(private) ${completionItem.detail}`,
              tags: [1], // CompletionItemTag.Deprecated - makes it grayed out
              sortText: `1_${member.name}` // Sort private members last (1_ prefix)
            });
          }
        });

        // Return public members first, then private members
        console.log(`[COMPLETION] Returning ${publicMembers.length} public + ${privateMembers.length} private members`);
        return [...publicMembers, ...privateMembers];
      }
    }

    console.log(`[COMPLETION] No completions found for ${objectName}`);
    return completions;
  }

  private isPublicMember(member: any): boolean {
    // Check if member has explicit visibility information
    return member.visibility === 'public';
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