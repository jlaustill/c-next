import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import RegisterAccessAnalyzer from "../RegisterAccessAnalyzer";

/**
 * #1322. ADR-004's access modifiers -- E0870 (a `wo` member read), E0871 (an
 * `ro` member written), E0872 (a zero assigned to a write-1 bit) -- replacing
 * four throws across three codegen files that resolved the register chain
 * three different ways and left the scoped spellings unchecked.
 *
 * The rules read the per-file symbol view, so the tests set it directly and
 * `reset()` runs after each (CLAUDE.md, analyzer test isolation). Keys are the
 * transpiled C names, as `TSymbolInfoAdapter` builds them: a register `R`
 * inside scope `Board` is `Board__R`, and its member `ST` is `Board__R__ST`.
 */
const symbols = (
  registers: Record<string, Record<string, string>>,
  opts: { scopes?: string[]; scoped?: string[] } = {},
): void => {
  const access = new Map<string, string>();
  for (const [reg, members] of Object.entries(registers)) {
    for (const [member, mod] of Object.entries(members)) {
      access.set(`${reg}__${member}`, mod);
    }
  }
  CodeGenState.symbols = {
    knownScopes: new Set(opts.scopes ?? []),
    knownEnums: new Set<string>(),
    knownRegisters: new Set(Object.keys(registers)),
    knownStructs: new Set<string>(),
    knownBitmaps: new Set<string>(),
    scopedRegisters: new Map((opts.scoped ?? []).map((r) => [r, "0x0"])),
    registerMemberAccess: access,
    scopeMembers: new Map(),
    scopeMemberVisibility: new Map(),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    functionReturnTypes: new Map(),
  } as unknown as typeof CodeGenState.symbols;
};

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new RegisterAccessAnalyzer().analyze(tree);
};

const inMain = (body: string): string => `void main() {\n${body}\n}`;

afterEach(() => {
  CodeGenState.reset();
});

describe("RegisterAccessAnalyzer", () => {
  describe("E0870 -- a write-only member is read", () => {
    it("rejects `R.CMD` in an initializer, with a real position", () => {
      symbols({ R: { CMD: "wo" } });
      const found = errors(inMain("    u32 v <- R.CMD;"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0870");
      expect(found[0].line).toBe(2);
      expect(found[0].column).toBeGreaterThan(0);
      expect(found[0].message).toContain("R.CMD has 'wo'");
    });

    it("accepts reads of rw, ro, w1c and w1s members", () => {
      // The control the rule turns on: only `wo` returns nothing when read. A
      // w1c status register is READ to see what is pending.
      symbols({ R: { A: "rw", B: "ro", C: "w1c", D: "w1s" } });
      expect(errors(inMain("    u32 v <- R.A + R.B + R.C + R.D;"))).toEqual([]);
    });

    it("rejects the scoped spellings codegen checked separately", () => {
      symbols(
        { Board__R: { CMD: "wo" } },
        { scopes: ["Board"], scoped: ["Board__R"] },
      );
      const source = [
        "scope Board {",
        "    public u32 a() { return this.R.CMD; }",
        "    public u32 b() { return R.CMD; }",
        "}",
        "u32 c() { return Board.R.CMD; }",
        "scope Other {",
        "    public u32 d() { return global.Board.R.CMD; }",
        "}",
      ].join("\n");
      const found = errors(source);
      expect(found.map((e) => e.line)).toEqual([2, 3, 5, 7]);
      expect(found[0].message).toContain("this.R.CMD");
      expect(found[3].message).toContain("global.Board.R.CMD");
    });

    it("rejects a compound assignment, which reads its target", () => {
      // REGRESSION. `R.SET +<- 1` emitted `R__SET += 1` -- a read of a
      // write-only register -- because the write path never asked.
      symbols({ R: { SET: "wo" } });
      const found = errors(inMain("    R.SET +<- 1;"));
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0870");
    });

    it("accepts a plain write to a wo member, zero included", () => {
      // `R.SET <- 0` writes the WHOLE member; a command register takes zero
      // as a value. Only the bit forms mean "clear".
      symbols({ R: { SET: "wo" } });
      expect(errors(inMain("    R.SET <- 0x42;\n    R.SET <- 0;"))).toEqual([]);
    });

    it("says nothing when a local shadows the register's name", () => {
      // E0437's case, inside a scope; here the local is what `R` means, and
      // reading its field is another rule's business.
      symbols({ R: { CMD: "wo" } });
      expect(
        errors(
          "struct S { u32 CMD; }\nvoid main() {\n    S R;\n    u32 v <- R.CMD;\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("E0871 -- a read-only member is written", () => {
    it("rejects `R.ST <- v`, a bit write, a range write and a compound", () => {
      symbols({ R: { ST: "ro" } });
      const found = errors(
        inMain(
          "    R.ST <- 1;\n    R.ST[3] <- true;\n    R.ST[0, 4] <- 5;\n    R.ST +<- 1;",
        ),
      );
      expect(found).toHaveLength(4);
      expect(new Set(found.map((e) => e.code))).toEqual(new Set(["E0871"]));
    });

    it("rejects the scoped spellings that codegen accepted", () => {
      // REGRESSION. `AssignmentValidator` keyed on the first two identifiers,
      // so `this.R.ST` looked up `this`-less `R__ST` (absent) and passed; the
      // emitted C assigned through a `volatile uint32_t const *` macro.
      symbols(
        { Board__R: { ST: "ro" } },
        { scopes: ["Board"], scoped: ["Board__R"] },
      );
      const source = [
        "scope Board {",
        "    public void a() { this.R.ST <- 1; }",
        "    public void b() { this.R.ST[3] <- true; }",
        "}",
        "void c() { Board.R.ST <- 1; }",
        "scope Other {",
        "    public void d() { global.Board.R.ST <- 1; }",
        "}",
      ].join("\n");
      expect(errors(source).map((e) => [e.code, e.line])).toEqual([
        ["E0871", 2],
        ["E0871", 3],
        ["E0871", 5],
        ["E0871", 7],
      ]);
    });

    it("accepts a read of the same member", () => {
      symbols({ R: { ST: "ro" } });
      expect(errors(inMain("    u32 v <- R.ST;"))).toEqual([]);
    });
  });

  describe("E0872 -- a zero assigned to a write-1 bit", () => {
    it("rejects `false` and `0` on a single bit, and `0` on a range", () => {
      symbols({ R: { SET: "wo" } });
      const found = errors(
        inMain(
          "    R.SET[3] <- false;\n    R.SET[3] <- 0;\n    R.SET[0, 4] <- 0;",
        ),
      );
      expect(found.map((e) => e.code)).toEqual(["E0872", "E0872", "E0872"]);
      expect(found[0].message).toContain("false to write-only register bit");
      expect(found[2].message).toContain("0 to write-only register bits");
    });

    it("rejects a zero however it is spelled", () => {
      // REGRESSION. Codegen compared the generated TEXT against "false" and
      // "0", so `0x0`, `0b0` and a const evaluating to zero were accepted and
      // emitted `R__SET = (1U << 3)` -- the bit the author meant to clear was
      // set instead.
      //
      // A const's value comes from the program's symbol table, which a unit
      // test does not build; `tests/adr-004/register-wo-set-false-error`
      // asserts the `const u32 OFF <- 0` and `const bool DOWN <- false` arms
      // end to end.
      symbols({ R: { SET: "wo" } });
      const found = errors(
        inMain("    R.SET[3] <- 0x0;\n    R.SET[3] <- 0b0;"),
      );
      expect(found.map((e) => e.line)).toEqual([2, 3]);
    });

    it("accepts true, a non-zero value, and a runtime value", () => {
      symbols({ R: { SET: "wo" } });
      expect(
        errors(
          "void main(u32 n) {\n    R.SET[3] <- true;\n    R.SET[0, 4] <- 0xF;\n    R.SET[3] <- n;\n}",
        ),
      ).toEqual([]);
    });

    it("applies to w1s and w1c bits, and not to rw ones", () => {
      // Codegen's `isWriteOnlyRegister` set: writing a zero to a write-1
      // register does nothing, whichever direction the 1 goes.
      symbols({ R: { S: "w1s", C: "w1c", D: "rw" } });
      const found = errors(
        inMain(
          "    R.S[1] <- false;\n    R.C[1] <- false;\n    R.D[1] <- false;",
        ),
      );
      expect(found.map((e) => e.line)).toEqual([2, 3]);
    });

    it("leaves a bitmap field write to the bitmap rules", () => {
      // `R.SET.FIELD <- 0` has a `.name` after the member, not a subscript;
      // codegen's bitmap path never checked zero and neither does this.
      symbols({ R: { SET: "wo" } });
      expect(errors(inMain("    R.SET.FIELD <- 0;"))).toEqual([]);
    });
  });

  it("says nothing without a symbol view", () => {
    expect(errors(inMain("    u32 v <- R.CMD;"))).toEqual([]);
  });
});
