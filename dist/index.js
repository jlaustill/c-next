"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
// src/index.ts
const antlr4ts_1 = require("antlr4ts");
const cNextLexer_1 = require("./parser/cNextLexer");
const cNextParser_1 = require("./parser/cNextParser");
const CGenerationVisitor_1 = require("./visitors/CGenerationVisitor");
const path = __importStar(require("path"));
const fs = __importStar(require("fs"));
class Compiler {
    constructor(options) {
        this.options = options;
    }
    compile() {
        // Find all .cn and .cnm files in input directory
        const files = this.findSourceFiles();
        for (const file of files) {
            try {
                this.compileFile(file);
            }
            catch (error) {
                console.error(`Error compiling ${file}:`, error);
            }
        }
    }
    findSourceFiles() {
        return fs.readdirSync(this.options.inputDir)
            .filter(file => file.endsWith('.cn') || file.endsWith('.cnm'))
            .map(file => path.join(this.options.inputDir, file));
    }
    compileFile(filePath) {
        const input = fs.readFileSync(filePath, 'utf8');
        const isMainFile = filePath.endsWith('.cnm');
        // Create the lexer and parser
        const inputStream = antlr4ts_1.CharStreams.fromString(input);
        const lexer = new cNextLexer_1.cNextLexer(inputStream);
        const tokenStream = new antlr4ts_1.CommonTokenStream(lexer);
        const parser = new cNextParser_1.cNextParser(tokenStream);
        // Get the appropriate root rule based on file type
        const tree = isMainFile ? parser.mainSourceFile() : parser.sourceFile();
        // Create and run visitor with include paths
        const includePaths = [path.dirname(filePath)]; // Add source file directory to include paths
        const visitor = new CGenerationVisitor_1.CGenerationVisitor(this.options.outputDir, includePaths);
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
    const options = {
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
