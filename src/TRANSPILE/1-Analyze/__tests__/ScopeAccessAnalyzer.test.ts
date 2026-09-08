import { afterEach, describe, expect, it } from "vitest";

import CNextSourceParser from "../../../transpiler/logic/parser/CNextSourceParser";
import CodeGenState from "../../../transpiler/state/CodeGenState";
import ScopeAccessAnalyzer from "../ScopeAccessAnalyzer";

/**
 * #1322. ADR-016's scope-access rules -- E0435 (own scope by name), E0436
 * (private from outside), E0437 (a shadowed global reached bare) -- replacing
 * six throws across three codegen files, two of which decided the same rule
 * separately.
 *
 * The rules read the per-file symbol view, so the tests set it directly and
 * `reset()` runs after each (CLAUDE.md, analyzer test isolation).
 */
type Vis = "public" | "private";
const symbols = (opts: {
  scopes?: Record<string, Record<string, Vis>>;
  enums?: string[];
  registers?: string[];
}): void => {
  const scopes = opts.scopes ?? {};
  CodeGenState.symbols = {
    knownScopes: new Set(Object.keys(scopes)),
    knownEnums: new Set(opts.enums ?? []),
    knownRegisters: new Set(opts.registers ?? []),
    knownStructs: new Set<string>(),
    knownBitmaps: new Set<string>(),
    scopedRegisters: new Map<string, string>(),
    scopeMembers: new Map(
      Object.entries(scopes).map(([s, m]) => [s, new Set(Object.keys(m))]),
    ),
    scopeMemberVisibility: new Map(
      Object.entries(scopes).map(([s, m]) => [s, new Map(Object.entries(m))]),
    ),
    structFields: new Map(),
    structFieldDimensions: new Map(),
    functionReturnTypes: new Map(),
  } as unknown as typeof CodeGenState.symbols;
};

const errors = (source: string) => {
  const { tree } = CNextSourceParser.parse(source);
  return new ScopeAccessAnalyzer().analyze(tree);
};

afterEach(() => {
  CodeGenState.reset();
});

describe("ScopeAccessAnalyzer", () => {
  describe("E0435 -- own scope by name", () => {
    it("rejects `Counter.value` inside Counter, with a real position", () => {
      symbols({ scopes: { Counter: { value: "private" } } });
      const found = errors(
        "scope Counter {\n    i32 value <- 1;\n    void t() {\n        Counter.value <- 5;\n    }\n}",
      );
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe("E0435");
      expect(found[0].line).toBe(4);
      expect(found[0].column).toBeGreaterThan(0);
    });

    it("rejects it as a TYPE too -- `M.T t;` inside M", () => {
      symbols({ scopes: { M: { T: "public" } } });
      expect(
        errors(
          "scope M {\n    public struct T { u32 x; }\n    public void go() {\n        M.T t;\n    }\n}",
        )[0].code,
      ).toBe("E0435");
    });

    it("accepts `this.` and the deliberate `global.Scope.member`", () => {
      symbols({ scopes: { C: { v: "private" } } });
      expect(
        errors(
          "scope C {\n    u32 v <- 1;\n    public u32 a() { return this.v; }\n    public u32 b() { return global.C.v; }\n}",
        ),
      ).toEqual([]);
    });
  });

  describe("E0436 -- private from outside", () => {
    it("rejects from file scope and from another scope, and says which", () => {
      symbols({ scopes: { A: { v: "private" }, B: {} } });
      const [outside] = errors(
        "scope A {\n    u32 v <- 1;\n}\nu32 main() { return A.v; }",
      );
      expect(outside.code).toBe("E0436");
      expect(outside.message).toContain("from outside the scope");
      const [other] = errors(
        "scope A {\n    u32 v <- 1;\n}\nscope B {\n    public u32 g() { return A.v; }\n}",
      );
      expect(other.message).toContain("from scope 'B'");
    });

    it("rejects it through `global.` as well -- qualification is not permission", () => {
      symbols({ scopes: { A: { v: "private" } } });
      expect(
        errors(
          "scope A {\n    u32 v <- 1;\n}\nu32 main() { return global.A.v; }",
        )[0].code,
      ).toBe("E0436");
    });

    it("rejects a private TYPE", () => {
      symbols({ scopes: { Internal: { Secret: "private" } } });
      expect(
        errors(
          "scope Internal {\n    private struct Secret { u32 v; }\n}\nvoid main() {\n    Internal.Secret s;\n}",
        )[0].code,
      ).toBe("E0436");
    });

    it("accepts a public member from outside", () => {
      symbols({ scopes: { A: { v: "public" } } });
      expect(
        errors(
          "scope A {\n    public u32 v <- 1;\n}\nu32 main() { return A.v; }",
        ),
      ).toEqual([]);
    });
  });

  describe("E0437 -- a shadowed global reached bare", () => {
    it("rejects an enum shadowed by a scope member, and names the shadow", () => {
      symbols({ scopes: { T: { EColor: "private" } }, enums: ["EColor"] });
      const [found] = errors(
        "enum EColor { RED }\nscope T {\n    u32 EColor <- 1;\n    public u32 g() { return EColor.RED; }\n}",
      );
      expect(found.code).toBe("E0437");
      expect(found.message).toContain("scope member 'EColor' shadows");
    });

    it("rejects a register shadowed by a LOCAL variable", () => {
      symbols({ scopes: { M: {} }, registers: ["GPIO"] });
      const [found] = errors(
        "scope M {\n    void t() {\n        u32 GPIO <- 1;\n        GPIO.DR <- 1;\n    }\n}",
      );
      expect(found.code).toBe("E0437");
      expect(found.message).toContain("local variable");
    });

    it("accepts the same enum where nothing shadows it, and via `global.`", () => {
      symbols({ scopes: { M: {} }, enums: ["EColor"] });
      expect(
        errors(
          "enum EColor { RED }\nscope M {\n    public u32 g() { return EColor.RED; }\n}",
        ),
      ).toEqual([]);
      symbols({ scopes: { M: { EColor: "private" } }, enums: ["EColor"] });
      expect(
        errors(
          "enum EColor { RED }\nscope M {\n    u32 EColor <- 1;\n    public u32 g() { return global.EColor.RED; }\n}",
        ),
      ).toEqual([]);
    });

    it("says nothing at file scope -- a shadow outside a scope is codegen's concern, as before", () => {
      symbols({ registers: ["GPIO"] });
      expect(
        errors(
          "u32 main() {\n    u32 GPIO <- 1;\n    GPIO.DR <- 1;\n    return 0;\n}",
        ),
      ).toEqual([]);
    });
  });
});
