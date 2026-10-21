/**
 * #1735 review: a folded static-storage initializer credits ADR-044 exactly
 * where 2.2 planned a clamp, as an ordinary expression does -- an integer
 * `+ - *` -- and not a float fold, which no clamp decision covers.
 *
 * The matrix only counts the lines a rule fired on, so a fixture cannot show a
 * line it must NOT fire on. Reading the run's sites can.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import NodeFileSystem from "../../cnx/PARSE/1-Discover/NodeFileSystem";

const FOLDS = `f32 F <- 3.0;
f32 G <- F * 2.0;
u32 A <- 4;
u32 B <- A * 2;
u8 D <- 250;
u8 S <- 2;
u8 E <- D + S;

u32 main() {
    return 0;
}
`;

describe("ADR-044 provenance of a folded static initializer (#1735)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-1735-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const clampLines = async (cppRequired: boolean): Promise<number[]> => {
    const transpiler = new Transpiler(
      { input: "", outDir: "", target: "host", cppRequired },
      NodeFileSystem.instance,
    );
    const result = await transpiler.transpile({
      kind: "source",
      source: FOLDS,
      sourcePath: join(dir, "folds.cnx"),
      workingDir: dir,
    });
    expect(result.errors ?? []).toEqual([]);
    return [
      ...new Set(
        (result.adrSites ?? [])
          .filter((site) => site.adr === "044")
          .map((site) => site.line),
      ),
    ].sort((a, b) => a - b);
  };

  it("credits the integer folds and not the float fold, in C", async () => {
    expect(await clampLines(false)).toEqual([4, 7]);
  });

  it("credits the integer folds and not the float fold, in C++", async () => {
    expect(await clampLines(true)).toEqual([4, 7]);
  });
});
