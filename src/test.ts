// src/test.ts
import { CharStreams, CommonTokenStream } from 'antlr4ts';
import { cNextLexer } from './parser/cNextLexer';
import { cNextParser } from './parser/cNextParser';
import { CGenerationVisitor } from './visitors/CGenerationVisitor';
import * as fs from 'fs';
import * as path from 'path';

function testParser() {
    // Read our test file
    const input = fs.readFileSync('./test-files/Math.cn', 'utf8');
    console.log('Input file contents:');
    console.log(input);
    console.log('-------------------');

    // Create the lexer and parser
    const inputStream = CharStreams.fromString(input);
    const lexer = new cNextLexer(inputStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new cNextParser(tokenStream);

    // Parse the input
    const tree = parser.sourceFile();
    
    console.log('Successfully parsed file!');
    console.log('Parse tree:');
    console.log(tree.toStringTree(parser));

    // Generate C code
    const visitor = new CGenerationVisitor('./output');
    visitor.visit(tree);
}

testParser();