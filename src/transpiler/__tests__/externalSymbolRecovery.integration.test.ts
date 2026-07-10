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

  it("recovers full signatures so codegen adds & and pointer handles", async () => {
    if (!available) return; // no toolchain in this env

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

  it("does nothing when no header failed to preprocess (clean project)", async () => {
    if (!available) return;

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
