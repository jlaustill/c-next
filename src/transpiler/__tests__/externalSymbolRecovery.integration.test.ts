/**
 * Integration test for Issue #985 external-symbol recovery.
 *
 * Drives the real Transpiler over a fixture that forces the recovery path:
 * widget.h refuses standalone inclusion (its #error fires unless guard.h ran
 * first), its API is emitted by a guard.h macro and decorated with a trailing
 * attribute macro, and it declares a pointer-parameter function plus an opaque
 * handle. This exercises Transpiler._collectExternalDeclarations and its
 * helpers, ExternalDeclarationOracle, and the downstream codegen that adds `&`
 * for a struct passed to a pointer param and `*` for an opaque handle.
 *
 * Requires a C preprocessor toolchain; skips gracefully when none is available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import CodeGenState from "../state/CodeGenState";
import Preprocessor from "../logic/preprocessor/Preprocessor";

const GUARD_H = `#define WIDGET_GUARD 1
#define WIDGET_FEATURE 1
#define USE_PTHREAD 0
#define PRIVILEGED
#define WIDGET_SCALE(x) ((x) + 1)
#define DECLARE_WIDGET_API \\
  typedef struct _widget_t widget_t; \\
  typedef struct { int mode; } widget_cfg_t; \\
  extern const widget_cfg_t widget_default_cfg; \\
  int widget_install(const widget_cfg_t *config) PRIVILEGED; \\
  void widget_apply(const widget_cfg_t *cfg) PRIVILEGED; \\
  widget_t *widget_create(void) PRIVILEGED;
`;

// A header cnext DISCOVERS (it walks #includes unconditionally) but that cannot
// preprocess standalone — its <no-such-header> mirrors lvgl's OSAL headers
// probing <semaphore.h>. Its standalone failure sets anyHeaderPreprocessFailed,
// which is what triggers the external-declaration recovery pass. It is guarded
// out of the recovery TU (USE_PTHREAD is 0), so the union still preprocesses.
const PTHREAD_IMPL_H = `#include <cnext_no_such_header_zzz.h>\n`;

const WIDGET_H = `#ifndef WIDGET_GUARD
#error "include guard.h before widget.h"
#endif
#if USE_PTHREAD
#include "pthread_impl.h"
#endif
#if WIDGET_FEATURE
DECLARE_WIDGET_API
#endif
`;

const MAIN_CNX = `#include "guard.h"
#include "widget.h"

scope Demo {
  widget_t handle;

  void build() {
    widget_cfg_t cfg <- {mode: 1};
    i32 err <- global.widget_install(cfg);
    global.widget_apply(widget_default_cfg);
    i32 scaled <- WIDGET_SCALE(4);
    handle <- global.widget_create();
  }
}
`;

describe("external-symbol recovery (integration)", () => {
  let dir: string;
  const available = new Preprocessor().isAvailable();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-recovery-"));
    writeFileSync(join(dir, "guard.h"), GUARD_H);
    writeFileSync(join(dir, "widget.h"), WIDGET_H);
    writeFileSync(join(dir, "pthread_impl.h"), PTHREAD_IMPL_H);
    writeFileSync(join(dir, "main.cnx"), MAIN_CNX);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("recovers full signatures so codegen adds & and pointer handles", async (ctx) => {
    // Vitest reports this as skipped; an early return reported it as a
    // PASS, so a missing toolchain looked like a green test (S8968).
    if (!available) ctx.skip();

    const transpiler = new Transpiler({
      input: join(dir, "main.cnx"),
      includeDirs: [dir],
      outDir: join(dir, "out"),
      cppRequired: true,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    const unresolved = result.errors.find(
      (e) =>
        e.message.includes("widget_install") ||
        e.message.includes("widget_create") ||
        // Function-like macro recovered by name (no declaration to parse).
        e.message.includes("WIDGET_SCALE"),
    );
    expect(unresolved).toBeUndefined();
    expect(result.success).toBe(true);

    const generated = result.outputFiles.find((f) => f.endsWith("main.cpp"));
    expect(generated).toBeDefined();
    const code = readFileSync(generated!, "utf8");

    // Local struct arg passed to a pointer param -> address-of.
    expect(code).toMatch(/widget_install\(\s*&/);
    // Extern C global (struct value) passed to a pointer param -> address-of,
    // resolved via the C symbol table fallback (#985).
    expect(code).toMatch(/widget_apply\(\s*&widget_default_cfg/);
    // Opaque handle -> pointer field.
    expect(code).toMatch(/widget_t\s*\*\s*\w*handle/);
  });

  it("folds a recovered struct into externalStructFields so it stays subject to init-completeness checking", async (ctx) => {
    // Vitest reports this as skipped; an early return reported it as a
    // PASS, so a missing toolchain looked like a green test (S8968).
    if (!available) ctx.skip();

    // widget_cfg_t only becomes known through #985 recovery (its typedef is
    // emitted by the DECLARE_WIDGET_API macro inside the un-standalone header).
    // The external-struct snapshot InitializationAnalyzer consults must include
    // it — otherwise recovered structs escape init checking that cleanly
    // preprocessed structs get. Regression: the snapshot must be taken AFTER the
    // recovery pass, not before it.
    const transpiler = new Transpiler({
      input: join(dir, "main.cnx"),
      includeDirs: [dir],
      outDir: join(dir, "out"),
      cppRequired: true,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });
    expect(result.success).toBe(true);

    const external = CodeGenState.getExternalStructFields();
    expect(external.has("widget_cfg_t")).toBe(true);
    expect([...(external.get("widget_cfg_t") ?? [])]).toContain("mode");
  });

  it("re-applies recovery on a warm header cache (Issue #985 regression)", async (ctx) => {
    // Vitest reports this as skipped; an early return reported it as a
    // PASS, so a missing toolchain looked like a green test (S8968).
    if (!available) ctx.skip();

    // Fresh project dir with a project marker so on-disk caching activates
    // (determineProjectRoot needs a marker like cnext.config.json). The first
    // run populates .cnx/ with the DEGRADED header symbols (cached before the
    // recovery pass runs); the second run restores them from cache. The
    // recovery gate must survive caching so warm builds re-apply the fix.
    const cacheDir = mkdtempSync(join(tmpdir(), "cnext-recovery-cache-"));
    try {
      writeFileSync(join(cacheDir, "cnext.config.json"), "{}\n");
      writeFileSync(join(cacheDir, "guard.h"), GUARD_H);
      writeFileSync(join(cacheDir, "widget.h"), WIDGET_H);
      writeFileSync(join(cacheDir, "pthread_impl.h"), PTHREAD_IMPL_H);
      writeFileSync(join(cacheDir, "main.cnx"), MAIN_CNX);

      // Caching ON (noCache defaults to false).
      const run = async () =>
        new Transpiler({
          input: join(cacheDir, "main.cnx"),
          includeDirs: [cacheDir],
          outDir: join(cacheDir, "out"),
          cppRequired: true,
        }).transpile({ kind: "files" });

      // Cold cache: populates .cnx/ with the degraded header symbols.
      const cold = await run();
      expect(cold.success).toBe(true);

      // Warm cache: headers unchanged and restored from cache. The recovery
      // pass must still fire and produce the same corrected codegen — before
      // the fix, the warm build regenerated the by-value / non-compiling output.
      const warm = await run();
      expect(warm.success).toBe(true);

      const generated = warm.outputFiles.find((f) => f.endsWith("main.cpp"));
      expect(generated).toBeDefined();
      const code = readFileSync(generated!, "utf8");
      expect(code).toMatch(/widget_install\(\s*&/);
      expect(code).toMatch(/widget_apply\(\s*&widget_default_cfg/);
      expect(code).toMatch(/widget_t\s*\*\s*\w*handle/);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("does nothing when no header failed to preprocess (clean project)", async (ctx) => {
    // Vitest reports this as skipped; an early return reported it as a
    // PASS, so a missing toolchain looked like a green test (S8968).
    if (!available) ctx.skip();

    // A .cnx with no C includes never trips anyHeaderPreprocessFailed, so the
    // recovery pass is a no-op and transpilation still succeeds.
    const cleanDir = mkdtempSync(join(tmpdir(), "cnext-clean-"));
    try {
      writeFileSync(
        join(cleanDir, "main.cnx"),
        `scope Demo {\n  void run() {\n    i32 x <- 1;\n  }\n}\n`,
      );
      const transpiler = new Transpiler({
        input: join(cleanDir, "main.cnx"),
        outDir: join(cleanDir, "out"),
        noCache: true,
      });
      const result = await transpiler.transpile({ kind: "files" });
      expect(result.success).toBe(true);
    } finally {
      rmSync(cleanDir, { recursive: true, force: true });
    }
  });
});
