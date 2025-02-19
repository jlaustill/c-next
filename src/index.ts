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
    
    for (const file of files) {
      try {
        this.compileFile(file);
      } catch (error) {
        console.error(`Error compiling ${file}:`, error);
      }
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

    // Create and run visitor
    const visitor = new CGenerationVisitor(this.options.outputDir);
    visitor.visit(tree);
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