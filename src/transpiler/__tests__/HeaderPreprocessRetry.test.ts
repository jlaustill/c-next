/**
 * #1817: the header preprocessing retry, which nothing tested.
 *
 * A header that cannot preprocess on its own (its `#error` fires unless an
 * earlier header ran first) is retried with `-imacros` of every earlier header
 * that preprocessed cleanly. Before this file, passing no predecessors to that
 * retry left all 8102 unit tests and all 1472 fixtures green.
 *
 * The chain is the point: c.h needs b.h's macros, and b.h preprocesses only
 * through its own retry. A retry that saw only the headers whose FIRST attempt
 * succeeded would drop b.h, and c.h would fail.
 *
 * Requires a C preprocessor toolchain; skips when none is available.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Transpiler from "../Transpiler";
import NodeFileSystem from "../NodeFileSystem";
import type IFileSystem from "../types/IFileSystem";
import Preprocessor from "../logic/preprocessor/Preprocessor";

// No conditional of its own, so it is used as written, and it is usable.
const A_H = `#define A_GUARD 1
#define A_FEATURE 1
`;

const B_H = `#ifndef A_GUARD
#error "include a.h before b.h"
#endif
#define B_GUARD 1
#if A_FEATURE
int b_fn(void);
#endif
`;

const C_H = `#ifndef B_GUARD
#error "include b.h before c.h"
#endif
#if A_FEATURE
int c_fn(void);
#endif
`;

// Negative controls: no predecessor can rescue a missing header, so both fail
// the first attempt and the retry. They prove the assertions below can fail,
// and two of them pin the warnings to header order.
const missing = (fn: string): string => `#include <cnext_no_such_header_zzz.h>
#if A_FEATURE
int ${fn}(void);
#endif
`;

const MAIN_CNX = `#include "a.h"
#include "b.h"
#include "c.h"
#include "x.h"
#include "y.h"

void run() {
}
`;

describe("header preprocessing retry (#1817)", () => {
  let dir: string;
  const available = new Preprocessor(NodeFileSystem.instance).isAvailable();

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-retry-"));
    writeFileSync(join(dir, "a.h"), A_H);
    writeFileSync(join(dir, "b.h"), B_H);
    writeFileSync(join(dir, "c.h"), C_H);
    writeFileSync(join(dir, "x.h"), missing("x_fn"));
    writeFileSync(join(dir, "y.h"), missing("y_fn"));
    writeFileSync(join(dir, "main.cnx"), MAIN_CNX);
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  async function preprocessWarnings(): Promise<string[]> {
    const transpiler = new Transpiler(
      {
        input: join(dir, "main.cnx"),
        includeDirs: [dir],
        outDir: join(dir, "out"),
        noCache: true,
        target: "host",
      },
      NodeFileSystem.instance,
    );
    const result = await transpiler.transpile({ kind: "files" });
    return result.warnings.filter((w) => w.startsWith("Preprocessing failed"));
  }

  it("retries with the headers before it, including one usable only through its own retry", async (ctx) => {
    // Vitest reports this as skipped; an early return reported it as a PASS.
    if (!available) ctx.skip();

    const failed = await preprocessWarnings();

    // Control: the run does report a header that cannot be rescued, so the two
    // absences below cannot pass by reporting nothing at all.
    expect(failed.some((w) => w.includes(join(dir, "x.h")))).toBe(true);
    expect(failed.some((w) => w.includes(join(dir, "b.h")))).toBe(false);
    expect(failed.some((w) => w.includes(join(dir, "c.h")))).toBe(false);
  });

  it("reports the headers no predecessor can rescue, in header order", async (ctx) => {
    if (!available) ctx.skip();

    const failed = (await preprocessWarnings()).filter(
      (w) => w.includes(join(dir, "x.h")) || w.includes(join(dir, "y.h")),
    );

    expect(failed).toHaveLength(2);
    expect(failed[0]).toContain(join(dir, "x.h"));
    expect(failed[1]).toContain(join(dir, "y.h"));
  });
});

/**
 * #1817: a header's content is read while every header is prepared, and its
 * symbols are written later, in header order. A read that fails is carried to
 * that point and becomes the same warning it always was, in the header's place,
 * without stopping the headers after it.
 */
describe("a header whose content cannot be read (#1817)", () => {
  let dir: string;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), "cnext-unreadable-"));
    writeFileSync(join(dir, "before.h"), "int before_fn(int x);\n");
    writeFileSync(join(dir, "broken.h"), "int broken_fn(int x);\n");
    writeFileSync(join(dir, "after.h"), "int after_fn(int x);\n");
    writeFileSync(
      join(dir, "main.cnx"),
      `#include "before.h"
#include "broken.h"
#include "after.h"

void run() {
    i32 r <- global.after_fn(1);
}
`,
    );
  });

  afterAll(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it("is a warning in its place, and the headers after it are still collected", async () => {
    let brokenReads = 0;
    const real = new NodeFileSystem();
    const fs: IFileSystem = new Proxy(real, {
      get(target, key, receiver) {
        if (key === "readFile") {
          return (path: string): string => {
            // Discovery reads it first, to find its includes, and that read
            // succeeds. The read made while headers are prepared fails.
            brokenReads += path.endsWith("broken.h") ? 1 : 0;
            if (path.endsWith("broken.h") && brokenReads > 1) {
              throw new Error("simulated read failure");
            }
            return target.readFile(path);
          };
        }
        const value: unknown = Reflect.get(target, key, receiver);
        return typeof value === "function"
          ? (value as (...args: unknown[]) => unknown).bind(target)
          : value;
      },
    });

    const result = await new Transpiler(
      {
        input: join(dir, "main.cnx"),
        includeDirs: [dir],
        outDir: join(dir, "out"),
        noCache: true,
        preprocess: false,
        target: "host",
      },
      fs,
    ).transpile({ kind: "files" });

    expect(brokenReads).toBe(2);
    expect(
      result.warnings.filter((w) => w.startsWith("Failed to process header")),
    ).toEqual([
      `Failed to process header ${join(dir, "broken.h")}: Error: simulated read failure`,
    ]);
    // after.h comes after the failure, and `after_fn` resolves only if it was
    // collected.
    expect(result.errors).toEqual([]);
    expect(result.success).toBe(true);
  });
});
