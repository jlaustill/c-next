/**
 * Issue #1152: `clamp` must govern arithmetic expressions, not just compound
 * assignment.
 *
 * `clamp` is C-Next's default overflow behavior (ADR-044), but it used to apply
 * only to `+<-`/`-<-`/`*<-`. So `c <- a + b` wrapped while `c +<- b` saturated,
 * and `wrap` produced byte-identical output to `clamp` in every expression --
 * the opt-in modifier bought nothing and the default protected nothing.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../../__tests__/MockFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", noCache: true },
    new MockFileSystem(),
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("clamp arithmetic in expressions", () => {
  it("saturates addition", async () => {
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 b <- 250; u8 c <- a + b; return 0; }`,
    );
    expect(code).toContain("uint8_t c = cnx_clamp_add_u8(a, b);");
  });

  it("saturates subtraction", async () => {
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 b <- 250; u8 c <- b - a; return 0; }`,
    );
    expect(code).toContain("cnx_clamp_sub_u8(b, a)");
  });

  it("saturates multiplication", async () => {
    // 250 * 250 = 62500, which wraps to 36 -- smaller than either operand.
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 b <- 250; u8 c <- a * b; return 0; }`,
    );
    expect(code).toContain("cnx_clamp_mul_u8(a, b)");
  });

  it("saturates a chain left to right", async () => {
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 b <- 250; u8 c <- a + b + b; return 0; }`,
    );
    expect(code).toContain("cnx_clamp_add_u8(cnx_clamp_add_u8(a, b), b)");
  });

  it("saturates inside a condition", async () => {
    // Context 3 of the original report: `a + b` evaluated 500 here while the
    // same expression stored to a u8 gave 244 -- one expression, two values.
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 b <- 250; if (a + b > 255) { return 9; } return 0; }`,
    );
    expect(code).toContain("if (cnx_clamp_add_u8(a, b) > 255)");
  });

  it("saturates a literal operand", async () => {
    const code = await generate(
      `u32 main() { u8 a <- 250; u8 c <- a + 5; return 0; }`,
    );
    expect(code).toContain("cnx_clamp_add_u8(a, 5U)");
  });

  it("saturates a signed type", async () => {
    const code = await generate(
      `u32 main() { i8 a <- 100; i8 b <- 100; i8 c <- a + b; return 0; }`,
    );
    expect(code).toContain("cnx_clamp_add_i8(a, b)");
  });

  describe("must NOT saturate", () => {
    it("leaves a wrap type as plain C", async () => {
      // `wrap` is the documented opt-out for hot paths; if it generated the
      // same code as clamp it would buy nothing.
      const code = await generate(
        `u32 main() { wrap u8 w <- 250; u8 c <- w + w; return 0; }`,
      );
      expect(code).toContain("uint8_t c = w + w;");
      expect(code).not.toContain("cnx_clamp");
    });

    it("leaves floats as plain C", async () => {
      const code = await generate(
        `u32 main() { f32 f <- 1.5; f32 g <- 2.5; f32 h <- f + g; return 0; }`,
      );
      expect(code).toContain("float h = f + g;");
      expect(code).not.toContain("cnx_clamp");
    });

    it("leaves division alone", async () => {
      // Unsigned division cannot overflow, and there is no clamp helper for it.
      const code = await generate(
        `u32 main() { u8 a <- 200; u8 b <- 4; u8 c <- a / b; return 0; }`,
      );
      expect(code).not.toContain("cnx_clamp");
    });

    it("leaves a literal-only expression alone", async () => {
      // No operand is a declared variable, so there is no overflow behavior to
      // consult. Literals are contextually typed (ADR-052).
      const code = await generate(`u32 main() { u8 c <- 10 + 20; return 0; }`);
      expect(code).toContain("10U + 20U");
      expect(code).not.toContain("cnx_clamp");
    });
  });

  it("makes a bounds guard built from saturating values trustworthy (#231)", async () => {
    // With `offset` saturating to UINT32_MAX, an unclamped `offset + length`
    // wrapped to a small number, the guard passed, and the write went out of
    // bounds. Saturating the sum makes the natural guard correct.
    const code = await generate(
      `u8[513] buffer;\n` +
        `void writeChunk(u32 start, u32 step, u32 length, u8 value) {\n` +
        `    u32 offset <- start;\n` +
        `    offset +<- step;\n` +
        `    if (offset + length <= 513) { buffer[offset] <- value; }\n` +
        `}\n` +
        `u32 main() { writeChunk(1, 2, 4, 5); return 0; }`,
    );
    expect(code).toContain("if (cnx_clamp_add_u32(offset, length) <= 513)");
  });
});
