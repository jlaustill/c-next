import { TextDocument, Position, Hover, MarkupKind, Range } from 'vscode-languageserver/node';
import { SymbolTable } from '../semantic/SymbolTable';
import { CNextSymbol, CNextSymbolKind } from '../types';

export class CNextHoverProvider {
  constructor(
    private symbolTable: SymbolTable
  ) {}

  async provideHover(document: TextDocument, position: Position): Promise<Hover | null> {
    const text = document.getText();
    const lines = text.split('\n');
    
    if (position.line >= lines.length) {
      return null;
    }

    const currentLine = lines[position.line];
    const wordRange = this.getWordRangeAtPosition(currentLine, position.character);
    
    if (!wordRange) {
      return null;
    }

    const word = currentLine.substring(wordRange.start, wordRange.end);
    console.log(`[HOVER] Hovering over word: "${word}" at position ${position.line}:${position.character}`);

    // Check if this is an object method call (e.g., "blinker.setup")
    const beforeWord = currentLine.substring(0, wordRange.start);
    const objectMethodMatch = beforeWord.match(/(\w+)\.$/);
    
    if (objectMethodMatch) {
      const objectName = objectMethodMatch[1];
      console.log(`[HOVER] Object method hover: ${objectName}.${word}`);
      return this.getObjectMethodHover(objectName, word, wordRange, position.line);
    }

    // Look for the symbol in our symbol table
    const symbols = this.symbolTable.getAllSymbols(document.uri);
    const matchingSymbols = symbols.filter((symbol: CNextSymbol) => symbol.name === word);
    
    if (matchingSymbols.length > 0) {
      const symbol = matchingSymbols[0];
      return this.createHoverFromSymbol(symbol, wordRange, position.line);
    }

    // Check if it's a class name that might be in another file
    const allSymbols = this.symbolTable.getAllSymbols();
    const classSymbol = allSymbols.find((s: CNextSymbol) => s.name === word && s.kind === CNextSymbolKind.Class);
    
    if (classSymbol) {
      return this.createHoverFromSymbol(classSymbol, wordRange, position.line);
    }

    // Check if it's a global Arduino function or constant
    const globalSymbol = allSymbols.find((s: CNextSymbol) => s.name === word && s.kind === CNextSymbolKind.Function);
    if (globalSymbol) {
      return this.createHoverFromSymbol(globalSymbol, wordRange, position.line);
    }

    return null;
  }

  private getObjectMethodHover(objectName: string, methodName: string, wordRange: { start: number; end: number }, line: number): Hover | null {
    const methods = this.symbolTable.getObjectMethods(objectName);
    const method = methods.find((m: CNextSymbol) => m.name === methodName);
    
    if (method) {
      console.log(`[HOVER] Found method: ${methodName} for object ${objectName}`);
      return this.createHoverFromSymbol(method, wordRange, line);
    }

    // Try to get the object's class and look for the method there
    const objectType = this.symbolTable.getObjectType(objectName);
    if (objectType) {
      const classMembers = this.symbolTable.getClassMembers(objectType);
      const member = classMembers.find((m: CNextSymbol) => m.name === methodName);
      
      if (member) {
        console.log(`[HOVER] Found class member: ${methodName} in class ${objectType}`);
        return this.createHoverFromSymbol(member, wordRange, line);
      }
    }

    return null;
  }

  private createHoverFromSymbol(symbol: CNextSymbol, wordRange: { start: number; end: number }, line: number): Hover {
    const range: Range = {
      start: { line, character: wordRange.start },
      end: { line, character: wordRange.end }
    };

    let content = '';
    let kindLabel = this.getKindLabel(symbol.kind);
    
    // Add visibility indicator for class members
    const visibility = symbol.visibility ? `${symbol.visibility} ` : '';
    
    // Create the hover content
    if (symbol.type) {
      content = `\`\`\`cnext\n${visibility}${kindLabel} ${symbol.name}: ${symbol.type}\n\`\`\``;
    } else {
      content = `\`\`\`cnext\n${visibility}${kindLabel} ${symbol.name}\n\`\`\``;
    }

    // Add additional details
    if (symbol.detail) {
      content += `\n\n${symbol.detail}`;
    }

    // Add container information
    if (symbol.containerName) {
      content += `\n\n*Defined in ${symbol.containerName}*`;
    }

    // Add documentation if available
    if (symbol.documentation) {
      content += `\n\n---\n\n${symbol.documentation}`;
    }

    return {
      contents: {
        kind: MarkupKind.Markdown,
        value: content
      },
      range
    };
  }

  private getKindLabel(kind: CNextSymbolKind): string {
    switch (kind) {
      case CNextSymbolKind.Class: return 'class';
      case CNextSymbolKind.Function: return 'function';
      case CNextSymbolKind.Method: return 'method';
      case CNextSymbolKind.Variable: return 'variable';
      case CNextSymbolKind.Constant: return 'constant';
      case CNextSymbolKind.Property: return 'property';
      case CNextSymbolKind.Parameter: return 'parameter';
      case CNextSymbolKind.Import: return 'import';
      case CNextSymbolKind.Include: return 'include';
      default: return 'symbol';
    }
  }

  private getWordRangeAtPosition(line: string, character: number): { start: number; end: number } | null {
    if (character >= line.length) {
      return null;
    }

    // Find the start of the word
    let start = character;
    while (start > 0 && this.isWordCharacter(line[start - 1])) {
      start--;
    }

    // Find the end of the word
    let end = character;
    while (end < line.length && this.isWordCharacter(line[end])) {
      end++;
    }

    if (start === end) {
      return null;
    }

    return { start, end };
  }

  private isWordCharacter(char: string): boolean {
    return /[a-zA-Z0-9_]/.test(char);
  }
}