/**
 * C-Next Transpiler Library
 * Core transpilation API for use by CLI and VS Code extension
 */

import { CharStream, CommonTokenStream } from 'antlr4ng';
import { CNextLexer } from '../parser/grammar/CNextLexer.js';
import { CNextParser } from '../parser/grammar/CNextParser.js';
import CodeGenerator from '../codegen/CodeGenerator.js';
import { ITranspileResult, ITranspileError } from './types/ITranspileResult.js';

export { ITranspileResult, ITranspileError };

/**
 * Options for transpilation
 */
export interface ITranspileOptions {
    /** Parse only, don't generate code */
    parseOnly?: boolean;
}

/**
 * Transpile C-Next source code to C
 *
 * @param source - C-Next source code string
 * @param options - Optional transpilation options
 * @returns Transpilation result with code or errors
 *
 * @example
 * ```typescript
 * import { transpile } from './lib/transpiler';
 *
 * const result = transpile('u32 x <- 5;');
 * if (result.success) {
 *     console.log(result.code);
 * } else {
 *     result.errors.forEach(e => console.error(`${e.line}:${e.column} ${e.message}`));
 * }
 * ```
 */
export function transpile(source: string, options: ITranspileOptions = {}): ITranspileResult {
    const { parseOnly = false } = options;
    const errors: ITranspileError[] = [];

    // Create the lexer and parser
    const charStream = CharStream.fromString(source);
    const lexer = new CNextLexer(charStream);
    const tokenStream = new CommonTokenStream(lexer);
    const parser = new CNextParser(tokenStream);

    // Custom error listener to collect errors with line/column info
    lexer.removeErrorListeners();
    parser.removeErrorListeners();

    const errorListener = {
        syntaxError(
            _recognizer: unknown,
            _offendingSymbol: unknown,
            line: number,
            charPositionInLine: number,
            msg: string,
            _e: unknown
        ): void {
            errors.push({
                line,
                column: charPositionInLine,
                message: msg,
                severity: 'error'
            });
        },
        reportAmbiguity(): void {},
        reportAttemptingFullContext(): void {},
        reportContextSensitivity(): void {}
    };

    lexer.addErrorListener(errorListener);
    parser.addErrorListener(errorListener);

    // Parse the input
    let tree;
    try {
        tree = parser.program();
    } catch (e) {
        // Handle catastrophic parse failures
        const errorMessage = e instanceof Error ? e.message : String(e);
        errors.push({
            line: 1,
            column: 0,
            message: `Parse failed: ${errorMessage}`,
            severity: 'error'
        });
        return {
            success: false,
            code: '',
            errors,
            declarationCount: 0
        };
    }

    const declarationCount = tree.declaration().length;

    // If there are parse errors or parseOnly mode, return early
    if (errors.length > 0) {
        return {
            success: false,
            code: '',
            errors,
            declarationCount
        };
    }

    if (parseOnly) {
        return {
            success: true,
            code: '',
            errors: [],
            declarationCount
        };
    }

    // Generate C code
    try {
        const generator = new CodeGenerator();
        const code = generator.generate(tree);

        return {
            success: true,
            code,
            errors: [],
            declarationCount
        };
    } catch (e) {
        // Handle code generation errors
        const errorMessage = e instanceof Error ? e.message : String(e);
        errors.push({
            line: 1,
            column: 0,
            message: `Code generation failed: ${errorMessage}`,
            severity: 'error'
        });
        return {
            success: false,
            code: '',
            errors,
            declarationCount
        };
    }
}

/**
 * Parse C-Next source and return parse result without generating code
 * Convenience wrapper around transpile with parseOnly: true
 */
export function parse(source: string): ITranspileResult {
    return transpile(source, { parseOnly: true });
}

export default transpile;
