#!/usr/bin/env node
/**
 * C-Next Transpiler CLI
 * A safer C for embedded systems development
 */

import {
  transpile,
  ITranspileResult,
  ITranspileError,
} from "./lib/transpiler.js";
import { detectPlatformIOTarget } from "./lib/PlatformIODetector.js";
import Project from "./project/Project.js";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { dirname, resolve } from "path";

/**
 * C-Next configuration file options
 */
interface ICNextConfig {
  outputExtension?: ".c" | ".cpp";
  generateHeaders?: boolean;
  debugMode?: boolean;
  target?: string; // ADR-049: Target platform (e.g., "teensy41", "cortex-m0")
}

/**
 * Config file names in priority order (highest first)
 */
const CONFIG_FILES = ["cnext.config.json", ".cnext.json", ".cnextrc"];

/**
 * Load config from project directory, searching up the directory tree
 */
function loadConfig(startDir: string): ICNextConfig {
  let dir = resolve(startDir);

  while (dir !== dirname(dir)) {
    // Stop at filesystem root
    for (const configFile of CONFIG_FILES) {
      const configPath = resolve(dir, configFile);
      if (existsSync(configPath)) {
        try {
          const content = readFileSync(configPath, "utf-8");
          return JSON.parse(content) as ICNextConfig;
        } catch (err) {
          console.error(`Warning: Failed to parse ${configPath}`);
          return {};
        }
      }
    }
    dir = dirname(dir);
  }

  return {}; // No config found
}

// Re-export library for backwards compatibility
export { transpile, ITranspileResult, ITranspileError };

const VERSION = "0.2.0";

function showHelp(): void {
  console.log(`C-Next Transpiler v${VERSION}`);
  console.log("");
  console.log("Usage:");
  console.log(
    "  cnext <file.cnx>                          Single file (outputs file.c)",
  );
  console.log(
    "  cnext <file.cnx> -o <output.c>            Single file with explicit output",
  );
  console.log("  cnext <files...> -o <dir>                 Multi-file mode");
  console.log("  cnext --project <dir> [-o <outdir>]       Project mode");
  console.log("");
  console.log("Options:");
  console.log(
    "  -o <file|dir>      Output file or directory (default: same dir as input)",
  );
  console.log(
    "  --cpp              Output .cpp instead of .c (for C++ features like Serial)",
  );
  console.log("  --project <dir>    Compile all .cnx files in directory");
  console.log("  --include <dir>    Additional include directory (can repeat)");
  console.log("  --parse            Parse only, don't generate code");
  console.log(
    "  --debug            Generate panic-on-overflow helpers (ADR-044)",
  );
  console.log(
    "  --target <name>    Target platform for atomic code gen (ADR-049)",
  );
  console.log(
    "                     Options: teensy41, cortex-m7/m4/m3/m0+/m0, avr",
  );
  console.log("  --no-headers       Don't generate header files");
  console.log("  --no-preprocess    Don't run C preprocessor on headers");
  console.log("  -D<name>[=value]   Define preprocessor macro");
  console.log("  --version, -v      Show version");
  console.log("  --help, -h         Show this help");
  console.log("");
  console.log("Examples:");
  console.log("  cnext main.cnx                            # Outputs main.c");
  console.log(
    "  cnext main.cnx -o build/main.c            # Explicit output path",
  );
  console.log(
    "  cnext src/*.cnx -o build/                 # Multiple files to directory",
  );
  console.log("  cnext --project ./src -o ./build          # Project mode");
  console.log("");
  console.log("Config files (searched in order, JSON format):");
  console.log("  cnext.config.json, .cnext.json, .cnextrc");
  console.log("");
  console.log("Config example:");
  console.log('  { "outputExtension": ".cpp" }');
  console.log("");
  console.log("A safer C for embedded systems development.");
}

/**
 * Derive output path from input path (.cnx → .c or .cpp in same directory)
 */
function deriveOutputPath(
  inputFile: string,
  cppOutput: boolean = false,
): string {
  const ext = cppOutput ? ".cpp" : ".c";
  return inputFile.replace(/\.cnx$/, ext);
}

/**
 * Single file compilation (original mode)
 */
function runSingleFileMode(
  inputFile: string,
  outputFile: string,
  parseOnly: boolean,
  debugMode: boolean = false,
  cppOutput: boolean = false,
  target?: string,
): void {
  // Default output: same directory, .cnx → .c (or .cpp with --cpp flag)
  const effectiveOutput = outputFile || deriveOutputPath(inputFile, cppOutput);

  try {
    const input = readFileSync(inputFile, "utf-8");
    const result = transpile(input, { parseOnly, debugMode, target });

    if (!result.success) {
      console.error("Errors:");
      result.errors.forEach((err) =>
        console.error(`  Line ${err.line}:${err.column} - ${err.message}`),
      );
      process.exit(1);
    }

    if (parseOnly) {
      console.log("Parse successful!");
      console.log(`Found ${result.declarationCount} top-level declarations`);
    } else {
      writeFileSync(effectiveOutput, result.code);
      console.log(`Generated: ${effectiveOutput}`);
    }
  } catch (err) {
    console.error(`Error reading file: ${inputFile}`);
    console.error(err);
    process.exit(1);
  }
}

/**
 * Print project compilation result
 */
function printProjectResult(result: {
  success: boolean;
  filesProcessed: number;
  symbolsCollected: number;
  conflicts: string[];
  errors: string[];
  warnings: string[];
  outputFiles: string[];
}): void {
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
    console.log("");
    console.log(`Compiled ${result.filesProcessed} files`);
    console.log(`Collected ${result.symbolsCollected} symbols`);
    console.log(`Generated ${result.outputFiles.length} output files:`);
    for (const file of result.outputFiles) {
      console.log(`  ${file}`);
    }
  } else {
    console.error("");
    console.error("Compilation failed");
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
  preprocess: boolean,
): Promise<void> {
  if (!outDir) {
    console.error(
      "Error: Output directory required for multi-file mode (-o <dir>)",
    );
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
  preprocess: boolean,
): Promise<void> {
  const project = new Project({
    srcDirs: [projectDir],
    includeDirs,
    outDir: outDir || "./build",
    generateHeaders,
    preprocess,
    defines,
  });

  const result = await project.compile();
  printProjectResult(result);

  process.exit(result.success ? 0 : 1);
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
    errors: result.errors.map(
      (e) => `Line ${e.line}:${e.column} - ${e.message}`,
    ),
    declarations: result.declarationCount,
    code: result.code,
  };
}

export { compile };

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes("--help") || args.includes("-h")) {
    showHelp();
    process.exit(0);
  }

  if (args.includes("--version") || args.includes("-v")) {
    console.log(`cnext v${VERSION}`);
    process.exit(0);
  }

  // Parse arguments (first pass to get input files for config lookup)
  const inputFiles: string[] = [];
  let outputPath = "";
  let projectDir = "";
  const includeDirs: string[] = [];
  const defines: Record<string, string | boolean> = {};
  let parseOnly = false;
  let cliDebugMode: boolean | undefined;
  let cliTarget: string | undefined;
  let cliGenerateHeaders: boolean | undefined;
  let preprocess = true;
  let cliCppOutput: boolean | undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-o" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg === "--project" && i + 1 < args.length) {
      projectDir = args[++i];
    } else if (arg === "--include" && i + 1 < args.length) {
      includeDirs.push(args[++i]);
    } else if (arg === "--parse") {
      parseOnly = true;
    } else if (arg === "--debug") {
      cliDebugMode = true;
    } else if (arg === "--target" && i + 1 < args.length) {
      cliTarget = args[++i];
    } else if (arg === "--cpp") {
      cliCppOutput = true;
    } else if (arg === "--no-headers") {
      cliGenerateHeaders = false;
    } else if (arg === "--no-preprocess") {
      preprocess = false;
    } else if (arg.startsWith("-D")) {
      const define = arg.slice(2);
      const eqIndex = define.indexOf("=");
      if (eqIndex > 0) {
        defines[define.slice(0, eqIndex)] = define.slice(eqIndex + 1);
      } else {
        defines[define] = true;
      }
    } else if (!arg.startsWith("-")) {
      inputFiles.push(arg);
    }
  }

  // Load config file (searches up from input file or project directory)
  const configDir =
    projectDir ||
    (inputFiles.length > 0 ? dirname(resolve(inputFiles[0])) : process.cwd());
  const config = loadConfig(configDir);

  // Apply config defaults, CLI flags take precedence
  const cppOutput = cliCppOutput ?? config.outputExtension === ".cpp";
  const debugMode = cliDebugMode ?? config.debugMode ?? false;
  const generateHeaders = cliGenerateHeaders ?? config.generateHeaders ?? true;

  // ADR-049: Target resolution priority: CLI > config > PlatformIO > pragma > default
  // Detect PlatformIO target as fallback (only for single-file mode currently)
  const pioTarget =
    inputFiles.length === 1
      ? detectPlatformIOTarget(dirname(resolve(inputFiles[0])))
      : undefined;
  const target = cliTarget ?? config.target ?? pioTarget;

  // Determine mode
  if (projectDir) {
    // Project mode
    await runProjectMode(
      projectDir,
      outputPath,
      includeDirs,
      defines,
      generateHeaders,
      preprocess,
    );
  } else if (inputFiles.length > 1) {
    // Multi-file mode
    await runMultiFileMode(
      inputFiles,
      outputPath,
      includeDirs,
      defines,
      generateHeaders,
      preprocess,
    );
  } else if (inputFiles.length === 1) {
    // Single file mode
    runSingleFileMode(
      inputFiles[0],
      outputPath,
      parseOnly,
      debugMode,
      cppOutput,
      target,
    );
  } else {
    console.error("Error: No input files specified");
    showHelp();
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
