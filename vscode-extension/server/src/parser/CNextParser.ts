import { TextDocument } from 'vscode-languageserver-textdocument';
import { CNextSymbol, CNextSymbolKind } from '../types';
import * as path from 'path';
import * as fs from 'fs';

export class CNextParser {
  private symbols: Map<string, CNextSymbol[]> = new Map();
  private includePaths: string[] = []; // Will be set by the server
  private parsedImports: Set<string> = new Set(); // Track already parsed imports

  setIncludePaths(paths: string[]): void {
    this.includePaths = paths;
  }

  async parseDocument(document: TextDocument, symbolTable?: any): Promise<CNextSymbol[]> {
    const uri = document.uri;
    const text = document.getText();

    try {
      // First, process includes and imports to ensure imported types are available
      if (symbolTable) {
        // Handle C/C++ includes
        const includes = this.extractIncludes(text);
        for (const includePath of includes) {
          this.tryParseIncludeHeader(includePath, symbolTable, document.uri);
        }

        // Handle c-next imports FIRST - this is crucial for type resolution
        const imports = this.extractImports(text);
        for (const importPath of imports) {
          this.tryParseImportFile(importPath, symbolTable, document.uri);
        }
      }

      // Then extract symbols from the c-next document
      const symbols = this.extractBasicSymbols(text, document);
      
      console.log(`Parsed document ${uri}, found ${symbols.length} symbols:`);
      symbols.forEach(symbol => {
        console.log(`  - ${symbol.kind}: ${symbol.name}${symbol.type ? ` (${symbol.type})` : ''}${symbol.containerName ? ` in ${symbol.containerName}` : ''}`);
      });
      
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

  private extractBasicSymbols(text: string, _document: TextDocument): CNextSymbol[] {
    const symbols: CNextSymbol[] = [];
    const lines = text.split('\n');
    const classRegions = this.findClassRegions(text);
    
    console.log(`Class regions found:`, classRegions);

    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (!line) continue;
      const trimmedLine = line.trim();

      // Extract class definitions and their methods
      const classMatch = trimmedLine.match(/^class\s+(\w+)/);
      if (classMatch) {
        const className = classMatch[1];
        symbols.push({
          name: className,
          kind: CNextSymbolKind.Class,
          range: {
            start: { line: lineIndex, character: line.indexOf('class') },
            end: { line: lineIndex, character: line.indexOf('class') + classMatch[0].length }
          }
        });

        // Extract methods from this class
        const classMethods = this.extractClassMethods(text, className, lineIndex);
        symbols.push(...classMethods);
        continue; // Skip other processing for class definition lines
      }

      // Extract function definitions (but skip if we're inside a class)
      const isInsideClass = classRegions.some(region => 
        lineIndex > region.start && lineIndex < region.end
      );
      
      const functionMatch = trimmedLine.match(/^(?:public\s+)?(\w+)\s+(\w+)\s*\(/);
      if (functionMatch) {
        console.log(`Line ${lineIndex}: Found function pattern "${functionMatch[0]}", isInsideClass: ${isInsideClass}`);
        
        if (!isInsideClass) {
          symbols.push({
            name: functionMatch[2],
            kind: CNextSymbolKind.Function,
            type: functionMatch[1],
            range: {
              start: { line: lineIndex, character: line.indexOf(functionMatch[2]) },
              end: { line: lineIndex, character: line.indexOf(functionMatch[2]) + functionMatch[2].length }
            }
          });
          console.log(`Added as standalone function: ${functionMatch[2]}`);
        } else {
          console.log(`Skipped because inside class: ${functionMatch[2]}`);
        }
      }

      // Extract variable definitions (including class instantiations)
      const variableMatch = trimmedLine.match(/^(?:public\s+)?(\w+)\s+(\w+)\s*(?:(<-|=)|;)/);
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

      // Extract import statements
      const importMatch = trimmedLine.match(/^import\s*[`"]([^`"]+)[`"]/);
      if (importMatch) {
        symbols.push({
          name: importMatch[1],
          kind: CNextSymbolKind.Import,
          range: {
            start: { line: lineIndex, character: line.indexOf('import') },
            end: { line: lineIndex, character: trimmedLine.length }
          }
        });
      }
    }

    return symbols;
  }

  private extractClassMethods(text: string, className: string, classStartLine: number): CNextSymbol[] {
    const methods: CNextSymbol[] = [];
    const lines = text.split('\n');
    
    console.log(`Extracting methods for class ${className} starting at line ${classStartLine}`);

    // Find the class body boundaries
    const classRegion = this.findClassBodyRegion(lines, classStartLine);
    if (!classRegion) {
      console.log(`Could not find class body for ${className}`);
      return methods;
    }

    console.log(`Class ${className} body: lines ${classRegion.start} to ${classRegion.end}`);
    
    // Parse methods within the class body
    this.extractMethodsFromRegion(lines, classRegion.start, classRegion.end, className, methods, 0);
    
    console.log(`Found ${methods.length} methods in class ${className}:`, methods.map(m => m.name));
    return methods;
  }

  private findClassBodyRegion(lines: string[], classStartLine: number): {start: number, end: number} | null {
    let braceDepth = 0;
    let bodyStart = -1;
    let bodyEnd = -1;

    for (let i = classStartLine; i < lines.length; i++) {
      const line = lines[i];
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      braceDepth += openBraces;
      
      if (bodyStart === -1 && braceDepth > 0) {
        bodyStart = i + 1; // Start after the opening brace
      }
      
      braceDepth -= closeBraces;
      
      if (bodyStart !== -1 && braceDepth === 0) {
        bodyEnd = i - 1; // End before the closing brace
        break;
      }
    }

    return (bodyStart !== -1 && bodyEnd !== -1) ? { start: bodyStart, end: bodyEnd } : null;
  }

  private extractMethodsFromRegion(lines: string[], startLine: number, endLine: number, containerName: string, methods: CNextSymbol[], nesting: number): void {
    console.log(`  ${'  '.repeat(nesting)}Extracting methods from lines ${startLine}-${endLine} for ${containerName}`);
    
    for (let i = startLine; i <= endLine; i++) {
      const line = lines[i];
      if (!line) continue;
      const trimmedLine = line.trim();
      
      // Look for method definitions
      const methodMatch = trimmedLine.match(/^(?:public\s+)?(\w+)\s+(\w+)\s*\(/);
      if (methodMatch && methodMatch[2] !== containerName) { // Exclude constructor
        const methodName = methodMatch[2];
        const returnType = methodMatch[1];
        
        console.log(`  ${'  '.repeat(nesting)}Found method: ${methodName} (${returnType}) at line ${i}`);
        
        methods.push({
          name: methodName,
          kind: CNextSymbolKind.Method,
          type: returnType,
          containerName: containerName,
          range: {
            start: { line: i, character: line.indexOf(methodName) },
            end: { line: i, character: line.indexOf(methodName) + methodName.length }
          },
          detail: `${returnType} ${containerName}.${methodName}()`
        });

        // Find the method body and recursively extract nested methods
        const methodBodyRegion = this.findMethodBodyRegion(lines, i);
        if (methodBodyRegion) {
          console.log(`  ${'  '.repeat(nesting)}Method ${methodName} body: lines ${methodBodyRegion.start}-${methodBodyRegion.end}`);
          // Recursively parse nested methods (future feature)
          this.extractMethodsFromRegion(lines, methodBodyRegion.start, methodBodyRegion.end, `${containerName}.${methodName}`, methods, nesting + 1);
          
          // Skip past this method body
          i = methodBodyRegion.end + 1;
        }
      }
    }
  }

  private findMethodBodyRegion(lines: string[], methodStartLine: number): {start: number, end: number} | null {
    let braceDepth = 0;
    let bodyStart = -1;
    let bodyEnd = -1;
    let foundFirstBrace = false;

    for (let i = methodStartLine; i < lines.length; i++) {
      const line = lines[i];
      const openBraces = (line.match(/{/g) || []).length;
      const closeBraces = (line.match(/}/g) || []).length;
      
      braceDepth += openBraces;
      
      if (!foundFirstBrace && openBraces > 0) {
        foundFirstBrace = true;
        bodyStart = i + 1; // Start after the opening brace
      }
      
      braceDepth -= closeBraces;
      
      if (foundFirstBrace && braceDepth === 0) {
        bodyEnd = i - 1; // End before the closing brace
        break;
      }
    }

    return (bodyStart !== -1 && bodyEnd !== -1 && bodyEnd >= bodyStart) ? { start: bodyStart, end: bodyEnd } : null;
  }

  private extractIncludes(text: string): string[] {
    const includes: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const includeMatch = line.match(/^#include\s*["<]([^">]+)[">]/);
      if (includeMatch) {
        includes.push(includeMatch[1]);
      }
    }

    return includes;
  }

  private extractImports(text: string): string[] {
    const imports: string[] = [];
    const lines = text.split('\n');

    for (const line of lines) {
      const importMatch = line.match(/^import\s*[`"]([^`"]+)[`"]/);
      if (importMatch) {
        imports.push(importMatch[1]);
      }
    }

    return imports;
  }

  private tryParseIncludeHeader(includePath: string, symbolTable: any, documentUri: string): void {
    // Try to find the header file in various locations
    const possiblePaths = this.resolveIncludePath(includePath, documentUri);
    
    for (const headerPath of possiblePaths) {
      if (fs.existsSync(headerPath)) {
        symbolTable.parseHeaderFile(headerPath);
        break;
      }
    }
  }

  private resolveIncludePath(includePath: string, documentUri: string): string[] {
    const possiblePaths: string[] = [];
    const documentDir = path.dirname(documentUri.replace('file://', ''));

    // 1. Relative to current document
    possiblePaths.push(path.join(documentDir, includePath));

    // 2. In the test-files directory (for our Arduino.h example)
    const projectRoot = this.findProjectRoot(documentDir);
    if (projectRoot) {
      possiblePaths.push(path.join(projectRoot, 'test-files', includePath));
      possiblePaths.push(path.join(projectRoot, 'test-files', 'Blink', includePath));
    }

    // 3. Standard include paths
    for (const includeDirPath of this.includePaths) {
      possiblePaths.push(path.join(includeDirPath, includePath));
    }

    return possiblePaths;
  }

  private tryParseImportFile(importPath: string, symbolTable: any, documentUri: string): void {
    // Try to find the c-next file in various locations
    const possiblePaths = this.resolveImportPath(importPath, documentUri);
    
    for (const cnextPath of possiblePaths) {
      if (fs.existsSync(cnextPath)) {
        // Check if already parsed to avoid duplicates
        if (this.parsedImports.has(cnextPath)) {
          console.log(`Import already parsed, skipping: ${cnextPath}`);
          return;
        }

        try {
          // Mark as parsed before processing
          this.parsedImports.add(cnextPath);
          
          // Read and parse the imported c-next file
          const content = fs.readFileSync(cnextPath, 'utf-8');
          const document = {
            uri: `file://${cnextPath}`,
            getText: () => content,
            lineCount: content.split('\n').length
          } as any;
          
          // Parse the imported file and add its symbols to the symbol table
          const importedSymbols = this.extractBasicSymbols(content, document);
          symbolTable.addDocumentSymbols(`file://${cnextPath}`, importedSymbols);
          
          console.log(`Successfully parsed imported file: ${cnextPath}, found ${importedSymbols.length} symbols:`);
          // Debug: log each symbol found
          importedSymbols.forEach(symbol => {
            console.log(`  - ${symbol.kind}: ${symbol.name}${symbol.type ? ` (${symbol.type})` : ''}${symbol.containerName ? ` in ${symbol.containerName}` : ''}`);
          });
        } catch (error) {
          console.error(`Error parsing imported file ${cnextPath}:`, error);
          // Remove from parsed set if parsing failed
          this.parsedImports.delete(cnextPath);
        }
        break;
      }
    }
  }

  private resolveImportPath(importPath: string, documentUri: string): string[] {
    const possiblePaths: string[] = [];
    const documentDir = path.dirname(documentUri.replace('file://', ''));

    // 1. Relative to current document
    possiblePaths.push(path.join(documentDir, importPath));

    // 2. Check parent directories for the import file
    const projectRoot = this.findProjectRoot(documentDir);
    if (projectRoot) {
      // Search in examples and test directories
      possiblePaths.push(path.join(projectRoot, 'examples', 'blink', 'src', importPath));
      possiblePaths.push(path.join(projectRoot, 'test-files', importPath));
      possiblePaths.push(path.join(projectRoot, 'src', importPath));
    }

    return possiblePaths;
  }

  private findClassRegions(text: string): Array<{start: number, end: number}> {
    const regions: Array<{start: number, end: number}> = [];
    const lines = text.split('\n');
    
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      const trimmedLine = line.trim();
      
      // Look for class definitions
      if (trimmedLine.match(/^class\s+\w+/)) {
        console.log(`Found class definition at line ${lineIndex}: "${trimmedLine}"`);
        
        // Find the end of this class by tracking braces
        let braceDepth = 0;
        let classEnd = lineIndex;
        let foundFirstBrace = false;
        
        for (let i = lineIndex; i < lines.length; i++) {
          const currentLine = lines[i];
          console.log(`Line ${i}: "${currentLine.trim()}", braceDepth: ${braceDepth}`);
          
          // Count opening and closing braces
          for (const char of currentLine) {
            if (char === '{') {
              braceDepth++;
              foundFirstBrace = true;
              console.log(`  Found '{' at line ${i}, depth now: ${braceDepth}`);
            }
            if (char === '}') {
              braceDepth--;
              console.log(`  Found '}' at line ${i}, depth now: ${braceDepth}`);
              
              // When we reach 0 depth and we've seen the opening brace, we found the class end
              if (braceDepth === 0 && foundFirstBrace) {
                classEnd = i;
                console.log(`  Class ends at line ${i}`);
                break;
              }
            }
          }
          
          // Exit the loop when we found the end
          if (braceDepth === 0 && foundFirstBrace && i > lineIndex) {
            break;
          }
        }
        
        console.log(`Class region: start=${lineIndex}, end=${classEnd}`);
        regions.push({ start: lineIndex, end: classEnd });
      }
    }
    
    return regions;
  }

  private findProjectRoot(startDir: string): string | null {
    let currentDir = startDir;
    
    while (currentDir !== path.dirname(currentDir)) {
      // Look for package.json or other project markers
      if (fs.existsSync(path.join(currentDir, 'package.json')) ||
          fs.existsSync(path.join(currentDir, 'CLAUDE.md'))) {
        return currentDir;
      }
      currentDir = path.dirname(currentDir);
    }
    
    return null;
  }
}

export default CNextParser;