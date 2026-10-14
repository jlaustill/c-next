/**
 * #1991: 2.2 decides, for every `=`/`!=` comparison, whether it compares
 * strings (ADR-045), and requires <string.h> for one that does. These run the
 * whole transpile, so they fail if 2.3 decides it instead, or 2.2 skips it.
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

describe("2.3 writes each comparison as 2.2 planned it", () => {
  it("writes a string comparison as strcmp, with <string.h>", async () => {
    const code = await generate(
      `bool same(string<8> a, string<8> b) { return a = b; }\n`,
    );
    expect(code).toContain("#include <string.h>");
    expect(code).toContain("strcmp(a, b) == 0");
  });

  it("requires <string.h> for a comparison whose strings are declared in another file", async () => {
    const fs = new MockFileSystem()
      .addFile(
        "/project/names.cnx",
        `scope Names {\n  public string<8> first <- "ab";\n}\n`,
      )
      .addFile(
        "/project/consumer.cnx",
        `#include "names.cnx"\n\nbool isAb() {\n  return Names.first = "ab";\n}\n`,
      );
    const result = await new Transpiler(
      {
        input: "/project/consumer.cnx",
        outDir: "/project/out",
        noCache: true,
        target: "host",
      },
      fs,
    ).transpile({ kind: "files" });
    expect(result.errors.map((e) => e.message)).toEqual([]);
    const consumer = fs.readFile("/project/out/consumer.c");
    expect(consumer).toContain("#include <string.h>");
    expect(consumer).toContain('strcmp(Names__first, "ab") == 0');
  });

  it("writes a number comparison as ==, without <string.h>", async () => {
    const code = await generate(`bool same(u8 a, u8 b) { return a = b; }\n`);
    expect(code).not.toContain("#include <string.h>");
    expect(code).toContain("a == b");
  });
});
