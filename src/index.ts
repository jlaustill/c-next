/**
 * C-Next Transpiler CLI
 * A safer C for embedded systems development
 */

import { transpile, ITranspileResult, ITranspileError } from './lib/transpiler.js';
import Project from './project/Project.js';
import { readFileSync, writeFileSync } from 'fs';

// Re-export library for backwards compatibility
export { transpile, ITranspileResult, ITranspileError };

const VERSION = '0.2.0';

function showHelp(): void {
    console.log(`C-Next Transpiler v${VERSION}`);
    console.log('');
    console.log('Usage:');
    console.log('  cnx <file.cnx> [-o output.c]              Single file mode');
    console.log('  cnx <files...> -o <dir>                   Multi-file mode');
    console.log('  cnx --project <dir> [-o <outdir>]         Project mode');
    console.log('');
    console.log('Options:');
    console.log('  -o <file|dir>      Output file or directory');
    console.log('  --project <dir>    Compile all .cnx files in directory');
    console.log('  --include <dir>    Additional include directory (can repeat)');
    console.log('  --parse            Parse only, don\'t generate code');
    console.log('  --no-headers       Don\'t generate header files');
    console.log('  --no-preprocess    Don\'t run C preprocessor on headers');
    console.log('  -D<name>[=value]   Define preprocessor macro');
    console.log('  --version          Show version');
    console.log('  --help             Show this help');
    console.log('');
    console.log('Examples:');
    console.log('  cnx main.cnx -o main.c');
    console.log('  cnx src/*.cnx -o build/');
    console.log('  cnx --project ./src -o ./build --include ./lib');
    console.log('');
    console.log('A safer C for embedded systems development.');
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args.includes('--help')) {
        showHelp();
        process.exit(0);
    }

    if (args.includes('--version')) {
        console.log(`c-next v${VERSION}`);
        process.exit(0);
    }

    // Parse arguments
    const inputFiles: string[] = [];
    let outputPath = '';
    let projectDir = '';
    const includeDirs: string[] = [];
    const defines: Record<string, string | boolean> = {};
    let parseOnly = false;
    let generateHeaders = true;
    let preprocess = true;

    for (let i = 0; i < args.length; i++) {
        const arg = args[i];

        if (arg === '-o' && i + 1 < args.length) {
            outputPath = args[++i];
        } else if (arg === '--project' && i + 1 < args.length) {
            projectDir = args[++i];
        } else if (arg === '--include' && i + 1 < args.length) {
            includeDirs.push(args[++i]);
        } else if (arg === '--parse') {
            parseOnly = true;
        } else if (arg === '--no-headers') {
            generateHeaders = false;
        } else if (arg === '--no-preprocess') {
            preprocess = false;
        } else if (arg.startsWith('-D')) {
            const define = arg.slice(2);
            const eqIndex = define.indexOf('=');
            if (eqIndex > 0) {
                defines[define.slice(0, eqIndex)] = define.slice(eqIndex + 1);
            } else {
                defines[define] = true;
            }
        } else if (!arg.startsWith('-')) {
            inputFiles.push(arg);
        }
    }

    // Determine mode
    if (projectDir) {
        // Project mode
        await runProjectMode(projectDir, outputPath, includeDirs, defines, generateHeaders, preprocess);
    } else if (inputFiles.length > 1) {
        // Multi-file mode
        await runMultiFileMode(inputFiles, outputPath, includeDirs, defines, generateHeaders, preprocess);
    } else if (inputFiles.length === 1) {
        // Single file mode
        runSingleFileMode(inputFiles[0], outputPath, parseOnly);
    } else {
        console.error('Error: No input files specified');
        showHelp();
        process.exit(1);
    }
}

/**
 * Single file compilation (original mode)
 */
function runSingleFileMode(inputFile: string, outputFile: string, parseOnly: boolean): void {
    try {
        const input = readFileSync(inputFile, 'utf-8');
        const result = transpile(input, { parseOnly });

        if (!result.success) {
            console.error('Errors:');
            result.errors.forEach(err =>
                console.error(`  Line ${err.line}:${err.column} - ${err.message}`)
            );
            process.exit(1);
        }

        if (parseOnly) {
            console.log('Parse successful!');
            console.log(`Found ${result.declarationCount} top-level declarations`);
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

/**
 * Multi-file compilation
 */
async function runMultiFileMode(
    files: string[],
    outDir: string,
    includeDirs: string[],
    defines: Record<string, string | boolean>,
    generateHeaders: boolean,
    preprocess: boolean
): Promise<void> {
    if (!outDir) {
        console.error('Error: Output directory required for multi-file mode (-o <dir>)');
        process.exit(1);
    }

    const project = new Project({
        srcDirs: [],
        includeDirs,
        outDir,
        files,
        generateHeaders,
        preprocess,
        defines,
    });

    const result = await project.compile();
    printProjectResult(result);

    process.exit(result.success ? 0 : 1);
}

/**
 * Project mode compilation
 */
async function runProjectMode(
    projectDir: string,
    outDir: string,
    includeDirs: string[],
    defines: Record<string, string | boolean>,
    generateHeaders: boolean,
    preprocess: boolean
): Promise<void> {
    const project = new Project({
        srcDirs: [projectDir],
        includeDirs,
        outDir: outDir || './build',
        generateHeaders,
        preprocess,
        defines,
    });

    const result = await project.compile();
    printProjectResult(result);

    process.exit(result.success ? 0 : 1);
}

/**
 * Print project compilation result
 */
function printProjectResult(result: { success: boolean; filesProcessed: number; symbolsCollected: number; conflicts: string[]; errors: string[]; warnings: string[]; outputFiles: string[] }): void {
    // Print warnings
    for (const warning of result.warnings) {
        console.warn(`Warning: ${warning}`);
    }

    // Print conflicts
    for (const conflict of result.conflicts) {
        console.error(`Conflict: ${conflict}`);
    }

    // Print errors
    for (const error of result.errors) {
        console.error(`Error: ${error}`);
    }

    // Summary
    if (result.success) {
        console.log('');
        console.log(`Compiled ${result.filesProcessed} files`);
        console.log(`Collected ${result.symbolsCollected} symbols`);
        console.log(`Generated ${result.outputFiles.length} output files:`);
        for (const file of result.outputFiles) {
            console.log(`  ${file}`);
        }
    } else {
        console.error('');
        console.error('Compilation failed');
    }
}

/**
 * Legacy compile function for backwards compatibility
 * @deprecated Use transpile() from './lib/transpiler' instead
 */
interface CompileResult {
    errors: string[];
    declarations: number;
    code: string;
}

function compile(input: string, parseOnly: boolean = false): CompileResult {
    const result = transpile(input, { parseOnly });
    return {
        errors: result.errors.map(e => `Line ${e.line}:${e.column} - ${e.message}`),
        declarations: result.declarationCount,
        code: result.code
    };
}

export { compile };

main().catch(err => {
    console.error('Unexpected error:', err);
    process.exit(1);
});
