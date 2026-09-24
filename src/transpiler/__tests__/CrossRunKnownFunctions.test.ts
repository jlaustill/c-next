/**
 * #1430: E0427 lost to the PREVIOUS RUN's `knownFunctions`.
 *
 * `UndeclaredValueAnalyzer` used to consult `CodeGenState.knownFunctions`,
 * which only `CodeGenerator.generate()` writes. Because the set is OR'd toward
 * "visible", a stale entry SUPPRESSES the diagnostic: a name the current file
 * cannot see reads as declared, and a program referencing an undefined
 * function transpiles at exit 0.
 *
 * ## Why this is not the fixture
 *
 * `tests/bugs/issue-1430-e0427-order-dependence/` asserts the diagnostic end
 * to end and has two controls, but it **cannot fail if the fix is reverted** --
 * measured. #1320 hoisted 2.1 Analyze whole-program, so during analysis in a
 * fresh process `knownFunctions` is empty and the stale read has nothing stale
 * to return. Every fixture runs one program in one process, so the harness
 * cannot construct the state the defect needs.
 *
 * What survives is cross-RUN: nothing clears the set between runs, and
 * `ServeCommand` holds a `private static transpiler` that serves many. This
 * drives two runs through one `Transpiler`, which is the only way to build it.
 *
 * The second case is the negative control. The same program alone must still
 * be rejected, or an analyzer that stopped checking undefined values -- or was
 * deleted outright -- would pass the first assertion by failing it for the
 * wrong reason.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";

/** Declares `sharedHelper`, so generating it records the name. */
const DECLARES_SHARED_HELPER = `u32 sharedHelper() {
    return 7;
}

u32 main() {
    return sharedHelper();
}
`;

/** References it as a value without declaring or including it -- E0427. */
const BORROWS_SHARED_HELPER = `u32 borrowedLimit <- sharedHelper;

u32 main() {
    return borrowedLimit;
}
`;

describe("knownFunctions does not survive a run (#1430)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-1430-"));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const newTranspiler = (): Transpiler =>
    new Transpiler({
      input: "",
      includeDirs: [dir],
      outDir: "",
      headerOutDir: "",
    });

  const borrowRun = async (
    transpiler: Transpiler,
  ): Promise<readonly string[]> => {
    const result = await transpiler.transpile({
      kind: "source",
      source: BORROWS_SHARED_HELPER,
      sourcePath: join(dir, "borrow.cnx"),
      workingDir: dir,
    });
    return (result.errors ?? []).map((error) => error.message);
  };

  it("rejects an undefined value after an unrelated run declared that name", async () => {
    const transpiler = newTranspiler();

    await transpiler.transpile({
      kind: "source",
      source: DECLARES_SHARED_HELPER,
      sourcePath: join(dir, "declares.cnx"),
      workingDir: dir,
    });

    expect(await borrowRun(transpiler)).toEqual([
      expect.stringContaining("E0427"),
    ]);
  });

  it("rejects it on its own, so the case above is about the leak", async () => {
    expect(await borrowRun(newTranspiler())).toEqual([
      expect.stringContaining("E0427"),
    ]);
  });
});
