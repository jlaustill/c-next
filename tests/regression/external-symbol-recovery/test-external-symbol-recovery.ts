#!/usr/bin/env tsx
/**
 * Regression: external-symbol recovery must yield FULL signatures, not names.
 *
 * Issue #985 made an undeclared framework call a hard error (E0422). The first
 * fix recovered only the NAMES of such functions — enough to silence E0422, but
 * codegen was left blind: a struct passed to a pointer parameter came out BY
 * VALUE (`twai_driver_install(g_config)` instead of `&g_config`) and an opaque
 * handle came out by value (`lv_obj_t` instead of `lv_obj_t *`). Neither
 * compiles. The real defeat is cnext parsing framework headers:
 *   - RAW, a trailing attribute macro (FreeRTOS `PRIVILEGED_FUNCTION`) breaks the
 *     declaration so the function is never collected.
 *   - FULLY preprocessed, the header's transitive tree inlines into a huge blob
 *     that ANTLR error-recovery mangles.
 * Recovery now preprocesses the include set as a TU (predecessors first, keeping
 * #line directives), splits it back per source file, and parses each small,
 * macro-expanded slice — recovering FULL types.
 *
 * This fixture mirrors that in miniature: widget.h refuses standalone inclusion,
 * its API is emitted by a guard.h macro and decorated with a trailing attribute
 * macro, and it declares both a pointer-parameter function and an opaque handle.
 *
 * Run: npx tsx tests/regression/external-symbol-recovery/test-external-symbol-recovery.ts
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { readFileSync } from "node:fs";
import Transpiler from "../../../src/transpiler/Transpiler";

const __dirname = dirname(fileURLToPath(import.meta.url));

function fail(message: string): never {
  console.log(`  FAIL: ${message}`);
  process.exit(1);
}

async function main(): Promise<void> {
  console.log("Regression: external-symbol recovery (full signatures)...\n");

  const outDir = join(__dirname, "output");
  const transpiler = new Transpiler({
    input: join(__dirname, "main.cnx"),
    includeDirs: [__dirname],
    outDir,
    cppRequired: true,
    noCache: true,
  });

  const result = await transpiler.transpile({ kind: "files" });

  if (!transpiler["preprocessor"].isAvailable()) {
    console.log("  SKIP: no C preprocessor toolchain in this environment");
    process.exit(0);
  }

  const unresolved = result.errors.find(
    (e) =>
      e.message.includes("widget_install") ||
      e.message.includes("widget_create"),
  );
  if (unresolved) {
    fail(`widget API unresolved (E0422): ${unresolved.message}`);
  }
  if (!result.success) {
    fail(
      "transpilation failed:\n" +
        result.errors.map((e) => `    ${e.message}`).join("\n"),
    );
  }

  const generated = result.outputFiles.find((f) => f.endsWith("main.cpp"));
  if (!generated) fail("no main.cpp generated");
  const code = readFileSync(generated!, "utf8");

  // Pointer parameter: the struct arg must be passed by address.
  if (!/widget_install\(\s*&/.test(code)) {
    fail(
      `expected widget_install(&cfg) — struct passed by address. Got:\n` +
        (code.match(/widget_install\([^)]*\)/)?.[0] ?? "<no call>"),
    );
  }

  // Opaque handle: the field must be a pointer, not a by-value incomplete type.
  if (!/widget_t\s*\*\s*\w*handle/.test(code)) {
    fail(
      `expected an 'widget_t *' handle field (opaque type -> pointer). Got:\n` +
        (code.match(/widget_t\s*\*?\s*\w*handle[^;]*;/)?.[0] ?? "<no field>"),
    );
  }

  console.log(
    "  PASS: widget_install(&cfg) and 'widget_t *' handle recovered with full types",
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
