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
import { IncludeDiscovery } from "./lib/IncludeDiscovery.js";
import { InputExpansion } from "./lib/InputExpansion.js";
import Project from "./project/Project.js";
import { readFileSync, writeFileSync, existsSync, unlinkSync, statSync } from "fs";
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
  console.log("  --include <dir>    Additional include directory (can repeat)");
  console.log("  --verbose          Show include path discovery");
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
  console.log(
    "  --exclude-headers  Don't generate header files (default: generate)",
  );
  console.log("  --no-preprocess    Don't run C preprocessor on headers");
  console.log("  -D<name>[=value]   Define preprocessor macro");
  console.log("  --pio-install      Setup PlatformIO integration");
  console.log("  --pio-uninstall    Remove PlatformIO integration");
  console.log("  --version, -v      Show version");
  console.log("  --help, -h         Show this help");
  console.log("");
  console.log("Examples:");
  console.log("  cnext main.cnx                            # Outputs main.c (same dir)");
  console.log(
    "  cnext main.cnx -o build/main.c            # Explicit output path",
  );
  console.log(
    "  cnext src/*.cnx -o build/                 # Multiple files to directory",
  );
  console.log("  cnext src/                                # Compile all .cnx files in src/ (recursive)");
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
 * Unified mode - always use Project class with header discovery
 */
async function runUnifiedMode(
  inputs: string[],
  outputPath: string,
  includeDirs: string[],
  defines: Record<string, string | boolean>,
  generateHeaders: boolean,
  preprocess: boolean,
  verbose: boolean,
): Promise<void> {
  // Step 1: Expand directories to .cnx files
  let files: string[];
  try {
    files = InputExpansion.expandInputs(inputs);
  } catch (error) {
    console.error(`Error: ${error}`);
    process.exit(1);
  }

  if (files.length === 0) {
    console.error("Error: No .cnx files found");
    process.exit(1);
  }

  // Step 2: Auto-discover include paths from first file
  const autoIncludePaths = IncludeDiscovery.discoverIncludePaths(files[0]);
  const allIncludePaths = [...autoIncludePaths, ...includeDirs];

  if (verbose) {
    console.log("Include paths:");
    for (const path of allIncludePaths) {
      console.log(`  ${path}`);
    }
  }

  // Step 3: Determine output directory
  let outDir: string;
  if (outputPath) {
    // User specified -o
    const stats = existsSync(outputPath) ? statSync(outputPath) : null;
    if (stats?.isDirectory() || outputPath.endsWith("/")) {
      outDir = outputPath;
    } else if (files.length === 1) {
      // Single file + explicit file path -> use directory
      outDir = dirname(outputPath);
    } else {
      outDir = outputPath;
    }
  } else {
    // No -o flag: use same directory as first input file
    outDir = dirname(files[0]);
  }

  // Step 4: Create Project
  const project = new Project({
    srcDirs: [], // No srcDirs, use explicit files
    files,
    includeDirs: allIncludePaths,
    outDir,
    generateHeaders,
    preprocess,
    defines,
  });

  // Step 5: Compile
  const result = await project.compile();
  printProjectResult(result);
  process.exit(result.success ? 0 : 1);
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

/**
 * Setup PlatformIO integration
 * Creates cnext_build.py and modifies platformio.ini
 */
function setupPlatformIO(): void {
  const pioIniPath = resolve(process.cwd(), "platformio.ini");
  const scriptPath = resolve(process.cwd(), "cnext_build.py");

  // Check if platformio.ini exists
  if (!existsSync(pioIniPath)) {
    console.error("Error: platformio.ini not found in current directory");
    console.error("Run this command from your PlatformIO project root");
    process.exit(1);
  }

  // Create cnext_build.py script
  const buildScript = `Import("env")
import subprocess
from pathlib import Path

def transpile_cnext(source, target, env):
    """Transpile all .cnx files before build"""
    # Find all .cnx files in src directory
    src_dir = Path("src")
    if not src_dir.exists():
        return

    cnx_files = list(src_dir.rglob("*.cnx"))
    if not cnx_files:
        return

    print(f"Transpiling {len(cnx_files)} c-next files...")

    for cnx_file in cnx_files:
        try:
            result = subprocess.run(
                ["cnext", str(cnx_file)],
                check=True,
                capture_output=True,
                text=True
            )
            print(f"  ✓ {cnx_file.name}")
        except subprocess.CalledProcessError as e:
            print(f"  ✗ Error: {cnx_file.name}")
            print(e.stderr)
            env.Exit(1)

env.AddPreAction("buildprog", transpile_cnext)
`;

  writeFileSync(scriptPath, buildScript, "utf-8");
  console.log(`✓ Created: ${scriptPath}`);

  // Read platformio.ini
  let pioIni = readFileSync(pioIniPath, "utf-8");

  // Check if extra_scripts is already present
  if (pioIni.includes("cnext_build.py")) {
    console.log("✓ PlatformIO already configured for c-next");
    return;
  }

  // Add extra_scripts line to [env:*] section or create it
  if (pioIni.includes("extra_scripts")) {
    // Append to existing extra_scripts
    pioIni = pioIni.replace(
      /extra_scripts\s*=\s*(.+)/,
      "extra_scripts = $1\n    pre:cnext_build.py",
    );
  } else {
    // Add new extra_scripts line after first [env:*] section
    pioIni = pioIni.replace(
      /(\[env:[^\]]+\])/,
      "$1\nextra_scripts = pre:cnext_build.py",
    );
  }

  writeFileSync(pioIniPath, pioIni, "utf-8");
  console.log(`✓ Modified: ${pioIniPath}`);

  console.log("");
  console.log("✓ PlatformIO integration configured!");
  console.log("");
  console.log("Next steps:");
  console.log("  1. Create .cnx files in src/ (alongside your .c/.cpp files)");
  console.log("  2. Run: pio run");
  console.log("");
  console.log(
    "The transpiler will automatically convert .cnx → .c before each build.",
  );
  console.log("Commit both .cnx and generated .c files to version control.");
}

/**
 * Remove PlatformIO integration
 * Deletes cnext_build.py and removes extra_scripts from platformio.ini
 */
function uninstallPlatformIO(): void {
  const pioIniPath = resolve(process.cwd(), "platformio.ini");
  const scriptPath = resolve(process.cwd(), "cnext_build.py");

  // Check if platformio.ini exists
  if (!existsSync(pioIniPath)) {
    console.error("Error: platformio.ini not found in current directory");
    console.error("Run this command from your PlatformIO project root");
    process.exit(1);
  }

  let hasChanges = false;

  // Remove cnext_build.py if it exists
  if (existsSync(scriptPath)) {
    try {
      unlinkSync(scriptPath);
      console.log(`✓ Removed: ${scriptPath}`);
      hasChanges = true;
    } catch (err) {
      console.error(`Error removing ${scriptPath}:`, err);
      process.exit(1);
    }
  } else {
    console.log("✓ cnext_build.py not found (already removed)");
  }

  // Read platformio.ini
  let pioIni = readFileSync(pioIniPath, "utf-8");

  // Check if extra_scripts includes cnext_build.py
  if (pioIni.includes("cnext_build.py")) {
    // Remove the cnext_build.py reference
    // Handle both standalone and appended cases
    pioIni = pioIni
      // Remove standalone "extra_scripts = pre:cnext_build.py" line (with newline)
      .replace(/^extra_scripts\s*=\s*pre:cnext_build\.py\s*\n/m, "")
      // Remove from multi-line extra_scripts (e.g., "    pre:cnext_build.py")
      .replace(/\s+pre:cnext_build\.py/g, "")
      // Clean up multiple consecutive blank lines
      .replace(/\n\n\n+/g, "\n\n");

    writeFileSync(pioIniPath, pioIni, "utf-8");
    console.log(`✓ Modified: ${pioIniPath}`);
    hasChanges = true;
  } else {
    console.log("✓ platformio.ini already clean (no c-next integration found)");
  }

  if (hasChanges) {
    console.log("");
    console.log("✓ PlatformIO integration removed!");
    console.log("");
    console.log("Your .cnx files remain untouched.");
    console.log("To re-enable integration: cnext --pio-install");
  } else {
    console.log("");
    console.log("No c-next integration found - nothing to remove.");
  }
}

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

  if (args.includes("--pio-install")) {
    setupPlatformIO();
    process.exit(0);
  }

  if (args.includes("--pio-uninstall")) {
    uninstallPlatformIO();
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
  let verbose = false;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === "-o" && i + 1 < args.length) {
      outputPath = args[++i];
    } else if (arg === "--include" && i + 1 < args.length) {
      includeDirs.push(args[++i]);
    } else if (arg === "--verbose") {
      verbose = true;
    } else if (arg === "--parse") {
      parseOnly = true;
    } else if (arg === "--debug") {
      cliDebugMode = true;
    } else if (arg === "--target" && i + 1 < args.length) {
      cliTarget = args[++i];
    } else if (arg === "--cpp") {
      cliCppOutput = true;
    } else if (arg === "--exclude-headers") {
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

  // Unified mode - always use Project class with header discovery
  if (inputFiles.length === 0) {
    console.error("Error: No input files specified");
    showHelp();
    process.exit(1);
  }

  await runUnifiedMode(
    inputFiles,
    outputPath,
    includeDirs,
    defines,
    generateHeaders,
    preprocess,
    verbose,
  );
}

main().catch((err) => {
  console.error("Unexpected error:", err);
  process.exit(1);
});
