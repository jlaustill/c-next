/**
 * Integration test: auto-discovery of compile_commands.json.
 *
 * cnext resolves external C/C++ headers exactly as the compiler will by reading
 * the build-system-agnostic contract every build system emits — the
 * `compile_commands.json` compilation database — from the project root, the way
 * clangd does. This proves the wiring end-to-end: a header reachable ONLY through
 * the compile database's `-I` (never passed via includeDirs / cnext.config.json)
 * must resolve during a real transpile, and its pointer-parameter signature must
 * drive `&` codegen.
 *
 * Requires a C preprocessor toolchain; skips gracefully when none is available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import {
  mkdtempSync,
  writeFileSync,
  mkdirSync,
  rmSync,
  readFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import Preprocessor from "../logic/preprocessor/Preprocessor";

const WIDGET_H = `typedef struct { int mode; } widget_cfg_t;
void widget_do(const widget_cfg_t *cfg);
`;

const MAIN_CNX = `#include <widget.h>

scope Demo {
  void run() {
    widget_cfg_t cfg <- {mode: 1};
    global.widget_do(cfg);
  }
}
`;

describe("compile_commands.json auto-discovery (integration)", () => {
  let dir: string;
  const available = new Preprocessor().isAvailable();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-cc-discovery-"));
    mkdirSync(join(dir, "ext"));
    writeFileSync(join(dir, "ext", "widget.h"), WIDGET_H);
    writeFileSync(join(dir, "main.cnx"), MAIN_CNX);
    // Project-root marker so discovery locates the database.
    writeFileSync(join(dir, "cnext.config.json"), "{}\n");
    // The compiler's own view: <widget.h> is reachable ONLY via this -I.
    writeFileSync(
      join(dir, "compile_commands.json"),
      JSON.stringify([
        {
          directory: dir,
          file: join(dir, "main.cpp"),
          command: `cc -I${join(dir, "ext")} -c main.cpp`,
        },
      ]),
    );
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("resolves a header supplied only by the compile database", async () => {
    if (!available) return; // no toolchain in this env

    // Note: NO includeDirs — the ext/ path exists solely in compile_commands.json.
    const transpiler = new Transpiler({
      input: join(dir, "main.cnx"),
      outDir: join(dir, "out"),
      cppRequired: true,
      noCache: true,
    });

    const result = await transpiler.transpile({ kind: "files" });

    const unresolved = result.errors.find((e) =>
      e.message.includes("widget_do"),
    );
    expect(unresolved).toBeUndefined();
    expect(result.success).toBe(true);

    const generated = result.outputFiles.find((f) => f.endsWith("main.cpp"));
    expect(generated).toBeDefined();
    const code = readFileSync(generated!, "utf8");
    // Pointer-parameter signature (from the compile-db-supplied header) -> `&`.
    expect(code).toMatch(/widget_do\(\s*&/);
  });
});
