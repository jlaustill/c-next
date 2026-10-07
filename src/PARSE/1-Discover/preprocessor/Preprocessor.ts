/**
 * C/C++ Preprocessor
 * Runs the system preprocessor on C/C++ files before parsing
 */

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { basename, dirname, join, resolve } from "node:path";
import IToolchain from "./types/IToolchain";
import IPreprocessResult from "./types/IPreprocessResult";
import ISourceMapping from "./types/ISourceMapping";
import IPreprocessOptions from "./types/IPreprocessOptions";
import ToolchainDetector from "./ToolchainDetector";
import ExecFailure from "../../../utils/ExecFailure";
import type IPreprocessCacheEntry from "./types/IPreprocessCacheEntry";
import IFileSystem from "../../../types/IFileSystem";
import LineMarkers from "./LineMarkers";
import PreprocessCache from "./PreprocessCache";

const execFileAsync = promisify(execFile);

/** What one run of the compiler printed, and why it failed, if it did */
type IPreprocessOutcome = Omit<IPreprocessCacheEntry, "deps">;

/** The name a string's input is keyed by, in place of its temporary file */
const STRING_INPUT = join("<cnext-string>", "input");

/** The `-MT` target the dependency file is written for */
const DEPS_TARGET = "cnext";

const DEPS_FILE = "cnext.d";

/**
 * Handles preprocessing of C/C++ files
 */
class Preprocessor {
  private readonly toolchain: IToolchain | null;

  private readonly defaultIncludePaths: string[] = [];

  private readonly fs: IFileSystem;

  constructor(fs: IFileSystem, toolchain?: IToolchain) {
    this.fs = fs;
    this.toolchain = toolchain ?? ToolchainDetector.detect(fs);

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
   * Preprocess a C/C++ file
   */
  async preprocess(
    filePath: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    return this.run(filePath, options, null);
  }

  /**
   * Preprocess content from a string, through a temporary file the port owns.
   *
   * Not stdin (#1653, measured on gcc and clang): on stdin a quoted `#include`
   * is searched for first in the process's working directory, so a header
   * there would shadow the one the search paths name. A temporary file in an
   * otherwise empty directory keeps the resolution this always had.
   */
  async preprocessString(
    content: string,
    filename: string,
    options: IPreprocessOptions = {},
  ): Promise<IPreprocessResult> {
    const result = await this.fs.withTempFile(
      basename(filename),
      content,
      (tempFile) => this.run(tempFile, options, { filename, content }),
    );
    result.originalFile = filename;
    return result;
  }

  /**
   * One preprocessor run, from `options.cache` when no file it read has
   * changed (#1844). `text` is the string a temporary `filePath` holds: the
   * key names it, not the temporary path, which differs on every run.
   */
  private async run(
    filePath: string,
    options: IPreprocessOptions,
    text: { readonly filename: string; readonly content: string } | null,
  ): Promise<IPreprocessResult> {
    const toolchain = options.toolchain ?? this.toolchain;
    if (!toolchain) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error:
          "No C/C++ toolchain available. Install gcc, clang, or arm-none-eabi-gcc.",
        originalFile: filePath,
      };
    }
    const cache = options.cache;
    let outcome: IPreprocessOutcome;
    if (cache) {
      const key = PreprocessCache.keyOf([
        toolchain.name,
        toolchain.cpp,
        toolchain.version ?? null,
        toolchain.target ?? null,
        text === null
          ? [...this.argsFor(filePath, options), filePath]
          : [...this.argsFor(STRING_INPUT, options), text.filename],
        text?.content ?? null,
      ]);
      outcome =
        cache.lookup(key) ??
        (await this.runRecorded(
          toolchain,
          filePath,
          options,
          key,
          cache,
          text !== null,
        ));
    } else {
      outcome = await this.exec(
        toolchain,
        [...this.argsFor(filePath, options), filePath],
        filePath,
      );
    }
    return this.resultOf(outcome, filePath, options, toolchain);
  }

  /**
   * Run with the compiler's dependency output (`-MD`), and record the outcome
   * under `key` with every file it read. A run whose dependencies the
   * compiler did not write (a missing `#include` stops it before it writes
   * them) is not recorded: what it would have read is not known.
   */
  private async runRecorded(
    toolchain: IToolchain,
    filePath: string,
    options: IPreprocessOptions,
    key: string,
    cache: PreprocessCache,
    isString: boolean,
  ): Promise<IPreprocessOutcome> {
    return this.fs.withTempFile(DEPS_FILE, "", async (depsPath) => {
      const outcome = await this.exec(
        toolchain,
        [
          ...this.argsFor(filePath, options),
          "-MD",
          "-MF",
          depsPath,
          "-MT",
          DEPS_TARGET,
          filePath,
        ],
        filePath,
      );
      // A string's temporary file is keyed by its text, not by its path
      const input = isString ? resolve(filePath) : null;
      const read = Preprocessor.depsOf(this.fs.readFile(depsPath)).filter(
        (path) => path !== input,
      );
      if (read.length > 0) {
        try {
          cache.record(key, {
            ...outcome,
            deps: read.map((path): [string, number] => [
              path,
              this.fs.stat(path).mtimeMs,
            ]),
          });
        } catch {
          // A file it read is already gone: nothing to key the entry on
        }
      }
      return outcome;
    });
  }

  /**
   * The files a `-MD -MT ${DEPS_TARGET}` dependency file names: the target,
   * then each file, with backslash-newline continuations and `\ ` for a
   * space in a path.
   */
  private static depsOf(text: string): string[] {
    const body = text.replaceAll(/\\\r?\n/g, " ").trim();
    if (!body.startsWith(`${DEPS_TARGET}:`)) return [];
    return body
      .slice(DEPS_TARGET.length + 1)
      .trim()
      .split(/(?<!\\)\s+/)
      .filter((path) => path !== "")
      .map((path) =>
        resolve(path.replaceAll(String.raw`\ `, " ").replaceAll("$$", "$")),
      );
  }

  private resultOf(
    outcome: IPreprocessOutcome,
    filePath: string,
    options: IPreprocessOptions,
    toolchain: IToolchain,
  ): IPreprocessResult {
    if (outcome.error !== null) {
      return {
        content: "",
        sourceMappings: [],
        success: false,
        error: outcome.error,
        diagnostics: outcome.stderr,
        originalFile: filePath,
        toolchain: toolchain.name,
      };
    }
    // Log warnings to console but don't fail
    if (outcome.stderr.trim()) {
      console.warn(`Preprocessor warnings for ${filePath}:\n${outcome.stderr}`);
    }
    const content = outcome.stdout;
    return {
      // Optionally strip #line directives for cleaner output
      content:
        options.keepLineDirectives === false
          ? LineMarkers.strip(content)
          : content,
      sourceMappings:
        options.keepLineDirectives === false
          ? []
          : this.parseLineDirectives(content),
      success: true,
      originalFile: filePath,
      toolchain: toolchain.name,
    };
  }

  /**
   * The preprocessor's arguments for `filePath`, up to the file itself
   */
  private argsFor(filePath: string, options: IPreprocessOptions): string[] {
    const args: string[] = [
      "-E", // Preprocess only
      "-P", // Don't generate linemarkers (we'll add them back if needed)
    ];

    // If we want line directives, don't use -P
    if (options.keepLineDirectives !== false) {
      args.pop(); // Remove -P
    }

    // Dump macro definitions (#define list) instead of preprocessed source,
    // to discover function-like macros the normal preprocess would consume.
    if (options.dumpMacros) {
      args.push("-dM");
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

    // Import predecessor macros (gcc/clang -imacros) so include-order-dependent
    // headers get the guards/attribute macros their includer would have defined
    // first. -imacros keeps only the macros, not the predecessors' declarations,
    // so the output stays scoped to the target file.
    if (options.imacros) {
      for (const macroHeader of options.imacros) {
        args.push("-imacros", macroHeader);
      }
    }
    return args;
  }

  /**
   * Invoke the preprocessor via argv (execFile, NOT a shell). A shell would
   * re-parse -D values that legitimately contain spaces / parentheses (e.g.
   * -DARDUINO_BOARD="Espressif ... (8 MB QD, No PSRAM)"), breaking on the
   * metacharacters. Passing args directly mirrors how the real compiler is
   * invoked and is safe for any value the compiler accepts.
   */
  private async exec(
    toolchain: IToolchain,
    args: readonly string[],
    filePath: string,
  ): Promise<IPreprocessOutcome> {
    try {
      const { stdout, stderr } = await execFileAsync(toolchain.cpp, args, {
        maxBuffer: 50 * 1024 * 1024, // 50MB buffer for large headers
      });
      return { stdout, stderr: stderr ?? "", error: null };
    } catch (error: unknown) {
      // Include stderr in error message for better debugging
      const failure = ExecFailure.of(error);
      return {
        stdout: "",
        stderr: failure.stderr ?? "",
        error: `Preprocessor failed for ${filePath}:\n${failure.message}\n${failure.stderr ?? ""}`,
      };
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
      const match = /^#\s*(?:line\s+)?(\d+)\s+"([^"]+)"(?:\s+\d+)*\s*$/.exec(
        line,
      );

      if (match) {
        currentOriginalLine = Number.parseInt(match[1], 10);
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
}

export default Preprocessor;
