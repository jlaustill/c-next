/**
 * #1991: 2.2 requires <string.h> for every `.char_count` read 2.3 writes as
 * strlen (ADR-058). The string here is declared in another file, so no type
 * this file writes asks for <string.h>: only the planned read does.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import MockFileSystem from "../../MockFileSystem";

async function consumerOf(body: string): Promise<string> {
  const fs = new MockFileSystem()
    .addFile(
      "/project/names.cnx",
      `scope Names {\n  public string<8> first <- "ab";\n}\n`,
    )
    .addFile("/project/consumer.cnx", `#include "names.cnx"\n\n${body}`);
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
  return fs.readFile("/project/out/consumer.c");
}

describe("2.2 plans each .char_count read 2.3 writes", () => {
  it("requires <string.h> for a .char_count of a string declared in another file", async () => {
    const code = await consumerOf(
      `u32 count() {\n  return Names.first.char_count;\n}\n`,
    );
    expect(code).toContain("#include <string.h>");
    expect(code).toContain("strlen(Names__first)");
  });

  it("requires no <string.h> for a .capacity, which is a number", async () => {
    const code = await consumerOf(
      `u32 cap() {\n  return Names.first.capacity;\n}\n`,
    );
    expect(code).not.toContain("#include <string.h>");
  });
});
