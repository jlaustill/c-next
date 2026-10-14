/**
 * #1991: 2.2 decides which `-` literals are their type's minimum (MISRA 10.3),
 * and requires <limits.h> for the macro 2.3 writes them as. These run the
 * whole transpile, so they fail if 2.2 skips the decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../MockFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", noCache: true, target: "host" },
    new MockFileSystem(),
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.3 writes each negative minimum as 2.2 planned it", () => {
  it.each([
    ["i32 f() { return -2147483648; }", "(int32_t)INT32_MIN"],
    ["i32 f() { return -2147483648i32; }", "(int32_t)INT32_MIN"],
    ["i64 f() { return -9223372036854775808i64; }", "(int64_t)INT64_MIN"],
    ["i64 f() { return 0 - -2147483648; }", "0 - (int32_t)INT32_MIN"],
  ])("%s writes %s, with <limits.h>", async (source, written) => {
    const code = await generate(`${source}\n`);
    expect(code).toContain(written);
    expect(code).toContain("#include <limits.h>");
  });

  it("negates a parenthesized literal plainly, without <limits.h>", async () => {
    const code = await generate(`i64 f() { return -(2147483648); }\n`);
    expect(code).toContain("-(2147483648)");
    expect(code).not.toContain("#include <limits.h>");
  });
});
