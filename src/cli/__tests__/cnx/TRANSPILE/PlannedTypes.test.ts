/**
 * #1991: 2.2 plans every written type before 2.3 renders, and 2.3 spells each
 * type from that plan. These run the whole transpile, so they fail if the plan
 * is skipped (2.3 finds no decision) or made in the wrong scope.
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

describe("2.3 spells each type from 2.2's plan", () => {
  it("requires each planned type's include: <string.h> for a string parameter", async () => {
    const code = await generate(
      `u32 cap(string<8> a) { return a.capacity; }\n`,
    );
    expect(code).toContain("#include <string.h>");
  });

  it("spells a function's types, a cast's and a sizeof's", async () => {
    const code = await generate(
      `u16 f(u8 a) { u32 n <- (u32)sizeof(i16); return a; }\n`,
    );
    expect(code).toContain("uint16_t f(uint8_t a)");
    expect(code).toContain("uint32_t n = (uint32_t)sizeof(int16_t);");
  });

  it("sizes a sizeof name as the value or the type it binds to", async () => {
    const code = await generate(
      `struct Cfg { u8 a; }\nu32 f() { u16 n <- 0; u32 v <- sizeof(n); return sizeof(Cfg) + v; }\n`,
    );
    expect(code).toContain("uint32_t v = sizeof(n);");
    expect(code).toContain("cnx_clamp_add_u32(sizeof(Cfg), v)");
  });

  it("spells a scope's own type in that scope", async () => {
    const code = await generate(
      `scope Motor {\n  struct Cfg { u8 a; }\n  Cfg cfg;\n  public u8 get() { return this.cfg.a; }\n}\n`,
    );
    expect(code).toMatch(/\bstatic Motor__Cfg Motor__cfg\b/);
  });
});
