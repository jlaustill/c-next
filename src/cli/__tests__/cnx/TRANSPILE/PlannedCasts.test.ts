/**
 * #1991: 2.2 decides, for every cast, whether it saturates (ADR-024) and in
 * which form, and requires <limits.h> and the single-evaluation helper for it.
 * These run the whole transpile, so they fail if 2.2 skips a decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../MockFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true, target: "host" },
    new MockFileSystem(),
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.3 writes each cast as 2.2 planned it", () => {
  it("saturates a float cast inline, with <limits.h>", async () => {
    const code = await generate(`u8 f(f32 x) { return (u8)x; }\n`);
    expect(code).toContain("#include <limits.h>");
    expect(code).toContain("UINT8_MAX");
    expect(code).not.toContain("cnx_cast_sat_");
  });

  it("calls the helper for a side-effecting operand, and defines it", async () => {
    const code = await generate(
      `f32 produce() { return 1.5; }\nu8 f() { return (u8)produce(); }\n`,
    );
    expect(code).toContain("#include <limits.h>");
    expect(code).toContain("cnx_cast_sat_f32_u8(produce())");
    expect(code).toMatch(/uint8_t cnx_cast_sat_f32_u8\(float /);
  });

  it("writes a widening cast plainly, without <limits.h>", async () => {
    const code = await generate(`u32 f(u8 x) { return (u32)x; }\n`);
    expect(code).toContain("(uint32_t)x");
    expect(code).not.toContain("#include <limits.h>");
  });
});
