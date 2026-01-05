/**
 * C/C++ Preprocessor
 * Runs the system preprocessor on C/C++ files before parsing
 */

import { exec } from "child_process";
import { promisify } from "util";
import { writeFile, mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join, basename, dirname } from "path";
import IToolchain from "./types/IToolchain.js";
import IPreprocessResult, {
  ISourceMapping,
} from "./types/IPreprocessResult.js";
import ToolchainDetector from "./ToolchainDetector.js";

const execAsync = promisify(exec);

/**
 * Preprocessor options
 */
interface IPreprocessOptions {
  /** Additional include paths */
  includePaths?: string[];

  /** Preprocessor defines (-D flags) */
  defines?: Record<string, string | boolean>;

  /** Specific toolchain to use (auto-detect if not specified) */
  toolchain?: IToolchain;

  /** Keep #line directives for source mapping (default: true) */
  keepLineDirectives?: boolean;
}

/**
 * Handles preprocessing of C/C++ files
 */
class Preprocessor {
  private toolchain: IToolchain | null;

  private defaultIncludePaths: string[] = [];

  constructor(toolchain?: IToolchain) {
    this.toolchain = toolchain ?? ToolchainDetector.detect();

    if (this.toolchain) {
      this.defaultIncludePaths = ToolchainDetector.getDefaultIncludePaths(
        this.toolchain,
      );
    }
  }

  /**
   * Check if a toolchain is available
   */
  isAvailable(): boolean {
    return this.toolchain !== null;
  }

  /**
   * Get the current toolchain
   */
  getToolchain(): IToolchain | null {
    return this.toolchain;
  }

  /**
   * Preprocess a C/C++ file
   */
  async preprocess(
    filePath: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    if (!this.toolchain) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error:
          "No C/C++ toolchain available. Install gcc, clang, or arm-none-eabi-gcc.",
        originalFile: filePath,
      };
    }

    try {
      const content = await this.runPreprocessor(filePath, options);
      const sourceMappings =
        options.keepLineDirectives !== false
          ? this.parseLineDirectives(content)
          : [];

      // Optionally strip #line directives for cleaner output
      const cleanContent =
        options.keepLineDirectives === false
          ? this.stripLineDirectives(content)
          : content;

      return {
        content: cleanContent,
        sourceMappings,
        success: true,
        originalFile: filePath,
        toolchain: this.toolchain.name,
      };
    } catch (error) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error: error instanceof Error ? error.message : String(error),
        originalFile: filePath,
        toolchain: this.toolchain.name,
      };
    }
  }

  /**
   * Preprocess content from a string (creates temp file)
   */
  async preprocessString(
    content: string,
    filename: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    let tempDir: string | null = null;

    try {
      // Create temp directory
      tempDir = await mkdtemp(join(tmpdir(), "cnext-"));
      const tempFile = join(tempDir, basename(filename));

      // Write content to temp file
      await writeFile(tempFile, content, "utf-8");

      // Preprocess
      const result = await this.preprocess(tempFile, options);

      // Update the original file reference
      result.originalFile = filename;

      return result;
    } finally {
      // Clean up temp directory
      if (tempDir) {
        try {
          await rm(tempDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }

  /**
   * Run the preprocessor command
   */
  private async runPreprocessor(
    filePath: string,
    options: IPreprocessOptions,
  ): Promise<string> {
    const toolchain = options.toolchain ?? this.toolchain!;
    const args: string[] = [
      "-E", // Preprocess only
      "-P", // Don't generate linemarkers (we'll add them back if needed)
    ];

    // If we want line directives, don't use -P
    if (options.keepLineDirectives !== false) {
      args.pop(); // Remove -P
    }

    // Add include paths
    const includePaths = [
      ...this.defaultIncludePaths,
      ...(options.includePaths ?? []),
      dirname(filePath), // Include the file's directory
    ];

    for (const path of includePaths) {
      args.push(`-I${path}`);
    }

    // Add defines
    if (options.defines) {
      for (const [key, value] of Object.entries(options.defines)) {
        if (value === true) {
          args.push(`-D${key}`);
        } else if (value !== false) {
          args.push(`-D${key}=${value}`);
        }
      }
    }

    // Add the input file
    args.push(filePath);

    // Build command
    const command = `${toolchain.cpp} ${args.join(" ")}`;

    try {
      const { stdout, stderr } = await execAsync(command, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large headers
      });

      // Log warnings to console but don't fail
      if (stderr && stderr.trim()) {
        console.warn(`Preprocessor warnings for ${filePath}:\n${stderr}`);
      }

      return stdout;
    } catch (error: any) {
      // Include stderr in error message for better debugging
      const stderr = error.stderr ?? "";
      throw new Error(
        `Preprocessor failed for ${filePath}:\n${error.message}\n${stderr}`,
      );
    }
  }

  /**
   * Parse #line directives to build source mappings
   * Format: # linenum "filename" [flags]
   */
  private parseLineDirectives(content: string): ISourceMapping[] {
    const mappings: ISourceMapping[] = [];
    const lines = content.split("\n");

    let currentFile = "";
    let currentOriginalLine = 1;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      // Match # linenum "filename" or #line linenum "filename"
      const match = line.match(
        /^#\s*(?:line\s+)?(\d+)\s+"([^"]+)"(?:\s+\d+)*\s*$/,
      );

      if (match) {
        currentOriginalLine = parseInt(match[1], 10);
        currentFile = match[2];
      } else if (currentFile) {
        mappings.push({
          preprocessedLine: i + 1,
          originalFile: currentFile,
          originalLine: currentOriginalLine,
        });
        currentOriginalLine++;
      }
    }

    return mappings;
  }

  /**
   * Strip #line directives from preprocessed output
   */
  private stripLineDirectives(content: string): string {
    return content
      .split("\n")
      .filter((line) => !line.match(/^#\s*(?:line\s+)?\d+\s+"/))
      .join("\n");
  }

  /**
   * Map a line in preprocessed output back to original source
   */
  static mapToOriginal(
    mappings: ISourceMapping[],
    preprocessedLine: number,
  ): { file: string; line: number } | null {
    // Find the mapping for this line or the closest previous one
    let bestMapping: ISourceMapping | null = null;

    for (const mapping of mappings) {
      if (mapping.preprocessedLine <= preprocessedLine) {
        if (
          !bestMapping ||
          mapping.preprocessedLine > bestMapping.preprocessedLine
        ) {
          bestMapping = mapping;
        }
      }
    }

    if (!bestMapping) {
      return null;
    }

    // Calculate the offset from the mapping
    const offset = preprocessedLine - bestMapping.preprocessedLine;

    return {
      file: bestMapping.originalFile,
      line: bestMapping.originalLine + offset,
    };
  }
}

export default Preprocessor;
export type { IPreprocessOptions };
