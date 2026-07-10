/**
 * ExternalDeclarationOracle — recover FULL external symbols (function signatures,
 * typedefs, opaque structs) from a set of C/C++ headers that cnext's normal,
 * per-header-standalone symbol collection could not resolve.
 *
 * Two things defeat standalone collection of framework headers:
 *  1. Include-order guards — FreeRTOS `task.h` opens with
 *     `#ifndef INC_FREERTOS_H / #error`, so it refuses to preprocess unless
 *     `FreeRTOS.h` ran first.
 *  2. The parser's twin failure modes on a single header:
 *     - RAW (unpreprocessed) text still contains function-attribute macros like
 *       FreeRTOS `PRIVILEGED_FUNCTION` (`void vTaskDelay(...) PRIVILEGED_FUNCTION;`)
 *       — the trailing token breaks the declaration, so `vTaskDelay` is lost.
 *     - FULLY preprocessed text inlines the header's entire transitive tree
 *       (e.g. `driver/twai.h` -> ~100KB of xtensa HAL); ANTLR error-recovery then
 *       skips tokens in the blob and silently drops later declarations.
 *
 * The fix is to preprocess the include set AS A TRANSLATION UNIT (predecessors
 * first) while KEEPING `#line` directives, then bucket the output BY SOURCE FILE.
 * Each header's own slice is macro-expanded (PRIVILEGED_FUNCTION is gone) yet
 * small (no inlined tree), so parsing it robustly yields full signatures. The
 * caller parses each slice with cnext's real header parser, so recovered symbols
 * carry their full types — codegen needs these to pass structs by address
 * (`twai_driver_install(&cfg)`) and treat opaque types as pointers
 * (`lv_obj_t` -> `lv_obj_t *`).
 *
 * Function-like macros (e.g. `pdMS_TO_TICKS`) have no declaration to parse, so
 * their NAMES are collected separately (`-dM`) for the undeclared-call check
 * only — a by-value macro invocation is already correct.
 *
 * Requires a toolchain that can preprocess the target's headers; for cross
 * targets (ESP32/xtensa) set CNEXT_CROSS_COMPILER.
 */
import Preprocessor from "./Preprocessor";
import IPreprocessOptions from "./types/IPreprocessOptions";

// Function-like macro definitions from a `-dM` dump: `#define pdMS_TO_TICKS(`.
const FUNCTION_MACRO = /^#define\s+([A-Za-z_]\w*)\(/gm;
// gcc/clang line marker: `# 958 "/path/to/task.h" 2`.
const LINE_MARKER = /^#\s+\d+\s+"([^"]+)"/;
// Synthetic TU filename (appears in preprocessor errors, keyed on to locate a
// failing include by its line number).
const TU_NAME = "cnext-external-decl-oracle.c";

interface IExternalRecovery {
  /**
   * Map of source header path -> that header's OWN preprocessed text (its
   * macro-expanded declarations, without the transitively-inlined tree). Parse
   * each with the real header parser to register full external symbols.
   */
  perFileContent: Map<string, string>;
  /** Names of function-like macros — no declaration exists to parse. */
  macroNames: Set<string>;
}

class ExternalDeclarationOracle {
  /**
   * Preprocess `includeDirectives` (e.g. `"<freertos/task.h>"`) as one TU and
   * return each header's own preprocessed slice plus function-like-macro names.
   *
   * @param includeDirectives include specs, in source order (angle- or
   *   quote-form, e.g. `<Arduino.h>` or `"foo.h"`)
   * @param preprocessor the shared Preprocessor (uses CNEXT_CROSS_COMPILER)
   * @param options include paths + defines for the TU
   */
  static async recover(
    includeDirectives: readonly string[],
    preprocessor: Preprocessor,
    options: IPreprocessOptions,
  ): Promise<IExternalRecovery | null> {
    if (includeDirectives.length === 0 || !preprocessor.isAvailable()) {
      return null;
    }

    // KEEP line directives so the output can be split back into per-file slices.
    const base: IPreprocessOptions = { ...options, keepLineDirectives: true };

    // Build the largest subset that preprocesses cleanly (drop a header that
    // can't preprocess — e.g. a fragile lvgl.h — instead of losing everything).
    const working = await ExternalDeclarationOracle.preprocessLargestWorkingTu(
      [...includeDirectives],
      preprocessor,
      base,
    );
    if (!working) return null;

    const perFileContent = ExternalDeclarationOracle.splitByFile(
      working.content,
    );

    // Function-like macros the plain preprocess would have consumed at use.
    const macroNames = new Set<string>();
    const macros = await preprocessor.preprocessString(
      ExternalDeclarationOracle.buildTu(working.directives),
      TU_NAME,
      { ...options, keepLineDirectives: false, dumpMacros: true },
    );
    if (macros.success) {
      for (const match of macros.content.matchAll(FUNCTION_MACRO)) {
        macroNames.add(match[1]);
      }
    }

    return { perFileContent, macroNames };
  }

  /**
   * Bucket preprocessed output by originating source file using its `#line`
   * markers. Synthetic units (`<built-in>`, `<command-line>`, the TU itself) are
   * skipped. Each real header maps to the concatenation of its own emitted lines.
   */
  private static splitByFile(content: string): Map<string, string> {
    const buckets = new Map<string, string[]>();
    let current = "";
    for (const line of content.split("\n")) {
      const marker = LINE_MARKER.exec(line);
      if (marker) {
        current = marker[1];
        continue;
      }
      if (!current || current.startsWith("<") || current.endsWith(TU_NAME)) {
        continue;
      }
      let bucket = buckets.get(current);
      if (!bucket) {
        bucket = [];
        buckets.set(current, bucket);
      }
      bucket.push(line);
    }
    const perFile = new Map<string, string>();
    for (const [file, lines] of buckets) {
      perFile.set(file, lines.join("\n"));
    }
    return perFile;
  }

  private static buildTu(directives: readonly string[]): string {
    return directives.map((d) => `#include ${d}`).join("\n") + "\n";
  }

  /**
   * Preprocess the directives as a TU; on failure, drop the single include that
   * caused it (identified by its line in the synthetic TU) and retry. Returns
   * the preprocessed content and the surviving directive list, or null.
   */
  private static async preprocessLargestWorkingTu(
    directives: string[],
    preprocessor: Preprocessor,
    base: IPreprocessOptions,
  ): Promise<{ content: string; directives: string[] } | null> {
    const remaining = directives;
    // At most one drop per iteration; bound iterations by the directive count.
    for (
      let attempt = 0;
      remaining.length > 0 && attempt <= directives.length;
      attempt++
    ) {
      const result = await preprocessor.preprocessString(
        ExternalDeclarationOracle.buildTu(remaining),
        TU_NAME,
        base,
      );
      if (result.success) {
        return { content: result.content, directives: remaining };
      }
      const failedIndex = ExternalDeclarationOracle.findFailingIncludeIndex(
        result.error,
        remaining.length,
      );
      if (failedIndex < 0) return null; // can't localize — give up
      remaining.splice(failedIndex, 1);
    }
    return null;
  }

  /**
   * From a preprocessor error, find the index of the top-level `#include` that
   * failed, via its line number in the synthetic TU (directive i is at line
   * i+1). Returns -1 if it can't be localized.
   */
  private static findFailingIncludeIndex(
    error: string | undefined,
    count: number,
  ): number {
    if (!error) return -1;
    const pattern = new RegExp(TU_NAME.replace(/\./g, "\\.") + ":(\\d+)", "g");
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(error)) !== null) {
      const line = Number.parseInt(match[1], 10);
      if (line >= 1 && line <= count) return line - 1;
    }
    return -1;
  }
}

export default ExternalDeclarationOracle;
