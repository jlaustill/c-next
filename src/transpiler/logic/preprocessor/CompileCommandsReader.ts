/**
 * CompileCommandsReader — derive the compiler's own view (include search path,
 * preprocessor defines, compiler binary) from a `compile_commands.json`
 * compilation database.
 *
 * cnext is a source consumer that must resolve external C/C++ headers exactly as
 * the compiler will. Rather than couple to any one build system's path logic (or
 * hand-mirror it in cnext.config.json), it reads the build-system-agnostic
 * contract every build system converges on: the compiler command line, serialized
 * per translation unit in `compile_commands.json` (the LLVM compilation database
 * that clangd/clang-tidy also consume). Framework include paths are project-global
 * — identical across translation units — so the union of every entry's `-I` set is
 * the search path cnext needs; defines and the compiler binary come along for free.
 *
 * This is the pure parse layer: a database string in, `{ includePaths, defines,
 * compiler }` out. No filesystem access — the loader layer reads the file.
 */
import { readFileSync } from "node:fs";
import { resolve, isAbsolute } from "node:path";
import ICompileCommandsResult from "./types/ICompileCommandsResult";

/** One compile_commands.json entry (clang spec: `command` OR `arguments`). */
interface ICompileCommandsEntry {
  directory?: string;
  file?: string;
  command?: string;
  arguments?: string[];
}

/** Mutable state threaded through the POSIX word-splitter. */
interface ITokenizerState {
  tokens: string[];
  current: string;
  /** Whether a token is in progress (so empty quotes still emit ""). */
  started: boolean;
  mode: "normal" | "single" | "double";
}

/** Mutable state accumulated across every compile-DB entry while parsing. */
interface ICompileCommandsAccumulator {
  /** Include search paths in first-seen order, de-duplicated via `seen`. */
  includePaths: string[];
  /** Dedup guard for `includePaths`. */
  seen: Set<string>;
  /** Preprocessor defines (last write wins across entries). */
  defines: Record<string, string | boolean>;
  /** Compiler binary — the first entry-with-args argv[0] wins. */
  compiler: string | null;
}

class CompileCommandsReader {
  /**
   * Include-search flags whose operand is a directory. Each accepts an operand
   * attached to the flag or as the following token. `-I` is case-sensitive, so
   * it never swallows the lowercase `-isystem`/`-iquote`/`-idirafter` flags.
   */
  private static readonly INCLUDE_FLAGS = [
    "-I",
    "-isystem",
    "-iquote",
    "-idirafter",
  ];

  /**
   * Read and parse a `compile_commands.json` from disk. Returns null if the file
   * is missing or malformed, so callers can fall back to configured includes
   * rather than fail — a missing compile database is a normal, non-fatal state.
   */
  static load(path: string): ICompileCommandsResult | null {
    try {
      return CompileCommandsReader.parse(readFileSync(path, "utf8"));
    } catch {
      return null;
    }
  }

  /**
   * Parse a `compile_commands.json` string into the compiler's include search
   * path, defines, and compiler binary (combined across all entries).
   */
  static parse(jsonContent: string): ICompileCommandsResult {
    const accumulator: ICompileCommandsAccumulator = {
      includePaths: [],
      seen: new Set<string>(),
      defines: {},
      compiler: null,
    };

    const entries = JSON.parse(jsonContent) as ICompileCommandsEntry[];
    for (const entry of entries) {
      const args = CompileCommandsReader.entryArgs(entry);
      if (accumulator.compiler === null && args.length > 0) {
        accumulator.compiler = args[0]; // argv[0] is the compiler binary
      }
      CompileCommandsReader.processArgs(
        accumulator,
        args,
        entry.directory ?? "",
      );
    }

    return {
      includePaths: accumulator.includePaths,
      defines: accumulator.defines,
      compiler: accumulator.compiler,
    };
  }

  /**
   * Resolve one entry's argv: explicit `arguments` if present, else the
   * word-split `command` string, else none. `arguments` is used when truthy so a
   * present-but-empty `[]` is kept (an entry with no compile args) — matching the
   * clang spec's `command`-OR-`arguments` shape.
   */
  private static entryArgs(entry: ICompileCommandsEntry): string[] {
    if (entry.arguments) return entry.arguments;
    return entry.command ? CompileCommandsReader.tokenize(entry.command) : [];
  }

  /** Collect include paths and defines from one entry's argv. */
  private static processArgs(
    accumulator: ICompileCommandsAccumulator,
    args: string[],
    directory: string,
  ): void {
    for (let i = 0; i < args.length; i++) {
      i += CompileCommandsReader.processArg(accumulator, args, i, directory);
    }
  }

  /**
   * Classify one arg — an include flag or a `-D` define — and collect its
   * operand. Returns the number of ADDITIONAL tokens consumed (0, or 1 for a
   * space-separated operand) so the caller advances past it.
   */
  private static processArg(
    accumulator: ICompileCommandsAccumulator,
    args: string[],
    index: number,
    directory: string,
  ): number {
    const includeFlag = CompileCommandsReader.matchIncludeFlag(args[index]);
    if (includeFlag) {
      const operand = CompileCommandsReader.resolveOperand(
        args,
        index,
        includeFlag.length,
      );
      CompileCommandsReader.collectIncludePath(
        accumulator,
        directory,
        operand.value,
      );
      return operand.extraConsumed;
    }
    if (args[index].startsWith("-D")) {
      const operand = CompileCommandsReader.resolveOperand(args, index, 2);
      CompileCommandsReader.collectDefine(accumulator, operand.value);
      return operand.extraConsumed;
    }
    return 0;
  }

  /**
   * Resolve a flag's operand: the text attached directly to the flag, or — if
   * that is empty — the next token (the space-separated `-I foo` form), then
   * consumed. The next-token form is taken unconditionally when the attached text
   * is empty, even at the end of argv, so index advancement stays in step.
   */
  private static resolveOperand(
    args: string[],
    index: number,
    prefixLength: number,
  ): { value: string; extraConsumed: number } {
    const attached = args[index].slice(prefixLength);
    if (attached === "") {
      return { value: args[index + 1] ?? "", extraConsumed: 1 };
    }
    return { value: attached, extraConsumed: 0 };
  }

  /**
   * Collect an include directory (absolute kept verbatim; relative resolved
   * against the entry `directory`), de-duplicated in first-seen order. An empty
   * operand (a flag with no directory) is ignored.
   */
  private static collectIncludePath(
    accumulator: ICompileCommandsAccumulator,
    directory: string,
    raw: string,
  ): void {
    if (raw === "") return;
    const path = isAbsolute(raw) ? raw : resolve(directory, raw);
    if (!accumulator.seen.has(path)) {
      accumulator.seen.add(path);
      accumulator.includePaths.push(path);
    }
  }

  /**
   * Collect a `-D` define, split on the FIRST `=`: `KEY=VAL` -> `VAL` (a trailing
   * `KEY=` keeps the empty value), bare `KEY` -> `true`. An empty operand is
   * ignored.
   */
  private static collectDefine(
    accumulator: ICompileCommandsAccumulator,
    raw: string,
  ): void {
    if (raw === "") return;
    const eq = raw.indexOf("=");
    if (eq === -1) {
      accumulator.defines[raw] = true;
    } else {
      accumulator.defines[raw.slice(0, eq)] = raw.slice(eq + 1);
    }
  }

  /** Return the include flag `arg` begins with, or null if it is not one. */
  private static matchIncludeFlag(arg: string): string | null {
    return (
      CompileCommandsReader.INCLUDE_FLAGS.find((flag) =>
        arg.startsWith(flag),
      ) ?? null
    );
  }

  /**
   * Split a `command` string into argv, matching POSIX shell word-splitting (as
   * `shlex`/`/bin/sh` do) so tokens equal what the compiler was actually invoked
   * with. Real quotes are syntax (consumed); backslash-escaped quotes are literal
   * (kept); whitespace inside quotes is preserved. Only the cases that occur in
   * real compile databases are handled — no `$`/backtick expansion.
   */
  private static tokenize(command: string): string[] {
    const state: ITokenizerState = {
      tokens: [],
      current: "",
      started: false,
      mode: "normal",
    };
    for (let i = 0; i < command.length; i++) {
      i += CompileCommandsReader.tokenizeChar(state, command, i);
    }
    if (state.started) state.tokens.push(state.current);
    return state.tokens;
  }

  /**
   * Consume one character at `command[i]` in the current tokenizer mode.
   * Returns the number of ADDITIONAL characters consumed (0 or 1) so the caller
   * can advance past an escape's target.
   */
  private static tokenizeChar(
    state: ITokenizerState,
    command: string,
    i: number,
  ): number {
    const ch = command[i];
    if (state.mode === "single") {
      if (ch === "'") state.mode = "normal";
      else state.current += ch;
      return 0;
    }
    if (state.mode === "double") {
      return CompileCommandsReader.tokenizeDoubleQuoted(state, command, i);
    }
    return CompileCommandsReader.tokenizeNormal(state, command, i);
  }

  /** Handle one character outside quotes; returns extra chars consumed. */
  private static tokenizeNormal(
    state: ITokenizerState,
    command: string,
    i: number,
  ): number {
    const ch = command[i];
    if (ch === "\\") {
      const next = command[i + 1];
      if (next === undefined) return 0; // trailing backslash: nothing follows
      state.current += next; // outside quotes, backslash escapes any next char
      state.started = true;
      return 1;
    }
    if (ch === "'" || ch === '"') {
      state.mode = ch === "'" ? "single" : "double";
      state.started = true;
      return 0;
    }
    if (ch === " " || ch === "\t" || ch === "\n" || ch === "\r") {
      if (state.started) {
        state.tokens.push(state.current);
        state.current = "";
        state.started = false;
      }
      return 0;
    }
    state.current += ch;
    state.started = true;
    return 0;
  }

  /** Handle one character inside double quotes; returns extra chars consumed. */
  private static tokenizeDoubleQuoted(
    state: ITokenizerState,
    command: string,
    i: number,
  ): number {
    const ch = command[i];
    if (ch === '"') {
      state.mode = "normal";
      return 0;
    }
    if (ch === "\\") {
      const next = command[i + 1];
      // Match POSIX `shlex` (the reference this tokenizer is validated against):
      // inside double quotes only `\"` and `\\` are escapes. Before anything else
      // — `$`, a backtick, a newline — the backslash is a literal character.
      // shlex and bash disagree there; we pin to shlex for verifiable parity, and
      // real compile databases never quote those characters anyway.
      if (next === '"' || next === "\\") {
        state.current += next;
        return 1;
      }
      state.current += ch;
      return 0;
    }
    state.current += ch;
    return 0;
  }
}

export default CompileCommandsReader;
