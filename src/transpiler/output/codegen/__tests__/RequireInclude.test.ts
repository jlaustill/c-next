/**
 * Unit tests for CodeGenerator.requireInclude() behavior
 *
 * Tests the centralized include flag management by verifying
 * that the correct #include directives appear in generated output.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";
import SymbolRegistry from "../../../state/SymbolRegistry";
import CodeGenState from "../../../state/CodeGenState";

describe("CodeGenerator requireInclude", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
    // Every transpile here omits sourcePath, so all symbols land under the
    // "<string>" placeholder. Without a reset they accumulate across tests and
    // one test reads another's output.
    SymbolRegistry.reset();
    CodeGenState.reset();
  });

  describe("stdint includes", () => {
    it("includes stdint.h for u8 type", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({ kind: "source", source: "u8 value <- 0;" })
      ).files[0];

      expect(result.success).toBe(true);
      // #1164: the bitmap typedef is emitted once, in the header, so it is the
      // header that requires stdint; the .c receives both by including it.
      // Asserted across the pair because the requirement is satisfied by the
      // translation unit, not by either file alone.
      expect(`${result.code}${result.headerCode ?? ""}`).toContain(
        "#include <stdint.h>",
      );
    });

    it.each([
      ["includes stdint.h for u16 type", "u16 value <- 0;"],
      ["includes stdint.h for u32 type", "u32 value <- 0;"],
      ["includes stdint.h for i32 type", "i32 value <- 0;"],
    ])("%s", async (_label, source) => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: source,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for bitmap types", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        bitmap8 Flags {
          enabled,
          active,
          reserved[6]
        }
        Flags f <- 0;
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      // #1164: the bitmap typedef is emitted once, in the header, so it is the
      // header that requires stdint; the .c receives it by including the header.
      // Asserted across the pair -- the requirement belongs to the translation
      // unit, not to either file alone.
      expect(`${result.code}${result.headerCode ?? ""}`).toContain(
        "#include <stdint.h>",
      );
    });
  });

  describe("stdbool includes", () => {
    it("includes stdbool.h for bool type", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "bool flag <- false;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdbool.h>");
    });
  });

  describe("string includes", () => {
    it("includes string.h for bounded string type", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: 'string<32> name <- "test";',
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <string.h>");
    });

    it("includes string.h for const string inference", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: 'const string message <- "hello";',
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <string.h>");
    });
  });

  describe("isr includes", () => {
    it("generates ISR typedef for ISR type", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "ISR handler <- null;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      // #1164: whichever file carries it, exactly one must -- two definitions
      // of one typedef name is a redeclaration error in C99.
      const isrTypedef = /typedef void \(\*ISR\)\(void\)/g;
      const emitted = `${result.code}${result.headerCode ?? ""}`;
      expect(emitted.match(isrTypedef)).toHaveLength(1);
    });
  });

  describe("float static assert includes", () => {
    it("generates static assert for float bit indexing write", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        f32 setByte(u8 b) {
          f32 value <- 0.0;
          value[0, 8] <- b;
          return value;
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("_Static_assert");
      expect(result.code).toContain("sizeof(float)");
    });

    it("generates static assert for float bit indexing read (no string.h)", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        u8 getByte() {
          f32 value <- 1.0;
          return value[0, 8];
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("_Static_assert");
      // Uses union-based type punning, no memcpy needed (MISRA 21.15 compliant)
      expect(result.code).not.toContain("#include <string.h>");
      expect(result.code).toContain("union { float f; uint32_t u; }");
    });
  });

  describe("limits includes", () => {
    it("includes limits.h for float-to-int clamp cast", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        i32 convert(f32 value) {
          return (i32)value;
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <limits.h>");
    });
  });

  describe("multiple includes", () => {
    it("includes multiple headers when needed", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: `
        bool check(u32 value, string<16> name) {
          return value > 0;
        }
      `,
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
      expect(result.code).toContain("#include <stdbool.h>");
      expect(result.code).toContain("#include <string.h>");
    });

    it("does not include unused headers", async () => {
      const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "void doNothing() { }",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).not.toContain("#include <stdint.h>");
      expect(result.code).not.toContain("#include <stdbool.h>");
      expect(result.code).not.toContain("#include <string.h>");
    });
  });

  describe("deduplicates auto-includes against passthrough includes (#1108)", () => {
    const countOccurrences = (haystack: string, needle: string): number =>
      haystack.split(needle).length - 1;

    /**
     * Each case reaches the same header by a different route, and every route
     * must converge on exactly one `#include`:
     *  - source passthrough colliding with an auto-include, and
     *  - the ADR-051 safe-div helper, whose bool dependency now flows through
     *    requireInclude() instead of the helper emitting its own directive.
     */
    const DEDUP_CASES = [
      {
        route: "source passthrough of stdint.h",
        header: "#include <stdint.h>",
        source: "#include <stdint.h>\nu8 value <- 0;",
      },
      {
        route: "source passthrough of stdbool.h",
        header: "#include <stdbool.h>",
        source: "#include <stdbool.h>\nbool flag <- true;",
      },
      {
        route: "safe-div helper needing stdbool.h",
        header: "#include <stdbool.h>",
        source:
          "void t() { u32 r <- 0; bool err <- false; err <- safe_div(r, 10, 2, 0); }",
      },
    ];

    it.each(DEDUP_CASES)(
      "emits the header exactly once via $route",
      async ({ header, source }) => {
        const transpiler = new Transpiler({ input: "", noCache: true }, mockFs);

        const result = (await transpiler.transpile({ kind: "source", source }))
          .files[0];

        expect(result.success).toBe(true);
        expect(result.code).toContain(header);
        expect(countOccurrences(result.code!, header)).toBe(1);
      },
    );
  });
});
