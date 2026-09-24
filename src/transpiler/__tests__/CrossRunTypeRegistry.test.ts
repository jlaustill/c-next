/**
 * #1432: a safety diagnostic lost to the PREVIOUS RUN's type registry.
 *
 * `CodeGenState.getVariableTypeInfo` probes the per-file `typeRegistry` before
 * falling back to the symbol table. `CodeGenerator.generate()` fills that map
 * and `CodeGenState.reset()` clears it -- both AFTER the analyzers run.
 *
 * #1320 hoisted 2.1 Analyze whole-program, which removed the symptom #1432 was
 * filed with: its reproduction swapped two `#include` lines in ONE run, and
 * both orders now give the right answer. That fixed the ordering, not the
 * read. The map is still never cleared between RUNS, and `ServeCommand` holds
 * a `private static transpiler` that serves many of them -- so what the
 * analyzer sees is whatever file the previous run generated last.
 *
 * The case below is the one that matters: the subscript variable is declared
 * in an INCLUDED file, so the analyzer's own per-file map misses and it falls
 * through to the stale answer. `idx` is `i32` at file scope, which E0850
 * exists to reject; a previous run's function-local `u8 idx` makes it look
 * unsigned, and a signed array subscript -- undefined behavior in C --
 * reaches generated code with the transpile reporting success.
 *
 * The negative control is the same second program run on its own. It must
 * still fail, or this test would pass just as well against an analyzer that
 * had stopped checking subscripts at all.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";

/** A run whose last generated file declares a function-local `u8 idx`. */
const SHADOWS_IDX_AS_U8 = `u32 shadowFn(u32 n) {
    u8 idx <- 0;
    return n + idx;
}
`;

/** `idx` is i32 here, and the entry subscripts an array with it. */
const DECLARES_IDX_AS_I32 = `i32 idx <- 1;
`;

const SUBSCRIPTS_INCLUDED_IDX = `#include "signed.cnx"

u32 main() {
    u8[4] arr;
    arr[0] <- 7;
    return arr[idx];
}
`;

describe("the type registry does not survive a run (#1432)", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-1432-"));
    writeFileSync(join(dir, "signed.cnx"), DECLARES_IDX_AS_I32);
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

  const subscriptRun = async (
    transpiler: Transpiler,
  ): Promise<readonly string[]> => {
    const result = await transpiler.transpile({
      kind: "source",
      source: SUBSCRIPTS_INCLUDED_IDX,
      sourcePath: join(dir, "entry.cnx"),
      workingDir: dir,
    });
    return (result.errors ?? []).map((error) => error.message);
  };

  it("rejects a signed subscript after an unrelated run in the same process", async () => {
    const transpiler = newTranspiler();

    await transpiler.transpile({
      kind: "source",
      source: SHADOWS_IDX_AS_U8,
      sourcePath: join(dir, "shadow.cnx"),
      workingDir: dir,
    });

    expect(await subscriptRun(transpiler)).toEqual([
      expect.stringContaining("E0850"),
    ]);
  });

  it("rejects it on its own, so the case above is about the leak", async () => {
    // Negative control. Without this, an analyzer that never checked
    // subscripts would pass the assertion above by failing it for the wrong
    // reason -- and one that was simply deleted would look like a fix.
    expect(await subscriptRun(newTranspiler())).toEqual([
      expect.stringContaining("E0850"),
    ]);
  });
});
