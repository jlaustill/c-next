/**
 * #1991: 2.2 decides which reads and writes go through a float's bit union
 * (ADR-007), and requires the static assert that sizes it. These run the
 * whole transpile, so they fail if 2.2 skips either decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../MockFileSystem";

const F32_ASSERT =
  '_Static_assert(sizeof(float) == 4, "Float bit indexing requires 32-bit float");';
const F64_ASSERT =
  '_Static_assert(sizeof(double) == 8, "Float bit indexing requires 64-bit double");';

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true, target: "host" },
    new MockFileSystem(),
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.2 plans every float bit union 2.3 writes", () => {
  it("a range read of a named f32", async () => {
    const code = await generate(
      "f32 g <- 1.5;\nu8 r;\nvoid main() { r <- g[0, 8]; }\n",
    );
    expect(code).toContain("__bits_g.u");
    expect(code).toContain(F32_ASSERT);
  });

  it("a single-bit write to an f64", async () => {
    const code = await generate(
      "f64 d <- 1.5;\nvoid main() { d[3] <- true; }\n",
    );
    expect(code).toContain("__bits_d.u");
    expect(code).toContain(F64_ASSERT);
  });

  it("a range write to an f32 array element", async () => {
    const code = await generate(
      "f32[2] a;\nvoid main() { a[1][0, 4] <- 3; }\n",
    );
    expect(code).toContain(F32_ASSERT);
  });
});
