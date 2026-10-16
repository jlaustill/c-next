/**
 * ADR-071's rewrite, driven by the transpiler's own analysis (#2103): every
 * binding is read-only unless declared `mut`, and `const` is no longer written.
 *
 *   npx tsx scripts/migrate-adr-071.ts [--include <dir>]... <file-or-dir>...
 *
 * `--include` adds a header search directory, as the CLI's does; the test
 * harness transpiles with `--include tests/include`.
 *
 * Each round transpiles every file and applies what the diagnostics say:
 * E0898 points at a written `const`, which is deleted; E0900, and E0879 for a
 * callback whose C type writes through a parameter, carry where the binding is
 * declared (`declaredAt`), and `mut` is inserted there.
 * Rounds repeat until neither fires: a binding made `mut` can expose a write
 * an earlier error stopped. A `// test-error` fixture asserts diagnostics on
 * purpose, so it is listed for review and left alone.
 *
 * It exits 1 when the rewrite did not finish: the rounds ran out before the
 * diagnostics stopped, or a file still has an error once they did -- one the
 * rewrite cannot fix, which may hide a write it would have.
 */

import {
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import Transpiler from "../src/cli/Transpiler";
import NodeFileSystem from "../src/cnx/PARSE/1-Discover/NodeFileSystem";
import type ITranspileError from "../src/cnx/types/ITranspileError";

/** One keyword change at a 1-based line and 0-based column */
type TEdit = {
  line: number;
  column: number;
  kind: "deleteConst" | "insertMut";
};

/** What a migration did, and what it could not finish */
type TMigration = {
  readonly rewritten: readonly string[];
  readonly review: readonly string[];
  /** Files with an edit still to make when the rounds ran out */
  readonly notConverged: readonly string[];
  /** Files that still fail, with their first error */
  readonly failing: ReadonlyArray<{ file: string; error: string }>;
};

const MAX_ROUNDS = 10;

/** The codes whose `declaredAt` is a binding that must be `mut` */
const NEEDS_MUT = /\b(?:E0900|E0879)\b/;

/** The words the grammar allows before `mut`; `mut` goes after them */
const BEFORE_MUT = /^(?:(?:public|private|atomic|volatile)\s+)*/;

class MigrateAdr071 {
  static async run(args: string[]): Promise<number> {
    const includeDirs: string[] = [];
    const paths: string[] = [];
    for (let i = 0; i < args.length; i++) {
      if (args[i] !== "--include") {
        paths.push(args[i]);
        continue;
      }
      const dir = args[++i];
      if (dir === undefined) {
        console.error("--include needs a directory");
        return 2;
      }
      includeDirs.push(resolve(dir));
    }
    if (paths.length === 0) {
      console.error(
        "usage: migrate-adr-071 [--include <dir>]... <file-or-dir>...",
      );
      return 2;
    }
    const result = await MigrateAdr071.migrate(paths, includeDirs);
    for (const file of result.rewritten) console.log(`rewritten ${file}`);
    for (const file of result.review)
      console.log(`review (test-error) ${file}`);
    for (const file of result.notConverged) {
      console.log(`not converged after ${MAX_ROUNDS} rounds: ${file}`);
    }
    for (const { file, error } of result.failing) {
      console.log(`still failing ${file}: ${error}`);
    }
    const total = result.rewritten.length;
    console.log(`${total} file(s) rewritten`);
    return result.notConverged.length > 0 || result.failing.length > 0 ? 1 : 0;
  }

  static async migrate(
    paths: readonly string[],
    includeDirs: readonly string[],
  ): Promise<TMigration> {
    const files = paths.flatMap((p) => MigrateAdr071.cnxFiles(resolve(p)));
    const migrated = files.filter((f) => !MigrateAdr071.assertsErrors(f));
    const changed = new Set<string>();
    const outDir = mkdtempSync(join(tmpdir(), "migrate-adr-071-"));
    let pending: string[] = [];
    const failing: Array<{ file: string; error: string }> = [];
    try {
      for (let round = 1; round <= MAX_ROUNDS; round++) {
        const edits = new Map<string, TEdit[]>();
        failing.length = 0;
        for (const file of migrated) {
          const found = await MigrateAdr071.errorsOf(file, includeDirs, outDir);
          for (const { error, file: inFile } of found) {
            MigrateAdr071.collect(error, inFile, edits);
          }
          if (found.length > 0) {
            failing.push({ file, error: found[0].error.message });
          }
        }
        const applied = MigrateAdr071.apply(edits);
        for (const file of applied) changed.add(file);
        console.log(`round ${round}: ${applied.length} file(s) rewritten`);
        pending = applied;
        if (applied.length === 0) break;
      }
    } finally {
      rmSync(outDir, { recursive: true, force: true });
    }
    return {
      rewritten: [...changed].sort(),
      review: files.filter((f) => !migrated.includes(f)),
      notConverged: pending,
      // A file the last round changed is reported as notConverged instead
      failing: pending.length > 0 ? [] : failing,
    };
  }

  private static cnxFiles(path: string): string[] {
    if (!statSync(path).isDirectory())
      return path.endsWith(".cnx") ? [path] : [];
    return readdirSync(path)
      .sort()
      .flatMap((entry) => MigrateAdr071.cnxFiles(join(path, entry)));
  }

  private static assertsErrors(file: string): boolean {
    return /^\/\/ test-error\b/m.test(readFileSync(file, "utf8"));
  }

  /**
   * Every diagnostic a CLI run of `file` reports, with the file each is in --
   * an included `.cnx` is analyzed too, and its errors name their own file.
   */
  private static async errorsOf(
    file: string,
    includeDirs: string[],
    outDir: string,
  ): Promise<Array<{ error: ITranspileError; file: string }>> {
    const transpiler = new Transpiler(
      {
        input: file,
        includeDirs: [dirname(file), ...includeDirs],
        outDir,
        headerOutDir: outDir,
        noCache: true,
        target: "host",
      },
      NodeFileSystem.instance,
    );
    const result = await transpiler.transpile({ kind: "files" });
    return [
      ...result.errors.map((error) => ({ error, file })),
      ...result.files.flatMap((fileResult) =>
        fileResult.errors.map((error) => ({
          error,
          file: fileResult.sourcePath,
        })),
      ),
    ];
  }

  private static collect(
    error: ITranspileError,
    file: string,
    edits: Map<string, TEdit[]>,
  ): void {
    if (error.message.includes("E0898")) {
      MigrateAdr071.add(edits, resolve(error.sourcePath ?? file), {
        line: error.line,
        column: error.column,
        kind: "deleteConst",
      });
    } else if (error.declaredAt && NEEDS_MUT.test(error.message)) {
      MigrateAdr071.add(edits, resolve(error.declaredAt.sourcePath), {
        line: error.declaredAt.line,
        column: error.declaredAt.column,
        kind: "insertMut",
      });
    }
  }

  private static add(
    edits: Map<string, TEdit[]>,
    file: string,
    edit: TEdit,
  ): void {
    const list = edits.get(file) ?? [];
    const same = list.some(
      (e) =>
        e.line === edit.line &&
        e.column === edit.column &&
        e.kind === edit.kind,
    );
    if (!same) list.push(edit);
    edits.set(file, list);
  }

  /** Applies each file's edits from the last to the first; returns the files changed */
  private static apply(edits: Map<string, TEdit[]>): string[] {
    const changed: string[] = [];
    for (const [file, list] of edits) {
      const lines = readFileSync(file, "utf8").split("\n");
      const before = lines.join("\n");
      list.sort((a, b) => b.line - a.line || b.column - a.column);
      for (const edit of list) {
        const text = lines[edit.line - 1];
        const head = text.slice(0, edit.column);
        const tail = text.slice(edit.column);
        if (edit.kind === "deleteConst") {
          lines[edit.line - 1] = head + tail.replace(/^const\s+/, "");
        } else {
          const skip = BEFORE_MUT.exec(tail)?.[0].length ?? 0;
          const rest = tail.slice(skip);
          if (!/^mut\s/.test(rest)) {
            lines[edit.line - 1] = `${head}${tail.slice(0, skip)}mut ${rest}`;
          }
        }
      }
      const after = lines.join("\n");
      if (after !== before) {
        writeFileSync(file, after);
        changed.push(file);
      }
    }
    return changed;
  }
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  MigrateAdr071.run(process.argv.slice(2)).then((code) => process.exit(code));
}

export default MigrateAdr071;
