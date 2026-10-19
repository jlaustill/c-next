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
      "#pragma target cortex-m0\nmut u32 a;\nvoid f() { critical { a <- 1; } }\n",
    );
    expect(code).toContain("__cnx_disable_irq();");
    expect(code).toContain(WRAPPERS);
  });

  it("an atomic on an LDREX target is a loop, with CMSIS", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic mut u32 c <- 0;\nvoid f() { c +<- 1; }\n",
    );
    expect(code).toContain("__LDREXW(&c)");
    expect(code).toContain("#include <cmsis_gcc.h>");
    expect(code).not.toContain(WRAPPERS);
  });

  it("an atomic with no exclusive access is masked, with the wrappers", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic mut u64 c <- 0;\nvoid f() { c +<- 1; }\n",
    );
    expect(code).toContain("__cnx_disable_irq();");
    expect(code).toContain(WRAPPERS);
    expect(code).not.toContain("#include <cmsis_gcc.h>");
  });

  it("a plain store to an atomic is neither", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic mut u32 c <- 0;\nvoid f() { c <- 1; }\n",
    );
    expect(code).not.toContain("__LDREXW");
    expect(code).not.toContain("#include <cmsis_gcc.h>");
    expect(code).not.toContain(WRAPPERS);
  });
});

// #2200: a bit, a bit range or a bitmap field of an atomic is a read-modify-
// write of the whole value, so it takes the form 2.2 plans for one (ADR-049).
describe("2.2 plans the atomic form for the bits of an atomic", () => {
  const BITS = [
    "bitmap8 Flags { A, B, Mode[3], C, D, E }",
    "atomic mut u32 word <- 0;",
    "atomic mut u64 wide <- 0;",
    "atomic mut Flags flags;",
    "void f() {",
    "    word[1] <- true;",
    "    wide[9, 4] <- 11;",
    "    flags.Mode <- 3;",
    "}",
    "",
  ].join("\n");

  it("writes an LDREX/STREX loop where the target has exclusive access", async () => {
    const code = await generate(`#pragma target teensy41\n${BITS}`);
    expect(code).toContain("__LDREXW(&word)");
    expect(code).toContain("__LDREXB(&flags)");
    expect(code).toContain("#include <cmsis_gcc.h>");
  });

  it("masks interrupts for a type with no exclusive access", async () => {
    const code = await generate(`#pragma target teensy41\n${BITS}`);
    expect(code).toContain("__cnx_disable_irq();");
    expect(code).toContain(WRAPPERS);
  });

  it("writes a compare-exchange loop on a host target", async () => {
    const code = await generate(`#pragma target host\n${BITS}`);
    expect(code).toContain("__atomic_compare_exchange(&word");
    expect(code).toContain("__atomic_compare_exchange(&flags");
    expect(code).not.toContain("word = (uint32_t)((word");
  });
});
