/**
 * Project
 * Coordinates multi-file compilation with cross-language symbol resolution
 *
 * This class is now a thin wrapper around Pipeline for backwards compatibility.
 * For new code, consider using Pipeline directly.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, basename, join, relative } from "node:path";
import SymbolTable from "../symbol_resolution/SymbolTable";
import Pipeline from "../pipeline/Pipeline";
import InputExpansion from "../lib/InputExpansion";
import IProjectConfig from "./types/IProjectConfig";
import IProjectResult from "./types/IProjectResult";

/**
 * Manages multi-file C-Next projects
 *
 * @deprecated Consider using Pipeline directly for new code
 */
class Project {
  private readonly config: IProjectConfig;
  private readonly pipeline: Pipeline;

  constructor(config: IProjectConfig) {
    this.config = {
      extensions: [".cnx", ".cnext"],
      preprocess: true,
      ...config,
    };

    // Build inputs list from config
    const inputs: string[] = [];

    // Add explicit files
    if (this.config.files && this.config.files.length > 0) {
      inputs.push(...this.config.files);
    }

    // Add source directories
    if (this.config.srcDirs.length > 0) {
      inputs.push(...this.config.srcDirs);
    }

    // Create pipeline with equivalent configuration
    this.pipeline = new Pipeline({
      inputs,
      includeDirs: this.config.includeDirs,
      outDir: this.config.outDir,
      headerOutDir: this.config.headerOutDir,
      basePath: this.config.basePath,
      defines: this.config.defines,
      preprocess: this.config.preprocess,
      cppRequired: this.config.cppRequired,
      noCache: this.config.noCache,
      parseOnly: this.config.parseOnly,
      target: this.config.target,
    });
  }

  /**
   * Compile the project
   */
  async compile(): Promise<IProjectResult> {
    // Compile each input file individually to avoid cross‑file symbol leakage.
    const results: any[] = [];
    // Build the full list of .cnx/.cnext files from srcDirs and explicit files
    const allFiles =
      InputExpansion.expandInputs([
        ...this.config.srcDirs,
        ...(this.config.files ?? []),
      ]) || [];
    for (const file of allFiles) {
      // Create a fresh pipeline instance per file with the same configuration.
      const perFilePipeline = new Pipeline({
        inputs: [file],
        includeDirs: this.config.includeDirs,
        outDir: this.config.outDir,
        headerOutDir: this.config.headerOutDir,
        basePath: this.config.basePath,
        defines: this.config.defines,
        preprocess: this.config.preprocess,
        cppRequired: this.config.cppRequired,
        noCache: this.config.noCache,
        parseOnly: this.config.parseOnly,
        target: this.config.target,
      });

      const source = readFileSync(file, "utf-8");
      const fileResult = await perFilePipeline.transpileSource(source, {
        workingDir: dirname(file),
        sourcePath: file,
      });
      // Write generated code to disk if transpilation succeeded
      let outputPath: string | undefined;
      if (fileResult.success && (fileResult as any).code) {
        const outExt = perFilePipeline["config"]?.cppRequired ? ".cpp" : ".c";
        const baseOutDir = perFilePipeline["config"]?.outDir || dirname(file);
        const baseName = basename(file).replace(/\.(cnx|cnext)$/i, outExt);

        // Preserve subdirectory structure from srcDirs
        const relativeSubpath = this.getRelativeSubpath(file);
        const outputDir =
          relativeSubpath !== null && relativeSubpath !== ""
            ? join(baseOutDir, relativeSubpath)
            : baseOutDir;

        // Create output directory if it doesn't exist
        if (!existsSync(outputDir)) {
          mkdirSync(outputDir, { recursive: true });
        }

        outputPath = join(outputDir, baseName);
        writeFileSync(outputPath, (fileResult as any).code, "utf-8");

        // Write header file if headerCode was generated
        if ((fileResult as any).headerCode) {
          const baseHeaderOutDir =
            perFilePipeline["config"]?.headerOutDir || baseOutDir;
          const headerBaseName = basename(file).replace(
            /\.(cnx|cnext)$/i,
            ".h",
          );

          // Preserve subdirectory structure for headers too
          const headerOutputDir =
            relativeSubpath !== null && relativeSubpath !== ""
              ? join(baseHeaderOutDir, relativeSubpath)
              : baseHeaderOutDir;

          // Create header output directory if it doesn't exist
          if (!existsSync(headerOutputDir)) {
            mkdirSync(headerOutputDir, { recursive: true });
          }

          const headerPath = join(headerOutputDir, headerBaseName);
          writeFileSync(headerPath, (fileResult as any).headerCode, "utf-8");
        }
      }
      // Attach the output path to the result for aggregation
      (fileResult as any).outputPath = outputPath;
      // Attach sourcePath to the result for error formatting
      (fileResult as any).sourcePath = file;
      results.push(fileResult);
    }

    // Aggregate the per‑file results into a single project result.
    const aggregate = {
      success: true,
      filesProcessed: results.length,
      symbolsCollected: 0, // not tracked per‑file in this path
      conflicts: [] as string[],
      errors: [] as string[],
      warnings: [] as string[],
      outputFiles: [] as string[],
    };

    for (const r of results) {
      aggregate.success &&= r.success;
      if (r.errors?.length) {
        const formatted = r.errors.map((e: any) => {
          if (typeof e === "string") return e;
          if (r.sourcePath)
            return `${r.sourcePath}:${e.line}:${e.column} ${e.message}`;
          return `${e.line}:${e.column} ${e.message}`;
        });
        aggregate.errors.push(...formatted);
      }
      // outputPath is the primary generated file for a single source
      if (r.outputPath) {
        aggregate.outputFiles.push(r.outputPath);
      }
    }

    return aggregate;
  }
  /**
   * Get the symbol table (for testing/inspection)
   */
  getSymbolTable(): SymbolTable {
    return this.pipeline.getSymbolTable();
  }

  /**
   * Get the relative subpath from the source directory to the file.
   * Returns "" if file is directly in srcDir, "subdir" if nested, or null if not in any srcDir.
   */
  private getRelativeSubpath(file: string): string | null {
    const fileDir = dirname(file);
    for (const srcDir of this.config.srcDirs) {
      const relativePath = relative(srcDir, fileDir);
      // If relativePath doesn't start with "..", the file is within this srcDir
      if (!relativePath.startsWith("..") && !relativePath.startsWith("/")) {
        return relativePath; // "" if directly in srcDir, "subdir" if nested
      }
    }
    return null;
  }
}

export default Project;
