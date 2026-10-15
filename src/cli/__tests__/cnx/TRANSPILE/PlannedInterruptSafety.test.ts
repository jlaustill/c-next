/**
 * #1991: 2.2 decides how each atomic read-modify-write is written (ADR-049),
 * and requires the IRQ wrappers for every masked region and CMSIS for every
 * LDREX/STREX loop (ADR-050). These run the whole transpile, so they fail if
 * 2.2 skips either decision.
 */
import { describe, it, expect } from "vitest";
import Transpiler from "../../../Transpiler";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

const WRAPPERS = "static inline uint32_t __cnx_get_PRIMASK(void)";

async function generate(source: string): Promise<string> {
  const transpiler = new Transpiler(
    { input: "", outDir: "", noCache: true },
    NodeFileSystem.instance,
  );
  const result = await transpiler.transpile({ kind: "source", source });
  expect(result.errors.map((e) => e.message)).toEqual([]);
  return result.files[0]?.code ?? "";
}

describe("2.2 plans every atomic and masked region 2.3 writes", () => {
  it("a critical block needs the IRQ wrappers", async () => {
    const code = await generate(
      "#pragma target cortex-m0\nu32 a;\nvoid f() { critical { a <- 1; } }\n",
    );
    expect(code).toContain("__cnx_disable_irq();");
    expect(code).toContain(WRAPPERS);
  });

  it("an atomic on an LDREX target is a loop, with CMSIS", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic u32 c <- 0;\nvoid f() { c +<- 1; }\n",
    );
    expect(code).toContain("__LDREXW(&c)");
    expect(code).toContain("#include <cmsis_gcc.h>");
    expect(code).not.toContain(WRAPPERS);
  });

  it("an atomic with no exclusive access is masked, with the wrappers", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic u64 c <- 0;\nvoid f() { c +<- 1; }\n",
    );
    expect(code).toContain("__cnx_disable_irq();");
    expect(code).toContain(WRAPPERS);
    expect(code).not.toContain("#include <cmsis_gcc.h>");
  });

  it("a plain store to an atomic is neither", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic u32 c <- 0;\nvoid f() { c <- 1; }\n",
    );
    expect(code).not.toContain("__LDREXW");
    expect(code).not.toContain("#include <cmsis_gcc.h>");
    expect(code).not.toContain(WRAPPERS);
  });
});
