/**
 * #1991: 2.2 decides which ADR-051 safe-division helpers a file calls, before
 * 2.3 writes any of them. This runs the whole transpile, so it fails if 2.2
 * skips the decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true },
    NodeFileSystem.instance,
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.2 plans every safe-division helper 2.3 calls", () => {
  it("defines the helper each call names, and no other", async () => {
    const code = await generate(
      [
        "#pragma target host",
        "mut u16 q;",
        "mut i32 m;",
        "void f(u16 a, u16 b, i32 c, i32 d) {",
        "    mut bool e <- safe_div(q, a, b, 0);",
        "    e <- safe_mod(m, c, d, 1);",
        "}",
        "",
      ].join("\n"),
    );
    expect(code).toContain("e = cnx_safe_div_u16(&q, ");
    expect(code).toContain("static inline bool cnx_safe_div_u16(");
    expect(code).toContain("e = cnx_safe_mod_i32(&m, ");
    expect(code).toContain("static inline bool cnx_safe_mod_i32(");
    expect(code).not.toContain("cnx_safe_div_i32(");
  });
});
