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

// #2200: a bit, a bit range or a bitmap field of an atomic is a read-modify-
// write of the whole value, so it takes the form 2.2 plans for one (ADR-049).
describe("2.2 plans the atomic form for the bits of an atomic", () => {
  const BITS = [
    "bitmap8 Flags { A, B, Mode[3], C, D, E }",
    "atomic u32 word <- 0;",
    "atomic u64 wide <- 0;",
    "atomic Flags flags;",
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

  it("writes a float's bits through its integer view, in the planned form", async () => {
    const source = [
      "atomic f32 fl;",
      "void f() {",
      "    fl[31] <- true;",
      "    fl[0, 4] <- 3;",
      "}",
      "",
    ].join("\n");
    const host = await generate(`#pragma target host\n${source}`);
    expect(host).toContain("__atomic_load(&fl, &__old.f, __ATOMIC_RELAXED);");
    expect(host).toContain("__new.u = (__old.u & ~((uint32_t)1U << 31))");
    expect(host).toContain(
      "__atomic_compare_exchange(&fl, &__old.f, &__new.f, 0,",
    );
    const masked = await generate(`#pragma target teensy41\n${source}`);
    expect(masked).toContain("__cnx_disable_irq();");
    expect(masked).toContain("__bits.u = (__bits.u & ~((uint32_t)1U << 31))");
    expect(masked).not.toContain("__bits_fl");
  });

  it("accesses a signed atomic through its unsigned type", async () => {
    const code = await generate(
      "#pragma target teensy41\natomic i32 s;\nvoid f() {\n    s[3] <- true;\n    s +<- 1;\n}\n",
    );
    expect(code).toContain(
      "int32_t __old = (int32_t)__LDREXW((volatile uint32_t *)&s);",
    );
    expect(code).toContain(
      "__STREXW((uint32_t)__new, (volatile uint32_t *)&s)",
    );
  });

  it("writes a scope member's compound write atomically in every spelling", async () => {
    const code = await generate(
      "#pragma target teensy41\nscope Sc {\n    public atomic wrap u32 cnt;\n    public void go() {\n        this.cnt +<- 1;\n    }\n}\nvoid f() {\n    Sc.cnt +<- 1;\n}\n",
    );
    expect(code.match(/__LDREXW\(&Sc__cnt\)/g)).toHaveLength(2);
    expect(code).not.toContain("Sc__cnt += 1U");
  });
});
