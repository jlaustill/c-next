/**
 * Unit tests for CodeGenerator.requireInclude() behavior
 *
 * Tests the centralized include flag management by verifying
 * that the correct #include directives appear in generated output.
 */

import { describe, it, expect, beforeEach } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";

describe("CodeGenerator requireInclude", () => {
  let mockFs: MockFileSystem;

  beforeEach(() => {
    mockFs = new MockFileSystem();
  });

  describe("stdint includes", () => {
    it("includes stdint.h for u8 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({ kind: "source", source: "u8 value <- 0;" })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for u16 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "u16 value <- 0;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for u32 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "u32 value <- 0;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for i32 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "i32 value <- 0;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for bitmap types", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      expect(result.code).toContain("#include <stdint.h>");
    });
  });

  describe("stdbool includes", () => {
    it("includes stdbool.h for bool type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = (
        await transpiler.transpile({
          kind: "source",
          source: "ISR handler <- null;",
        })
      ).files[0];

      expect(result.success).toBe(true);
      expect(result.code).toContain("typedef void (*ISR)(void)");
    });
  });

  describe("float static assert includes", () => {
    it("generates static assert for float bit indexing write", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

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
});
