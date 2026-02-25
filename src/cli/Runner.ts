/**
 * Runner
 * Executes the transpiler with the given configuration
 */

import { dirname, resolve } from "node:path";
import { existsSync, statSync, renameSync } from "node:fs";
import Transpiler from "../transpiler/Transpiler";
import ICliConfig from "./types/ICliConfig";
import ResultPrinter from "./ResultPrinter";
import ITranspilerResult from "../transpiler/types/ITranspilerResult";

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
    const resolvedInput = resolve(config.input);
    const { outDir, explicitOutputFile } = this._determineOutputPath(
      config,
      resolvedInput,
    );

    // Infer basePath from entry file's parent directory if not set
    const basePath = config.basePath || dirname(resolvedInput);

    const pipeline = new Transpiler({
      input: resolvedInput,
      includeDirs: config.includeDirs,
      outDir,
      headerOutDir: config.headerOutDir,
      basePath,
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
   * Determine output directory and explicit filename from config.
   */
  private static _determineOutputPath(
    config: ICliConfig,
    resolvedInput: string,
  ): IOutputPathResult {
    if (!config.outputPath) {
      return { outDir: dirname(resolvedInput), explicitOutputFile: null };
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
