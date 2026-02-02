/**
 * Runner
 * Executes the transpiler with the given configuration
 */

import { dirname, resolve } from "node:path";
import { existsSync, statSync, renameSync } from "node:fs";
import InputExpansion from "../transpiler/data/InputExpansion";
import Transpiler from "../transpiler/Transpiler";
import ICliConfig from "./types/ICliConfig";
import ResultPrinter from "./ResultPrinter";

/**
 * Execute the transpiler
 */
class Runner {
  /**
   * Execute the transpiler with the given configuration
   * @param config - CLI configuration
   */
  static async execute(config: ICliConfig): Promise<void> {
    // Identify which inputs are directories (for structure preservation)
    // These will be passed to Transpiler so it can preserve directory structure
    const srcDirs: string[] = [];
    const explicitFiles: string[] = [];

    for (const input of config.inputs) {
      const resolvedPath = resolve(input);
      if (existsSync(resolvedPath) && statSync(resolvedPath).isDirectory()) {
        srcDirs.push(resolvedPath);
      } else {
        explicitFiles.push(resolvedPath);
      }
    }

    // Step 1: Expand directories to .cnx files
    let files: string[];
    try {
      files = InputExpansion.expandInputs(config.inputs);
    } catch (error) {
      console.error(`Error: ${error}`);
      process.exit(1);
    }

    if (files.length === 0) {
      console.error("Error: No .cnx files found");
      process.exit(1);
    }

    // Step 2: Determine output directory and explicit filename
    // Note: Include path auto-discovery happens inside Transpiler.discoverSources()
    let outDir: string;
    let explicitOutputFile: string | null = null;

    // Check if outputPath is an explicit file (ends with .c or .cpp)
    const isExplicitFile =
      config.outputPath &&
      /\.(c|cpp)$/.test(config.outputPath) &&
      !config.outputPath.endsWith("/");

    if (config.outputPath) {
      // User specified -o
      const stats = existsSync(config.outputPath)
        ? statSync(config.outputPath)
        : null;
      if (stats?.isDirectory() || config.outputPath.endsWith("/")) {
        outDir = config.outputPath;
      } else if (isExplicitFile) {
        // Explicit output file path
        if (files.length > 1) {
          console.error(
            "Error: Cannot use explicit output filename with multiple input files",
          );
          console.error("Use a directory path instead: -o <directory>/");
          process.exit(1);
        }
        outDir = dirname(config.outputPath);
        explicitOutputFile = resolve(config.outputPath);
      } else {
        outDir = config.outputPath;
      }
    } else {
      // No -o flag: use same directory as first input file
      outDir = dirname(files[0]);
    }

    // Step 3: Create Transpiler
    // Combine srcDirs and explicitFiles into inputs - Transpiler handles both
    const pipelineInputs = [...srcDirs, ...explicitFiles];
    const pipeline = new Transpiler({
      inputs: pipelineInputs,
      includeDirs: config.includeDirs,
      outDir,
      headerOutDir: config.headerOutDir,
      basePath: config.basePath,
      preprocess: config.preprocess,
      defines: config.defines,
      cppRequired: config.cppRequired,
      noCache: config.noCache,
      parseOnly: config.parseOnly,
      target: config.target,
      debugMode: config.debugMode,
    });

    // Step 4: Compile
    const result = await pipeline.run();

    // Step 5: Rename output file if explicit filename was specified
    if (explicitOutputFile && result.success && result.outputFiles.length > 0) {
      const generatedFile = result.outputFiles[0];
      // Only rename if it's different from the desired path
      if (generatedFile !== explicitOutputFile) {
        renameSync(generatedFile, explicitOutputFile);
        // Update the result to show the correct path
        result.outputFiles[0] = explicitOutputFile;
      }
    }

    ResultPrinter.print(result);
    process.exit(result.success ? 0 : 1);
  }
}

export default Runner;
