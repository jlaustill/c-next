// src/index.ts
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { cNextLexer } from './parser/cNextLexer';
import { cNextParser } from './parser/cNextParser';
import { CGenerationVisitor } from './visitors/CGenerationVisitor';
import * as path from 'path';
import * as fs from 'fs';

interface CompilerOptions {
  inputDir: string;
  outputDir: string;
}

class Compiler {
  constructor(private options: CompilerOptions) {}

  compile() {
    // Find all .cn and .cnm files in input directory
    const files = this.findSourceFiles();
    let hasErrors = false;
    
    for (const file of files) {
      try {
        this.compileFile(file);
      } catch (error) {
        console.error(`Error compiling ${file}:`, error);
        hasErrors = true;
      }
    }
    
    if (hasErrors) {
      process.exit(1);
    }
  }

  private findSourceFiles(): string[] {
    return fs.readdirSync(this.options.inputDir)
      .filter(file => file.endsWith('.cn') || file.endsWith('.cnm'))
      .map(file => path.join(this.options.inputDir, file));
  }

  private compileFile(filePath: string) {
    const input = fs.readFileSync(filePath, 'utf8');
    const isMainFile = filePath.endsWith('.cnm');

    // Create the lexer and parser
    const inputStream = CharStreams.fromString(input);
    const lexer = new cNextLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new cNextParser(tokenStream);

    // Get the appropriate root rule based on file type
    const tree = isMainFile ? parser.mainSourceFile() : parser.sourceFile();

    // Create and run visitor with include paths
    const includePaths = [path.dirname(filePath)]; // Add source file directory to include paths
    const visitor = new CGenerationVisitor(this.options.outputDir, includePaths);
    visitor.visit(tree);
    
    // Log symbol table information for debugging
    const symbolTable = visitor.getSymbolTable();
    const allSymbols = symbolTable.getAllSymbols();
    if (allSymbols.length > 0) {
      console.log(`Loaded ${allSymbols.length} symbols from included headers:`);
      console.log(`  Functions: ${symbolTable.getSymbolsByType('function').length}`);
      console.log(`  Variables: ${symbolTable.getSymbolsByType('variable').length}`);
      console.log(`  Types: ${symbolTable.getSymbolsByType('type').length}`);
    }
  }
}

// CLI entry point
function main() {
  const args = process.argv.slice(2);
  const options: CompilerOptions = {
    inputDir: args[0] || './src',
    outputDir: args[1] || './dist'
  };

  console.log('Compiling with options:', options);
  
  const compiler = new Compiler(options);
  compiler.compile();
}

// Usage example
if (require.main === module) {
  main();
}