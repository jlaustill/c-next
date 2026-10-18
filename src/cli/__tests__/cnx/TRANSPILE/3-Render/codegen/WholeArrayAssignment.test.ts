/**
 * #1782: a whole array given its list (ADR-035). C has no array assignment,
 * so the list fills a temporary of the target's type, copied element by
 * element -- every element read before any is written.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../../../Transpiler";
import MockFileSystem from "../../../../MockFileSystem";

const transpile = async (source: string, cppMode = false) => {
  const transpiler = new Transpiler(
    {
      input: "",
      outDir: "",
      noCache: true,
      target: "host",
      cppRequired: cppMode,
    },
    new MockFileSystem(),
  );
  const file = (await transpiler.transpile({ kind: "source", source }))
    .files[0];
  expect(file.success).toBe(true);
  return file.code;
};

describe("whole-array assignment (#1782)", () => {
  it("fills a temporary from the list and copies it", async () => {
    const code = await transpile(
      "mut u8[2] pair <- [1, 2];\nvoid f() {\n    pair <- [pair[1], pair[0]];\n}",
    );
    expect(code).toContain("const uint8_t cnx_tmp0[2] = {pair[1U], pair[0U]};");
    expect(code).toContain(
      "for (uint32_t cnx_tmp1 = 0U; cnx_tmp1 < 2U; cnx_tmp1++) {",
    );
    expect(code).toContain("pair[cnx_tmp1] = cnx_tmp0[cnx_tmp1];");
    expect(code).not.toContain("pair = {");
  });

  it("expands a fill-all as a declaration does", async () => {
    const code = await transpile(
      "mut u8[3] a <- [0*];\nvoid f() {\n    a <- [7*];\n}",
    );
    expect(code).toContain("const uint8_t cnx_tmp0[3] = {7U, 7U, 7U};");
  });

  it("copies a u8 array's string literal without expanding it", async () => {
    const code = await transpile(
      'mut u8[3] a <- [7*];\nvoid f() {\n    a <- "ab";\n}',
    );
    expect(code).toContain('const uint8_t cnx_tmp0[3] = "ab";');
  });

  it("walks a string array's characters too", async () => {
    const code = await transpile(
      'mut string<4>[2] n <- ["a", "b"];\nvoid f() {\n    n <- ["c", "d"];\n}',
    );
    expect(code).toContain('const char cnx_tmp0[2][5] = {"c", "d"};');
    expect(code).toContain(
      "n[cnx_tmp1][cnx_tmp2] = cnx_tmp0[cnx_tmp1][cnx_tmp2];",
    );
  });

  it("writes struct elements plainly, as a declaration's", async () => {
    for (const cppMode of [false, true]) {
      const code = await transpile(
        "struct S { u32 a; }\nmut S[2] s;\nvoid f() {\n    s <- [{ a: 3 }, { a: 4 }];\n}",
        cppMode,
      );
      expect(code).toContain(
        "const S cnx_tmp0[2] = {{ .a = 3U }, { .a = 4U }};",
      );
    }
  });

  it("evaluates a target's subscripts once, through a pointer", async () => {
    const code = await transpile(
      "mut u8[2][2] g;\nu32 row() {\n    return 1;\n}\nvoid f() {\n    g[row()] <- [5, 6];\n}",
    );
    expect(code).toContain("uint8_t (*const cnx_tmp1)[2] = &g[row()];");
    expect(code).toContain("(*cnx_tmp1)[cnx_tmp2] = cnx_tmp0[cnx_tmp2];");
  });

  it("leaves an element write alone", async () => {
    const code = await transpile("mut u8[2] a;\nvoid f() {\n    a[0] <- 3;\n}");
    expect(code).toContain("a[0] = 3U;");
    expect(code).not.toContain("cnx_tmp");
  });
});
