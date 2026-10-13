import { readFileSync } from "node:fs";
import { join } from "node:path";

import FileScanner from "../utils/FileScanner";
import SourceModule from "../utils/SourceModule";
import ErrorCodeRegistry from "./ErrorCodeRegistry";

/**
 * The `E####` codes `src/` emits, for `error-codes.ts`. Test code
 * (`SourceModule.isModule`) is left out, except for a code whose registry row
 * names a `__tests__` file as its source (E0000): a code invented in a mock or
 * a `__testUtils__/` double must not register itself as real. Extracted from
 * `error-codes.ts` (#1827 review) so a test can reach it; that script runs
 * `main()` when imported.
 */
class EmittedCodes {
  private static readonly CODE = /\bE\d{4}\b/g;

  /** Codes a row explicitly attributes to a `__tests__` file, e.g. E0000. */
  static testOwned(markdown: string): Set<string> {
    return new Set(
      ErrorCodeRegistry.rows(markdown)
        .filter((row) => row.source.includes("__tests__"))
        .map((row) => row.code),
    );
  }

  /** `files` maps an absolute path to its text. */
  static collect(
    files: ReadonlyMap<string, string>,
    allowTestOwned: ReadonlySet<string>,
  ): Set<string> {
    const codes = new Set<string>();
    for (const [full, text] of files) {
      const isTest = !SourceModule.isModule(full);
      for (const match of text.matchAll(EmittedCodes.CODE)) {
        if (!isTest || allowTestOwned.has(match[0])) {
          codes.add(match[0]);
        }
      }
    }
    return codes;
  }

  static read(allowTestOwned: ReadonlySet<string>): Set<string> {
    const files = new Map<string, string>();
    for (const full of FileScanner.findFiles(
      join(SourceModule.rootDir, "src"),
      ".ts",
    )) {
      files.set(full, readFileSync(full, "utf-8"));
    }
    return EmittedCodes.collect(files, allowTestOwned);
  }
}

export default EmittedCodes;
