#!/usr/bin/env tsx
/**
 * Regression: assembler headers must not produce false C-symbol conflicts.
 *
 * xtensa `coreasm.h` (a GNU-assembler `.h`, pulled in transitively by FreeRTOS
 * port headers) `#define`s `_ASMLANGUAGE` and defines a `.macro` whose body uses
 * the `loop` instruction mnemonic. The C symbol collector used to mis-collect
 * `loop` as a C symbol, which then false-conflicted with a C-Next `loop()`
 * (e.g. an Arduino sketch) — aborting the build with
 * "Symbol conflict: 'loop' is defined in multiple languages".
 *
 * Run with: npx tsx tests/regression/asm-header-symbol-conflict/test-asm-conflict.ts
 */
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import Transpiler from "../../../src/transpiler/Transpiler";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function main(): Promise<void> {
  console.log("Regression: assembler-header symbol conflict...\n");

  // preprocess: false forces RAW-header parsing — the same condition under which
  // the real bug fires (coreasm.h's own deep includes fail to preprocess, so the
  // transpiler falls back to parsing its raw assembler text as C).
  const transpiler = new Transpiler({
    input: join(__dirname, "main.cnx"),
    includeDirs: [__dirname],
    outDir: join(__dirname, "output"),
    preprocess: false,
    noCache: true,
  });

  const result = await transpiler.transpile({ kind: "files" });

  // #1334: conflicts are ordinary coded errors (E0425), not a separate channel.
  const loopConflict = result.errors.find(
    (e) => e.message.includes("E0425") && e.message.includes("'loop'"),
  );
  if (loopConflict) {
    console.log("  FAIL: false symbol conflict for 'loop':\n");
    console.log(
      "    " + loopConflict.message.split("\n").join("\n    ") + "\n",
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

  console.log("  PASS: assembler `loop` did not conflict with C-Next loop()");
  process.exit(0);
}

main().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
