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
import ITranspilerResult from "../transpiler/types/ITranspilerResult";

/** Result of categorizing inputs into directories and files */
interface ICategorizedInputs {
  srcDirs: string[];
  explicitFiles: string[];
}

/** Result of determining output path */
interface IOutputPathResult {
  outDir: string;
  explicitOutputFile: string | null;
}

/**
 * Execute the transpiler
 */
class Runner {
  /**
   * Execute the transpiler with the given configuration
   * @param config - CLI configuration
   */
  static async execute(config: ICliConfig): Promise<void> {
    const { srcDirs, explicitFiles } = this._categorizeInputs(config.inputs);
    const files = this._expandInputFiles(config.inputs);
    const { outDir, explicitOutputFile } = this._determineOutputPath(
      config,
      files,
    );

    const pipeline = new Transpiler({
      inputs: [...srcDirs, ...explicitFiles],
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

    const result = await pipeline.transpile({ kind: "files" });
    this._renameOutputIfNeeded(result, explicitOutputFile);

    ResultPrinter.print(result);
    process.exit(result.success ? 0 : 1);
  }

  /**
   * Categorize inputs into directories and explicit files.
   */
  private static _categorizeInputs(inputs: string[]): ICategorizedInputs {
    const srcDirs: string[] = [];
    const explicitFiles: string[] = [];

    for (const input of inputs) {
      const resolvedPath = resolve(input);
      const isDir =
        existsSync(resolvedPath) && statSync(resolvedPath).isDirectory();
      if (isDir) {
        srcDirs.push(resolvedPath);
      } else {
        explicitFiles.push(resolvedPath);
      }
    }

    return { srcDirs, explicitFiles };
  }

  /**
   * Expand input paths to .cnx files.
   */
  private static _expandInputFiles(inputs: string[]): string[] {
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

    return files;
  }

  /**
   * Determine output directory and explicit filename from config.
   */
  private static _determineOutputPath(
    config: ICliConfig,
    files: string[],
  ): IOutputPathResult {
    if (!config.outputPath) {
      return { outDir: dirname(files[0]), explicitOutputFile: null };
    }

    const isExplicitFile =
      /\.(c|cpp)$/.test(config.outputPath) && !config.outputPath.endsWith("/");

    const stats = existsSync(config.outputPath)
      ? statSync(config.outputPath)
      : null;

    // Directory path
    if (stats?.isDirectory() || config.outputPath.endsWith("/")) {
      return { outDir: config.outputPath, explicitOutputFile: null };
    }

    // Explicit output file
    if (isExplicitFile) {
      if (files.length > 1) {
        console.error(
          "Error: Cannot use explicit output filename with multiple input files",
        );
        console.error("Use a directory path instead: -o <directory>/");
        process.exit(1);
      }
      return {
        outDir: dirname(config.outputPath),
        explicitOutputFile: resolve(config.outputPath),
      };
    }

    // Default: treat as directory
    return { outDir: config.outputPath, explicitOutputFile: null };
  }

  /**
   * Rename output file if explicit filename was specified.
   */
  private static _renameOutputIfNeeded(
    result: ITranspilerResult,
    explicitOutputFile: string | null,
  ): void {
    if (
      !explicitOutputFile ||
      !result.success ||
      result.outputFiles.length === 0
    ) {
      return;
    }

    const generatedFile = result.outputFiles[0];
    if (generatedFile !== explicitOutputFile) {
      renameSync(generatedFile, explicitOutputFile);
      result.outputFiles[0] = explicitOutputFile;
    }
  }
}

export default Runner;
