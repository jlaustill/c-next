import { ANTLRInputStream, CommonTokenStream, RecognitionException } from 'antlr4ts';
import { ParseTreeWalker } from 'antlr4ts/tree/ParseTreeWalker';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextSymbol, CNextSymbolKind } from '../../../shared/types';

export class CNextParser {
  private symbols: Map<string, CNextSymbol[]> = new Map();

  async parseDocument(document: TextDocument): Promise<CNextSymbol[]> {
    const uri = document.uri;
    const text = document.getText();

    try {
      // For now, implement basic symbol extraction without full ANTLR integration
      // This will be replaced with proper ANTLR parser integration in Phase 1.3
      const symbols = this.extractBasicSymbols(text, document);
      this.symbols.set(uri, symbols);
      return symbols;
    } catch (error) {
      console.error(`Error parsing document ${uri}:`, error);
      return [];
    }
  }

  getSymbols(uri: string): CNextSymbol[] {
    return this.symbols.get(uri) || [];
  }

  clearSymbols(uri: string): void {
    this.symbols.delete(uri);
  }

  private extractBasicSymbols(text: string, document: TextDocument): CNextSymbol[] {
    const symbols: CNextSymbol[] = [];
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();

      // Extract class definitions
      const classMatch = trimmedLine.match(/^class\s+(\w+)/);
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: CNextSymbolKind.Class,
          range: {
            start: { line: lineIndex, character: line.indexOf('class') },
            end: { line: lineIndex, character: line.indexOf('class') + classMatch[0].length }
          }
        });
      }

      // Extract function definitions
      const functionMatch = trimmedLine.match(/^(?:public\s+)?(\w+)\s+(\w+)\s*\(/);
      if (functionMatch) {
        symbols.push({
          name: functionMatch[2],
          kind: CNextSymbolKind.Function,
          type: functionMatch[1],
          range: {
            start: { line: lineIndex, character: line.indexOf(functionMatch[2]) },
            end: { line: lineIndex, character: line.indexOf(functionMatch[2]) + functionMatch[2].length }
          }
        });
      }

      // Extract variable definitions
      const variableMatch = trimmedLine.match(/^(?:public\s+)?(\w+)\s+(\w+)\s*(<-|=)/);
      if (variableMatch) {
        symbols.push({
          name: variableMatch[2],
          kind: CNextSymbolKind.Variable,
          type: variableMatch[1],
          range: {
            start: { line: lineIndex, character: line.indexOf(variableMatch[2]) },
            end: { line: lineIndex, character: line.indexOf(variableMatch[2]) + variableMatch[2].length }
          }
        });
      }

      // Extract include statements
      const includeMatch = trimmedLine.match(/^#include\s*["<]([^">]+)[">]/);
      if (includeMatch) {
        symbols.push({
          name: includeMatch[1],
          kind: CNextSymbolKind.Include,
          range: {
            start: { line: lineIndex, character: line.indexOf('#include') },
            end: { line: lineIndex, character: trimmedLine.length }
          }
        });
      }
    }

    return symbols;
  }
}

export default CNextParser;