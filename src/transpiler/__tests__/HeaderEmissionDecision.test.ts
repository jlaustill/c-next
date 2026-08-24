/**
 * Issues #1161 and #1164 — one decision: "does this file have a public C interface?"
 *
 * Two predicates used to answer it and disagreed:
 *   - whether a .h is written      (Transpiler.generateHeaderForFile, on isExported)
 *   - whether the .c includes it   (CodeGenerator, on scope-member visibility only)
 *
 * #1161: top-level functions were collected as private, so they never reached
 *        the header and cross-file callers hit implicit declarations.
 * #1164: a file with no public scope member got a header nothing included, and
 *        redefined its types inline instead — a duplicate definition of the
 *        same type from one source, and MISRA C:2012 Rule 8.4 violations for
 *        every external-linkage definition in the file.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import Transpiler from "../Transpiler";
import ITranspilerConfig from "../types/ITranspilerConfig";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

describe("Header emission decision (#1161, #1164)", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = mkdtempSync(join(tmpdir(), "cnext-header-"));
  });

  afterEach(() => {
    rmSync(tempDir, { recursive: true, force: true });
  });

  async function transpileSource(
    source: string,
    name = "sample.cnx",
  ): Promise<{ code: string; headerCode: string | undefined }> {
    const sourcePath = join(tempDir, name);
    writeFileSync(sourcePath, source);
    const config: ITranspilerConfig = {
      input: sourcePath,
      includeDirs: [tempDir],
      outDir: tempDir,
      headerOutDir: tempDir,
    };
    const result = await new Transpiler(config).transpile({
      kind: "source",
      source,
      workingDir: tempDir,
      sourcePath,
    });
    expect(result.success).toBe(true);
    return {
      code: result.files[0].code,
      headerCode: result.files[0].headerCode,
    };
  }

  describe("#1161: top-level functions are public (ADR-016)", () => {
    it("emits a prototype for a top-level function taking a struct", async () => {
      const { headerCode } = await transpileSource(`
struct Point { u8 v; }
u8 readGlobal(Point p) { return p.v; }
`);
      expect(headerCode).toContain("readGlobal");
    });

    it("emits a prototype for a top-level function taking a primitive", async () => {
      const { headerCode } = await transpileSource(`
u8 addOne(u8 x) { return x + 1; }
`);
      expect(headerCode).toContain("addOne");
    });

    // Neither `public` nor `private` parses at top level, so a top-level
    // function has no opt-out: privacy is what `scope` is for (ADR-016).
    it("keeps a private scope member out of the header", async () => {
      const { headerCode } = await transpileSource(`
u8 exposed(u8 x) { return x + 1; }
scope Sample { private u8 hidden() { return 2; } }
`);
      expect(headerCode).toContain("exposed");
      expect(headerCode).not.toContain("hidden");
    });

    it("never emits a prototype for main — the C runtime calls it, not another translation unit", async () => {
      const { headerCode } = await transpileSource(`
u8 addOne(u8 x) { return x + 1; }
u32 main() { return 0; }
`);
      expect(headerCode).toContain("addOne");
      expect(headerCode).not.toContain("main");
    });

    it("generates no header for a scope whose members are all private", async () => {
      const { headerCode } = await transpileSource(`
scope Sample { private u8 hidden() { return 1; } }
`);
      expect(headerCode).toBeUndefined();
    });

    it("generates no header at all for a file whose only function is main", async () => {
      const { headerCode } = await transpileSource(`
u32 main() { return 0; }
`);
      expect(headerCode).toBeUndefined();
    });
  });

  describe("#1164: the .c includes the header whenever one is generated", () => {
    it("self-includes for a file exporting only a struct and a const", async () => {
      const { code } = await transpileSource(
        `
struct Point { i32 x; }
const Point ORIGIN <- {x: 0};
`,
        "consts.cnx",
      );
      expect(code).toContain('#include "consts.h"');
    });

    it("does not redefine a type the header already defines", async () => {
      const { code } = await transpileSource(
        `
struct Point { i32 x; }
const Point ORIGIN <- {x: 0};
`,
        "consts.cnx",
      );
      // A struct tag redefinition is an error in every C standard, so the
      // self-include and an inline typedef cannot both be present.
      expect(code).not.toContain("typedef struct Point");
    });
  });

  // Replaces the per-shape CodeGenerator tests that asserted the .c contained
  // `typedef struct` / `typedef enum` / `typedef uint8_t`. Those asserted the
  // duplicate definition this issue removes: the type is emitted once, in the
  // header, and the .c includes it. Parameterised rather than repeated per
  // shape (SonarCloud S5976).
  describe("#1164: a type is defined once, in the header", () => {
    const shapes: ReadonlyArray<{
      name: string;
      source: string;
      definition: string;
    }> = [
      {
        name: "struct",
        source: "struct Point { i32 x; i32 y; }",
        definition: "typedef struct Point",
      },
      {
        name: "struct with an array field",
        source: "struct Buffer { u8[4] data; }",
        definition: "typedef struct Buffer",
      },
      {
        name: "struct with a bool field",
        source: "struct Flag { bool enabled; }",
        definition: "typedef struct Flag",
      },
      {
        name: "nested struct",
        source: "struct Inner { u8 v; }\nstruct Outer { Inner inner; }",
        definition: "typedef struct Outer",
      },
      {
        name: "enum",
        source: "enum Color { RED, GREEN, BLUE }",
        definition: "typedef enum",
      },
      {
        name: "enum with explicit values",
        source: "enum Status { OK <- 1, ERROR <- 255 }",
        definition: "typedef enum",
      },
      {
        name: "bitmap",
        source: "bitmap8 Flags { enabled, active, reserved[6] }",
        definition: "typedef uint8_t Flags;",
      },
    ];

    it.each(shapes)(
      "$name: defined in the header, not repeated in the .c",
      async ({ source, definition }) => {
        const { code, headerCode } = await transpileSource(source, "shape.cnx");
        expect(headerCode).toContain(definition);
        // A repeat would be a redefinition error: the .c includes the header.
        expect(code).not.toContain(definition);
        expect(code).toContain('#include "shape.h"');
      },
    );
  });

  describe("one decision, not two", () => {
    // Each source is a shape that previously made the two predicates disagree.
    const shapes: ReadonlyArray<{ name: string; source: string }> = [
      {
        name: "top-level function only",
        source: "u8 addOne(u8 x) { return x + 1; }",
      },
      {
        name: "struct and const, no scope",
        source: "struct Point { i32 x; }\nconst Point ORIGIN <- {x: 0};",
      },
      { name: "enum only", source: "enum EColor { RED, GREEN }" },
      {
        name: "public scope member",
        source: "scope Sample { public u8 get() { return 1; } }",
      },
      {
        name: "private scope member only",
        source: "scope Sample { private u8 get() { return 1; } }",
      },
      { name: "main only", source: "u32 main() { return 0; }" },
    ];

    it.each(shapes)(
      "$name: a header is generated exactly when the .c includes one",
      async ({ source }) => {
        const { code, headerCode } = await transpileSource(source, "unit.cnx");
        const headerGenerated = headerCode !== undefined;
        const selfIncluded = code.includes('#include "unit.h"');
        expect(selfIncluded).toBe(headerGenerated);
      },
    );
  });
});
