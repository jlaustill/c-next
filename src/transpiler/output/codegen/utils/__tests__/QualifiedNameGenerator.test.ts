/**
 * Tests for QualifiedNameGenerator
 *
 * QualifiedNameGenerator is the ONLY place that constructs transpiled C names
 * like "Test__fillData" from function symbols.
 */
import { describe, it, expect, beforeEach } from "vitest";
import QualifiedNameGenerator from "../QualifiedNameGenerator";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import FunctionUtils from "../../../../../tests/utils/FunctionUtils";
import TTypeUtils from "../../../../../utils/TTypeUtils";
import TestSourceSpan from "../../../../types/__testUtils__/testSourceSpan";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

/** Repo root, for the source-scanning guard below. */
const repoRoot = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
  "..",
  "..",
  "..",
);

describe("QualifiedNameGenerator", () => {
  beforeEach(() => {
    SymbolRegistry.reset();
  });

  describe("forFunction", () => {
    it("returns bare name for global scope function", () => {
      const func = FunctionUtils.create({
        name: "main",
        scopePath: "",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("i32"),
        visibility: "public",
        sourceFile: "main.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("main");
    });

    it("returns Scope_name for scoped function", () => {
      SymbolRegistry.getOrCreateScope("Test");
      const func = FunctionUtils.create({
        name: "fillData",
        scopePath: "Test",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe("Test__fillData");
    });

    it("returns Outer_Inner_name for nested scope function", () => {
      SymbolRegistry.getOrCreateScope("Outer.Inner");
      const func = FunctionUtils.create({
        name: "deepFunc",
        scopePath: "Outer.Inner",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "private",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "Outer__Inner__deepFunc",
      );
    });

    it("returns deeply nested path for 3-level scope", () => {
      SymbolRegistry.getOrCreateScope("A.B.C");
      const func = FunctionUtils.create({
        name: "veryDeep",
        scopePath: "A.B.C",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "test.cnx",
        span: TestSourceSpan.at(1),
      });

      expect(QualifiedNameGenerator.forFunction(func)).toBe(
        "A__B__C__veryDeep",
      );
    });
  });

  // #1298 removed the `getScopePath` suite with the delegate it tested. It
  // asserted that a chain walk recovered ["Outer","Middle","Inner"] from a scope
  // object; a scope now carries that path as a field, so the property belongs to
  // construction and is asserted in ScopeUtils.test.ts ("createScope" and
  // "no scope cycle is representable").

  describe("forFunctionInScope", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forFunctionInScope("", "main")).toBe(
        "main",
      );
    });

    it("returns transpiled C name for a simple scope", () => {
      SymbolRegistry.getOrCreateScope("Test");
      expect(
        QualifiedNameGenerator.forFunctionInScope("Test", "fillData"),
      ).toBe("Test__fillData");
    });

    it("keeps every outer component for a nested scope", () => {
      // #1285: the leaf-name signature this replaced dropped the outer scope, so
      // this returned `Inner__func`. #1298 makes the parameter a string again --
      // but the whole PATH, which carries the chain the scope object used to.
      SymbolRegistry.getOrCreateScope("Outer.Inner");

      expect(
        QualifiedNameGenerator.forFunctionInScope("Outer.Inner", "func"),
      ).toBe("Outer__Inner__func");
    });

    it("uses SymbolRegistry when function is registered", () => {
      const func = FunctionUtils.create({
        name: "init",
        scopePath: "Motor",
        parameters: [],
        returnType: TTypeUtils.createPrimitive("void"),
        visibility: "public",
        sourceFile: "motor.cnx",
        span: TestSourceSpan.at(1),
      });
      SymbolRegistry.registerFunction(func);

      expect(QualifiedNameGenerator.forFunctionInScope("Motor", "init")).toBe(
        "Motor__init",
      );
    });

    it("falls back to qualifying the bare name when not in the registry", () => {
      SymbolRegistry.getOrCreateScope("Unknown");

      expect(QualifiedNameGenerator.forFunctionInScope("Unknown", "func")).toBe(
        "Unknown__func",
      );
    });
  });

  describe("forMember", () => {
    it("returns bare name for a null scope", () => {
      expect(QualifiedNameGenerator.forMember("", "value")).toBe("value");
    });

    it("returns transpiled C name for a simple scope", () => {
      SymbolRegistry.getOrCreateScope("Test");
      expect(QualifiedNameGenerator.forMember("Test", "counter")).toBe(
        "Test__counter",
      );
    });

    it("keeps every outer component for a nested scope", () => {
      // The member counterpart of the guard above.
      SymbolRegistry.getOrCreateScope("OuterData");
      expect(
        QualifiedNameGenerator.forMember("OuterData.InnerData", "data"),
      ).toBe("OuterData__InnerData__data");
    });
  });

  /**
   * Issue #1450: the canonical spelling is asserted, not just documented.
   *
   * `forMember(scopePath, name)` and `ScopeUtils.qualifyInScope(name, scopePath)`
   * are one operation with two public names and OPPOSITE argument orders.
   * `QualifiedNameGenerator`'s own doc calls this one "the canonical spelling for
   * `output/`" and names the hazard: "two spellings of one decision sixty lines
   * apart in a file is how a silently inverted call gets written by the next
   * person editing nearby (#1357 review)".
   *
   * That was stated and not enforced -- 14 call sites in `output/` still used the
   * other spelling, against 18 that used this one, so the rule was being followed
   * about half the time. A rule nothing checks is the shape
   * `docs/architecture/README.md` principle 5 forbids: "an invariant without a
   * gate does not count."
   *
   * `logic/` and the analysis passes cannot import from `output/`, so
   * `qualifyInScope` stays their door and is deliberately not banned outright --
   * only inside `output/`, and only outside the one module that delegates to it.
   */
  describe("is the only scope-qualification door in output/", () => {
    const OWNER = join(
      "src",
      "transpiler",
      "output",
      "codegen",
      "utils",
      "QualifiedNameGenerator.ts",
    );

    /** `qualifyInScope` CALLED -- not merely named in prose. */
    const CALLS = /ScopeUtils\s*\.\s*qualifyInScope\s*\(/;

    const walk = (dir: string): string[] =>
      readdirSync(dir).flatMap((entry) => {
        const full = join(dir, entry);
        return statSync(full).isDirectory()
          ? walk(full)
          : entry.endsWith(".ts")
            ? [full]
            : [];
      });

    it("finds the population at all", () => {
      // Guards the selector: if the regex stops matching, the assertion below
      // passes over an empty list and proves nothing.
      const anywhere = walk(join(repoRoot, "src")).filter((file) =>
        CALLS.test(readFileSync(file, "utf-8")),
      );
      expect(anywhere.length).toBeGreaterThan(0);
    });

    it("has no other caller inside output/", () => {
      const offenders = walk(join(repoRoot, "src", "transpiler", "output"))
        .map((file) => relative(repoRoot, file))
        .filter((file) => file !== OWNER && !file.includes("__tests__"))
        .filter((file) =>
          CALLS.test(readFileSync(join(repoRoot, file), "utf-8")),
        );

      expect(offenders).toEqual([]);
    });
  });
});
