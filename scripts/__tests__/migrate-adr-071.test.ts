/**
 * #2103: ADR-071's migration, run on pre-ADR-071 code: `const` is deleted,
 * `mut` is added where the analysis finds a write, and what it cannot finish
 * is reported rather than passed over.
 */

import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MigrateAdr071 from "../migrate-adr-071";

describe("migrate-adr-071", () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "migrate-adr-071-test-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
    vi.restoreAllMocks();
  });

  function file(name: string, text: string): string {
    const path = join(dir, name);
    writeFileSync(path, text);
    return path;
  }

  it("deletes `const` and adds `mut` to what is written, then exits 0", async () => {
    const path = file(
      "a.cnx",
      [
        "const u32 LIMIT <- 5;",
        "void bump(u32 v) {",
        "    v <- LIMIT;",
        "}",
        "",
      ].join("\n"),
    );

    expect(await MigrateAdr071.run([dir])).toBe(0);
    expect(readFileSync(path, "utf8")).toBe(
      [
        "u32 LIMIT <- 5;",
        "void bump(mut u32 v) {",
        "    v <- LIMIT;",
        "}",
        "",
      ].join("\n"),
    );
  });

  it("leaves a test-error fixture for review", async () => {
    const text = "// test-error\nconst u32 LIMIT <- 5;\n";
    const path = file("e.test.cnx", text);

    const result = await MigrateAdr071.migrate([dir], []);
    expect(result.review).toEqual([path]);
    expect(readFileSync(path, "utf8")).toBe(text);
  });

  it("exits 1 and names a file that still fails for another reason", async () => {
    const path = file("b.cnx", "void run() {\n    missing();\n}\n");

    const result = await MigrateAdr071.migrate([dir], []);
    expect(result.failing.map((f) => f.file)).toEqual([path]);
    expect(result.failing[0].error).toContain("E0422");
    expect(await MigrateAdr071.run([dir])).toBe(1);
  });

  it("rejects `--include` with no directory", async () => {
    expect(await MigrateAdr071.run(["--include"])).toBe(2);
  });
});
