/**
 * ADR-049: the target catalog is a C-Next program. Any conforming compiler
 * reads it as one, so it must transpile, and its C must compile.
 */
import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import TargetCatalogFile from "../data/TargetCatalogFile";
import Transpiler from "../Transpiler";

const SHIPPED = readFileSync(TargetCatalogFile.locate(), "utf8");

describe("the shipped target catalog", () => {
  it("is a C-Next program whose C a compiler accepts", async () => {
    const dir = mkdtempSync(join(tmpdir(), "cnext-catalog-"));
    try {
      const sourcePath = join(dir, "targets.cnx");
      writeFileSync(sourcePath, SHIPPED);
      const result = await new Transpiler({
        input: sourcePath,
        outDir: dir,
        headerOutDir: dir,
        noCache: true,
        target: "host",
      }).transpile({ kind: "source", source: SHIPPED, sourcePath });

      expect(result.errors).toEqual([]);
      const file = result.files[0];
      writeFileSync(join(dir, "targets.c"), file.code);
      writeFileSync(join(dir, "targets.h"), file.headerCode ?? "");
      expect(() =>
        execFileSync("gcc", [
          "-std=c99",
          "-fsyntax-only",
          "-I",
          dir,
          join(dir, "targets.c"),
        ]),
      ).not.toThrow();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
