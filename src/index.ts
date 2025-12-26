/**
 * C-Next Transpiler
 * A safer C for embedded systems development
 */

import { CharStream, CommonTokenStream } from 'antlr4ng';
import { CNextLexer } from './parser/grammar/CNextLexer.js';
import { CNextParser } from './parser/grammar/CNextParser.js';
import { readFileSync } from 'fs';

function main(): void {
    const args = process.argv.slice(2);

    if (args.length === 0) {
        console.log('C-Next Transpiler v0.1.0');
        console.log('Usage: cnx <file.cnx> [-o output.c]');
        console.log('');
        console.log('A safer C for embedded systems development.');
        process.exit(0);
    }

    const inputFile = args[0];

    try {
        const input = readFileSync(inputFile, 'utf-8');
        const result = parse(input);

        if (result.errors.length > 0) {
            console.error('Parse errors:');
            result.errors.forEach(err => console.error(`  ${err}`));
            process.exit(1);
        }

        console.log('Parse successful!');
        console.log(`Found ${result.declarations} top-level declarations`);

    } catch (err) {
        console.error(`Error reading file: ${inputFile}`);
        console.error(err);
        process.exit(1);
    }
}

interface ParseResult {
    errors: string[];
    declarations: number;
}

function parse(input: string): ParseResult {
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

    return {
        errors,
        declarations: tree.declaration().length
    };
}

export { parse };

main();
