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
    const includePaths: string[] = [];
    const seen = new Set<string>();
    const defines: Record<string, string | boolean> = {};
    let compiler: string | null = null;

    const entries = JSON.parse(jsonContent) as ICompileCommandsEntry[];
    for (const entry of entries) {
      const args =
        entry.arguments ??
        (entry.command ? CompileCommandsReader.tokenize(entry.command) : []);
      const dir = entry.directory ?? "";
      if (compiler === null && args.length > 0) {
        compiler = args[0]; // argv[0] is the compiler binary
      }
      for (let i = 0; i < args.length; i++) {
        const includeFlag = CompileCommandsReader.matchIncludeFlag(args[i]);
        if (includeFlag) {
          let raw = args[i].slice(includeFlag.length);
          if (raw === "") {
            // Space-separated form: the operand is the next token.
            raw = args[i + 1] ?? "";
            i++;
          }
          if (raw === "") continue;
          const path = isAbsolute(raw) ? raw : resolve(dir, raw);
          if (!seen.has(path)) {
            seen.add(path);
            includePaths.push(path);
          }
          continue;
        }

        if (args[i].startsWith("-D")) {
          let raw = args[i].slice(2);
          if (raw === "") {
            raw = args[i + 1] ?? "";
            i++;
          }
          if (raw === "") continue;
          const eq = raw.indexOf("=");
          if (eq === -1) {
            defines[raw] = true;
          } else {
            defines[raw.slice(0, eq)] = raw.slice(eq + 1);
          }
        }
      }
    }

    return { includePaths, defines, compiler };
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
