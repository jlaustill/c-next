#!/usr/bin/env tsx
/**
 * Regression: include-order-dependent C headers must resolve their symbols.
 *
 * Some framework headers refuse to be preprocessed standalone — the canonical
 * case is FreeRTOS `task.h`, which opens with
 *   #ifndef INC_FREERTOS_H
 *   #error "include FreeRTOS.h ... before ... task.h"
 *   #endif
 * and whose prototypes (e.g. `vTaskDelay`) are only well-formed once FreeRTOS.h
 * has run first (it defines the guard and the attribute/typedef macros the
 * prototypes use). cnext collects header symbols by preprocessing each header
 * on its own, so task.h's #error fired, preprocessing fell back to raw text,
 * and `vTaskDelay` was never collected -> E0422 "not declared in any included
 * header", even though the .cnx included FreeRTOS.h before task.h.
 *
 * This fixture reproduces the pattern in miniature: guard.h must precede
 * dependent.h, and dependent.h's declaration is emitted by a guard.h-defined
 * macro so it exists ONLY when preprocessed with guard.h in context.
 *
 * Run: npx tsx tests/regression/include-order-header-context/test-include-order.ts
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../../../src/transpiler/Transpiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  console.log("Regression: include-order header context...\n");

  const transpiler = new Transpiler({
    input: join(__dirname, "main.cnx"),
    includeDirs: [__dirname],
    outDir: join(__dirname, "output"),
    noCache: true,
  });

  const result = await transpiler.transpile({ kind: "files" });

  const unresolved = result.errors.find((e) =>
    e.message.includes("dependent_fn"),
  );
  if (unresolved) {
    console.log(
      `  FAIL: dependent_fn unresolved: ${unresolved.line}:${unresolved.column} ${unresolved.message}`,
    );
    process.exit(1);
  }

  if (!result.success) {
    console.log("  FAIL: transpilation failed:\n");
    for (const e of result.errors) {
      console.log(`    ${e.line}:${e.column} ${e.message}`);
    }
    process.exit(1);
  }

  console.log("  PASS: dependent_fn resolved via predecessor-header context");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
