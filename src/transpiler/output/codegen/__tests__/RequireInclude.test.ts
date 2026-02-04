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

      const result = await transpiler.transpileSource("u8 value <- 0;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for u16 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("u16 value <- 0;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for u32 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("u32 value <- 0;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for i32 type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("i32 value <- 0;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });

    it("includes stdint.h for bitmap types", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(`
        bitmap8 Flags {
          enabled,
          active,
          reserved[6]
        }
        Flags f <- 0;
      `);

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
    });
  });

  describe("stdbool includes", () => {
    it("includes stdbool.h for bool type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("bool flag <- false;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdbool.h>");
    });
  });

  describe("string includes", () => {
    it("includes string.h for bounded string type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(
        'string<32> name <- "test";',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <string.h>");
    });

    it("includes string.h for const string inference", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(
        'const string message <- "hello";',
      );

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <string.h>");
    });
  });

  describe("isr includes", () => {
    it("generates ISR typedef for ISR type", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("ISR handler <- null;");

      expect(result.success).toBe(true);
      expect(result.code).toContain("typedef void (*ISR)(void)");
    });
  });

  describe("float static assert includes", () => {
    it("generates static assert for float bit indexing write", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(`
        f32 setByte(u8 b) {
          f32 value <- 0.0;
          value[0, 8] <- b;
          return value;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.code).toContain("_Static_assert");
      expect(result.code).toContain("sizeof(float)");
    });

    it("generates static assert for float bit indexing read", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(`
        u8 getByte() {
          f32 value <- 1.0;
          return value[0, 8];
        }
      `);

      expect(result.success).toBe(true);
      expect(result.code).toContain("_Static_assert");
      expect(result.code).toContain("#include <string.h>"); // For memcpy
    });
  });

  describe("limits includes", () => {
    it("includes limits.h for float-to-int clamp cast", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(`
        i32 convert(f32 value) {
          return (i32)value;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <limits.h>");
    });
  });

  describe("multiple includes", () => {
    it("includes multiple headers when needed", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource(`
        bool check(u32 value, string<16> name) {
          return value > 0;
        }
      `);

      expect(result.success).toBe(true);
      expect(result.code).toContain("#include <stdint.h>");
      expect(result.code).toContain("#include <stdbool.h>");
      expect(result.code).toContain("#include <string.h>");
    });

    it("does not include unused headers", async () => {
      const transpiler = new Transpiler({ inputs: [], noCache: true }, mockFs);

      const result = await transpiler.transpileSource("void doNothing() { }");

      expect(result.success).toBe(true);
      expect(result.code).not.toContain("#include <stdint.h>");
      expect(result.code).not.toContain("#include <stdbool.h>");
      expect(result.code).not.toContain("#include <string.h>");
    });
  });
});
