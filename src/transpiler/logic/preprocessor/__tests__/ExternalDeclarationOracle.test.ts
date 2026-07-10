/**
 * Unit tests for ExternalDeclarationOracle.
 *
 * cnext collects header symbols by preprocessing each header standalone, which
 * fails for include-order-dependent framework headers (e.g. FreeRTOS task.h's
 * `#ifndef INC_FREERTOS_H / #error`). The oracle recovers by preprocessing a
 * header set AS A TRANSLATION UNIT (in order, keeping `#line` directives), then
 * splitting the output back into per-file slices (for the caller to parse into
 * full symbols) plus the names of function-like macros (no declaration to parse).
 */
import { describe, it, expect } from "vitest";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import ExternalDeclarationOracle from "../ExternalDeclarationOracle";
import Preprocessor from "../Preprocessor";

const currentDir = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(currentDir, "fixtures", "oracle");

function allContent(perFile: Map<string, string>): string {
  return [...perFile.values()].join("\n");
}

describe("ExternalDeclarationOracle", () => {
  it("recovers a declaration only valid after its predecessor header", async () => {
    const preprocessor = new Preprocessor();
    if (!preprocessor.isAvailable()) return; // no toolchain in this env

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"', '"dependent.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    // dependent.h's #error passes only because predecessor.h ran first in the
    // TU; oracle_fn is emitted (by a predecessor-defined macro) into its slice.
    expect(recovery).not.toBeNull();
    expect(allContent(recovery!.perFileContent)).toContain("oracle_fn");
  });

  it("buckets each header's declarations under its own path", async () => {
    const preprocessor = new Preprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"', '"dependent.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    const dependentKey = [...recovery!.perFileContent.keys()].find((k) =>
      k.endsWith("dependent.h"),
    );
    expect(dependentKey).toBeDefined();
    expect(recovery!.perFileContent.get(dependentKey!)).toContain("oracle_fn");
  });

  it("collects function-like macro names consumed by a normal preprocess", async () => {
    const preprocessor = new Preprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(recovery!.macroNames.has("ORACLE_TICKS")).toBe(true);
  });

  it("does not surface names that are not declared anywhere", async () => {
    const preprocessor = new Preprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      ['"predecessor.h"'],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(allContent(recovery!.perFileContent)).not.toContain(
      "totally_undeclared_symbol",
    );
    expect(recovery!.macroNames.has("totally_undeclared_symbol")).toBe(false);
  });

  it("drops a header that cannot preprocess and keeps the rest", async () => {
    const preprocessor = new Preprocessor();
    if (!preprocessor.isAvailable()) return;

    const recovery = await ExternalDeclarationOracle.recover(
      // the middle include does not exist; it must be dropped, not fatal
      [
        '"predecessor.h"',
        "<this_header_does_not_exist_xyzzy.h>",
        '"dependent.h"',
      ],
      preprocessor,
      { includePaths: [FIXTURES] },
    );

    expect(allContent(recovery!.perFileContent)).toContain("oracle_fn");
    expect(recovery!.macroNames.has("ORACLE_TICKS")).toBe(true);
  });

  it("returns null for no includes", async () => {
    const preprocessor = new Preprocessor();
    const recovery = await ExternalDeclarationOracle.recover(
      [],
      preprocessor,
      {},
    );
    expect(recovery).toBeNull();
  });
});
