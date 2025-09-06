import { Diagnostic, DiagnosticSeverity } from 'vscode-languageserver/node';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextParser } from '../parser/CNextParser';
import { SymbolTable } from '../semantic/SymbolTable';

export class CNextDiagnosticProvider {
  constructor(
    private parser: CNextParser,
    private symbolTable: SymbolTable
  ) {}

  async getDiagnostics(document: TextDocument): Promise<Diagnostic[]> {
    const diagnostics: Diagnostic[] = [];
    const uri = document.uri;
    const text = document.getText();

    try {
      // Parse document and update symbol table
      const symbols = await this.parser.parseDocument(document, this.symbolTable);
      this.symbolTable.addDocumentSymbols(uri, symbols);

      // Perform various diagnostic checks
      diagnostics.push(...this.checkSyntaxErrors(text));
      diagnostics.push(...this.checkTypeErrors(text));
      diagnostics.push(...this.checkUndefinedSymbols(text, document));
      
    } catch (error) {
      diagnostics.push({
        severity: DiagnosticSeverity.Error,
        range: {
          start: { line: 0, character: 0 },
          end: { line: 0, character: 0 }
        },
        message: `Parser error: ${error}`,
        source: 'cnext'
      });
    }

    return diagnostics;
  }

  private checkSyntaxErrors(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    
    // Parse comments to exclude them from diagnostics
    const commentRanges = this.parseComments(text);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Check for incorrect assignment operator (= instead of <-)
      const incorrectAssignment = line.match(/(\w+)\s*=\s*([^=])/);
      if (incorrectAssignment && !line.includes('==') && !line.includes('!=')) {
        const startChar = line.indexOf('=');
        // Skip if this error is inside a comment
        if (this.isInsideComment(lineIndex, startChar, commentRanges)) continue;
        diagnostics.push({
          severity: DiagnosticSeverity.Error,
          range: {
            start: { line: lineIndex, character: startChar },
            end: { line: lineIndex, character: startChar + 1 }
          },
          message: "Use '<-' for assignment instead of '='",
          source: 'cnext',
          code: 'incorrect-assignment'
        });
      }

      // Check for incorrect string literals (quotes instead of backticks)
      const incorrectString = line.match(/["']([^"']*)["']/);
      if (incorrectString && !line.includes('#include')) {
        const startChar = line.indexOf(incorrectString[0]);
        // Skip if this error is inside a comment
        if (this.isInsideComment(lineIndex, startChar, commentRanges)) continue;
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: lineIndex, character: startChar },
            end: { line: lineIndex, character: startChar + incorrectString[0].length }
          },
          message: "Use backticks `string` for string literals instead of quotes",
          source: 'cnext',
          code: 'incorrect-string-literal'
        });
      }

      // Check for missing semicolons (basic check)
      if (line.trim().endsWith('}') === false && 
          line.trim().length > 0 && 
          !line.trim().endsWith(';') && 
          !line.trim().endsWith('{') &&
          !line.trim().startsWith('//') &&
          !line.trim().startsWith('#') &&
          !line.includes('class ') &&
          !line.includes('if ') &&
          !line.includes('else') &&
          !line.includes('while ') &&
          !line.includes('for ')) {
        diagnostics.push({
          severity: DiagnosticSeverity.Warning,
          range: {
            start: { line: lineIndex, character: line.length - 1 },
            end: { line: lineIndex, character: line.length }
          },
          message: "Missing semicolon",
          source: 'cnext',
          code: 'missing-semicolon'
        });
      }
    }

    return diagnostics;
  }

  private checkTypeErrors(text: string): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    const commentRanges = this.parseComments(text);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Check for invalid type names
      const typeDeclaration = line.match(/^\s*(\w+)\s+(\w+)/);
      if (typeDeclaration && typeDeclaration[1]) {
        const typeName = typeDeclaration[1];
        if (!this.symbolTable.isTypeValid(typeName) && 
            !['class', 'public', 'private', 'static', 'void'].includes(typeName)) {
          const startChar = line.indexOf(typeName);
          // Skip if this error is inside a comment
          if (this.isInsideComment(lineIndex, startChar, commentRanges)) continue;
          diagnostics.push({
            severity: DiagnosticSeverity.Error,
            range: {
              start: { line: lineIndex, character: startChar },
              end: { line: lineIndex, character: startChar + typeName.length }
            },
            message: `Unknown type '${typeName}'`,
            source: 'cnext',
            code: 'unknown-type'
          });
        }
      }
    }

    return diagnostics;
  }

  private checkUndefinedSymbols(text: string, document: TextDocument): Diagnostic[] {
    const diagnostics: Diagnostic[] = [];
    const lines = text.split('\n');
    const commentRanges = this.parseComments(text);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      
      // Check for function calls (including object methods)
      const functionCall = line.match(/(\w+(?:\.\w+)?)\s*\(/);
      if (functionCall && functionCall[1]) {
        const functionName = functionCall[1];
        const symbol = this.symbolTable.findSymbol(functionName, document.uri);
        
        if (!symbol && 
            !['if', 'while', 'for', 'switch'].includes(functionName.split('.')[0])) {
          const startChar = line.indexOf(functionName);
          // Skip if this error is inside a comment
          if (this.isInsideComment(lineIndex, startChar, commentRanges)) continue;
          
          const isObjectMethod = functionName.includes('.');
          const messageType = isObjectMethod ? 'method' : 'function';
          
          diagnostics.push({
            severity: DiagnosticSeverity.Warning,
            range: {
              start: { line: lineIndex, character: startChar },
              end: { line: lineIndex, character: startChar + functionName.length }
            },
            message: `Undefined ${messageType} '${functionName}'`,
            source: 'cnext',
            code: `undefined-${messageType}`
          });
        }
      }
    }

    return diagnostics;
  }

  private parseComments(text: string): CommentRange[] {
    const ranges: CommentRange[] = [];
    const lines = text.split('\n');

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      
      // Single line comments //
      const singleCommentMatch = line.match(/\/\//);
      if (singleCommentMatch) {
        const startChar = line.indexOf('//');
        ranges.push({
          startLine: lineIndex,
          startChar: startChar,
          endLine: lineIndex,
          endChar: line.length
        });
      }
    }

    // Multi-line comments /* */
    const blockCommentRegex = /\/\*[\s\S]*?\*\//g;
    let match;
    while ((match = blockCommentRegex.exec(text)) !== null) {
      const beforeMatch = text.substring(0, match.index);
      const matchText = match[0];
      
      const startLine = beforeMatch.split('\n').length - 1;
      const startChar = beforeMatch.split('\n').pop()?.length || 0;
      
      const endText = beforeMatch + matchText;
      const endLine = endText.split('\n').length - 1;
      const endChar = endText.split('\n').pop()?.length || 0;
      
      ranges.push({
        startLine,
        startChar,
        endLine,
        endChar
      });
    }

    return ranges;
  }

  private isInsideComment(line: number, character: number, commentRanges: CommentRange[]): boolean {
    for (const range of commentRanges) {
      // Single line comment
      if (range.startLine === range.endLine && line === range.startLine) {
        if (character >= range.startChar && character <= range.endChar) {
          return true;
        }
      }
      // Multi-line comment
      else if (line >= range.startLine && line <= range.endLine) {
        if (line === range.startLine && character >= range.startChar) {
          return true;
        }
        if (line === range.endLine && character <= range.endChar) {
          return true;
        }
        if (line > range.startLine && line < range.endLine) {
          return true;
        }
      }
    }
    return false;
  }
}

interface CommentRange {
  startLine: number;
  startChar: number;
  endLine: number;
  endChar: number;
}

export default CNextDiagnosticProvider;