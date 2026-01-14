"use strict";
/**
 * C/C++ Preprocessor
 * Runs the system preprocessor on C/C++ files before parsing
 */
var __importDefault =
  (this && this.__importDefault) ||
  function (mod) {
    return mod && mod.__esModule ? mod : { default: mod };
  };
Object.defineProperty(exports, "__esModule", { value: true });
const child_process_1 = require("child_process");
const util_1 = require("util");
const promises_1 = require("fs/promises");
const os_1 = require("os");
const path_1 = require("path");
const ToolchainDetector_1 = __importDefault(require("./ToolchainDetector"));
const execAsync = (0, util_1.promisify)(child_process_1.exec);
/**
 * Handles preprocessing of C/C++ files
 */
class Preprocessor {
  toolchain;
  defaultIncludePaths = [];
  constructor(toolchain) {
    this.toolchain = toolchain ?? ToolchainDetector_1.default.detect();
    if (this.toolchain) {
      this.defaultIncludePaths =
        ToolchainDetector_1.default.getDefaultIncludePaths(this.toolchain);
    }
  }
  /**
   * Check if a toolchain is available
   */
  isAvailable() {
    return this.toolchain !== null;
  }
  /**
   * Get the current toolchain
   */
  getToolchain() {
    return this.toolchain;
  }
  /**
   * Preprocess a C/C++ file
   */
  async preprocess(filePath, options = {}) {
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
  async preprocessString(content, filename, options = {}) {
    let tempDir = null;
    try {
      // Create temp directory
      tempDir = await (0, promises_1.mkdtemp)(
        (0, path_1.join)((0, os_1.tmpdir)(), "cnext-"),
      );
      const tempFile = (0, path_1.join)(
        tempDir,
        (0, path_1.basename)(filename),
      );
      // Write content to temp file
      await (0, promises_1.writeFile)(tempFile, content, "utf-8");
      // Preprocess
      const result = await this.preprocess(tempFile, options);
      // Update the original file reference
      result.originalFile = filename;
      return result;
    } finally {
      // Clean up temp directory
      if (tempDir) {
        try {
          await (0, promises_1.rm)(tempDir, { recursive: true });
        } catch {
          // Ignore cleanup errors
        }
      }
    }
  }
  /**
   * Run the preprocessor command
   */
  async runPreprocessor(filePath, options) {
    const toolchain = options.toolchain ?? this.toolchain;
    const args = [
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
      (0, path_1.dirname)(filePath), // Include the file's directory
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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (error) {
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
  parseLineDirectives(content) {
    const mappings = [];
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
  stripLineDirectives(content) {
    return content
      .split("\n")
      .filter((line) => !line.match(/^#\s*(?:line\s+)?\d+\s+"/))
      .join("\n");
  }
  /**
   * Map a line in preprocessed output back to original source
   */
  static mapToOriginal(mappings, preprocessedLine) {
    // Find the mapping for this line or the closest previous one
    let bestMapping = null;
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
exports.default = Preprocessor;
