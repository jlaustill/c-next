/**
 * C-Next Transpiler
 * A safer C for embedded systems development
 */

import { CharStream, CommonTokenStream } from 'antlr4ng';
import { CNextLexer } from './parser/grammar/CNextLexer.js';
import { CNextParser } from './parser/grammar/CNextParser.js';
import CodeGenerator from './codegen/CodeGenerator.js';
import { readFileSync, writeFileSync } from 'fs';

function main(): void {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('C-Next Transpiler v0.1.0');
        console.log('');
        console.log('Usage: cnx <file.cnx> [-o output.c]');
        console.log('');
        console.log('Options:');
        console.log('  -o <file>    Write output to file (default: stdout)');
        console.log('  --parse      Parse only, don\'t generate code');
        console.log('');
        console.log('A safer C for embedded systems development.');
        process.exit(0);
    }

    // Parse arguments
    let inputFile = '';
    let outputFile = '';
    let parseOnly = false;

    for (let i = 0; i < args.length; i++) {
        if (args[i] === '-o' && i + 1 < args.length) {
            outputFile = args[++i];
        } else if (args[i] === '--parse') {
            parseOnly = true;
        } else if (!args[i].startsWith('-')) {
            inputFile = args[i];
        }
    }

    if (!inputFile) {
        console.error('Error: No input file specified');
        process.exit(1);
    }

    try {
        const input = readFileSync(inputFile, 'utf-8');
        const result = compile(input, parseOnly);

        if (result.errors.length > 0) {
            console.error('Errors:');
            result.errors.forEach(err => console.error(`  ${err}`));
            process.exit(1);
        }

        if (parseOnly) {
            console.log('Parse successful!');
            console.log(`Found ${result.declarations} top-level declarations`);
        } else {
            if (outputFile) {
                writeFileSync(outputFile, result.code);
                console.log(`Generated: ${outputFile}`);
            } else {
                console.log(result.code);
            }
        }

    } catch (err) {
        console.error(`Error reading file: ${inputFile}`);
        console.error(err);
        process.exit(1);
    }
}

interface CompileResult {
    errors: string[];
    declarations: number;
    code: string;
}

function compile(input: string, parseOnly: boolean = false): CompileResult {
    const errors: string[] = [];

    // Create the lexer and parser
    const charStream = CharStream.fromString(input);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    // Custom error listener
    parser.removeErrorListeners();
    parser.addErrorListener({
        syntaxError(_recognizer, _offendingSymbol, line, charPositionInLine, msg, _e) {
            errors.push(`Line ${line}:${charPositionInLine} - ${msg}`);
        },
        reportAmbiguity() {},
        reportAttemptingFullContext() {},
        reportContextSensitivity() {}
    });

    // Parse the input
    const tree = parser.program();

    if (errors.length > 0 || parseOnly) {
        return {
            errors,
            declarations: tree.declaration().length,
            code: ''
        };
    }

    // Generate C code
    const generator = new CodeGenerator();
    const code = generator.generate(tree);

    return {
        errors,
        declarations: tree.declaration().length,
        code
    };
}

export { compile };

main();
