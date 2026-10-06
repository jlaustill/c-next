/**
 * Tests for TranspileState - centralized code generation state management
 */

import TargetResolver from "../../utils/TargetResolver";
import SymbolTable from "../../PARSE/3-Declare/SymbolTable";
import type IScopeSymbol from "../../types/symbols/IScopeSymbol";
import { describe, it, expect, beforeEach } from "vitest";
import type IProgram from "../../types/IProgram";
import DeclaredPointer from "../../utils/DeclaredPointer";
import installMockSymbols from "../../transpiler/__tests__/installMockSymbols";
import TranspileState from "../TranspileState";
import SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import ScopeUtils from "../../utils/ScopeUtils";
import Program from "../../PARSE/4-Resolve/Program";
import CNextResolver from "../../PARSE/3-Declare/cnext/index";
import parse from "../../PARSE/3-Declare/cnext/__tests__/testHelpers";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import enterScope from "../../transpiler/__tests__/enterScope";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

/** Repo root, for the source-scanning guard in `scopeTypePredicate`. */
const repoRootForGuard = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
  "..",
);

let registry = new SymbolRegistry();

beforeEach(() => {
  registry = new SymbolRegistry();
});

/**
 * #1452 box 3: register a scope AND publish the graph, because
 * `setCurrentScopeByPath` reads it off `state.program` now rather than
 * off a global registry. Both halves live here so the tests below -- which call
 * the guarded method directly on purpose -- state what they are setting up
 * rather than repeating the wiring.
 */
function registerScope(path: string): IScopeSymbol {
  const scope = registry.getOrCreateScope(path);
  state.program = Program.build([], { registry });
  return scope;
}

let state = new TranspileState();

describe("TranspileState", () => {
  beforeEach(() => {
    state = new TranspileState();
    state.symbolTable = new SymbolTable();
  });

  describe("reset()", () => {
    it("resets all state to initial values", () => {
      // Dirty ONE instance and call `reset()` on it. #1452 merged two classes
      // into this one, and for a while this test swapped in a
      // `new TranspileState()` and asserted that object's INITIALIZERS -- which
      // is true of any fresh object and says nothing about `reset()`. Under
      // that shape, deleting `currentScopePath`, `currentFunctionName` and
      // `generator` from `reset()` left the whole suite green.
      enterScope(state, "TestScope");
      state.currentFunctionName = "testFunc";
      state.indentLevel = 5;
      state.needsStdint = true;

      state.reset();

      expect(state.currentScopePath).toBe("");
      expect(state.currentFunctionName).toBeNull();
      expect(state.indentLevel).toBe(0);
      expect(state.needsStdint).toBe(false);
    });

    it("resets generator reference", () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      state.generator = {} as any;

      state.reset();

      expect(state.generator).toBeNull();
    });

    it("holds the target description it is reset with", () => {
      const target = TargetResolver.byName(
        "cortex-m7",
        NodeFileSystem.instance,
      )!;

      state.reset(target);

      expect(state.targetDescription).toBe(target);
    });
  });

  describe("Scope Member Helpers", () => {
    it("getScopeMembers returns undefined for unknown scope", () => {
      expect(state.getScopeMembers("UnknownScope")).toBeUndefined();
    });

    it("getScopeMembers returns members for known scope", () => {
      const members = new Set(["member1", "member2"]);
      state.setScopeMembers("TestScope", members);

      expect(state.getScopeMembers("TestScope")).toBe(members);
    });
  });

  describe("resolveIdentifier()", () => {
    it("returns identifier unchanged when not in a scope", () => {
      enterScope(state, null);
      expect(state.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns identifier unchanged when not a scope member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.resolveIdentifier("varName")).toBe("varName");
    });

    it("returns scoped name for scope member", () => {
      enterScope(state, "TestScope");
      state.setScopeMembers("TestScope", new Set(["member1"]));

      expect(state.resolveIdentifier("member1")).toBe("TestScope__member1");
    });
  });

  describe("Type Registration Helpers", () => {
    it("registerLocalVariable adds to localVariables", () => {
      state.registerLocalVariable("localVar");
      expect(state.localVariables.has("localVar")).toBe(true);
    });

    it("setCurrentScopeByPath resolves a DOTTED PATH to the registered scope", () => {
      // The contract is a path, not a leaf. This proves the API is chain-capable,
      // so the fix for #1304 is on the caller side: codegen can only supply a
      // leaf today because `scopeMember` admits no `scopeDeclaration`.
      const inner = registerScope("Outer.Inner");

      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.pathOf(inner)).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("setCurrentScopeByPath with a LEAF now fails loudly (#1304)", () => {
      // This test used to DOCUMENT the gap: a leaf did not fail, it minted a
      // fresh scope parented to global, and every qualification through it
      // silently lost the outer component. #1304 closes that -- the registry is
      // the authority, so a path it does not know is a broken promise about the
      // symbols pass rather than something to create here.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Inner")).toThrow();

      // The failed entry must not have left the state half-updated, and must
      // not have registered `Inner` as a side effect.
      expect(state.currentScopePath).toBe("");
      expect(registry.getScope("Inner")).toBeNull();
    });

    it("setCurrentScopeByPath still enters a scope the registry knows", () => {
      // NEGATIVE CONTROL for the guard above: it must fire only on a path the
      // registry does not hold, not on every entry. Without this the assertion
      // above would pass just as well if the method rejected everything.
      registerScope("Outer.Inner");

      expect(() => state.setCurrentScopeByPath("Outer.Inner")).not.toThrow();
      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(ScopeUtils.qualifyInScope("tick", state.currentScopePath)).toBe(
        "Outer__Inner__tick",
      );
    });

    it("registerLocalVariable leaves a non-shadowing local under its own name", () => {
      state.currentFunctionName = "Counter__test";

      state.registerLocalVariable("fresh");

      expect(state.emittedLocalName("fresh")).toBe("fresh");
    });

    it("registerLocalVariable qualifies a local that shadows a global function", () => {
      state.currentFunctionName = "Counter__test";
      state.knownFunctions.add("count");

      state.registerLocalVariable("count");

      expect(state.emittedLocalName("count")).toBe("Counter__test__count");
    });

    it("registerLocalVariable does not qualify when there is no function context", () => {
      state.currentFunctionName = null;
      state.knownFunctions.add("count");

      state.registerLocalVariable("count");

      expect(state.emittedLocalName("count")).toBe("count");
    });

    it("shadowsFileScopeSymbol ignores an enclosing local", () => {
      state.localVariables.add("outer");
      state.knownFunctions.add("outer");

      // Already local, so C block scoping already gives the right answer and
      // neither `this.` nor `global.` can name an enclosing local.
      expect(state.shadowsFileScopeSymbol("outer")).toBe(false);
    });

    it("shadowsFileScopeSymbol is false for an unknown name", () => {
      expect(state.shadowsFileScopeSymbol("nothingNamedThis")).toBe(false);
    });

    it("exitFunctionBody drops the rename map with the other locals", () => {
      state.currentFunctionName = "Counter__test";
      state.knownFunctions.add("count");
      state.registerLocalVariable("count");
      expect(state.emittedLocalName("count")).toBe("Counter__test__count");

      state.exitFunctionBody();

      // A rename surviving into the next function would rewrite an unrelated
      // local of the same name.
      expect(state.emittedLocalName("count")).toBe("count");
      expect(state.localVariables.size).toBe(0);
    });
  });

  // #1668 (C8): the "Variable Type Info API" describe stood here and is
  // deleted with the per-file type registry it tested. A name's type is its
  // binding's -- `DeclaredTypeInfo`, whose tests carry the #978 C-header and
  // #1360 dimension-slot cases this block asserted through the registry's
  // cross-file fallback.

  describe("C++ Mode Helpers", () => {
    it("getNextTempVarName returns incrementing names", () => {
      state = new TranspileState(); // Reset counter
      expect(state.getNextTempVarName()).toBe("cnx_tmp0");
      expect(state.getNextTempVarName()).toBe("cnx_tmp1");
      expect(state.getNextTempVarName()).toBe("cnx_tmp2");
    });
  });

  describe("Symbol Lookup Helpers", () => {
    it("isKnownEnum returns false without symbols", () => {
      state.symbols = null;
      expect(state.isKnownEnum("MyEnum")).toBe(false);
    });

    it("isKnownEnum returns true for known enum", () => {
      installMockSymbols(state, {
        knownEnums: new Set(["MyEnum"]),
      });

      expect(state.isKnownEnum("MyEnum")).toBe(true);
      expect(state.isKnownEnum("UnknownEnum")).toBe(false);
    });

    it("isKnownScope returns false without symbols", () => {
      state.symbols = null;
      expect(state.isKnownScope("MyScope")).toBe(false);
    });

    it("isKnownScope returns true for known scope", () => {
      installMockSymbols(state, {
        knownScopes: new Set(["MyScope"]),
      });

      expect(state.isKnownScope("MyScope")).toBe(true);
      expect(state.isKnownScope("UnknownScope")).toBe(false);
    });

    /**
     * ADR-030: the one "held through a pointer" decision, which a
     * declaration's own pointer-ness (`DeclaredPointer.of`) and 1.4's
     * parameter stamp (#1722) share. #948 and #958 each gated it with a mark
     * and a copy of the "did a body arrive" rule of their own; StructCollector
     * set both marks under one condition, so they are one mark now, resolved
     * by `OpaqueTypeResolution` (measured: the two never disagreed across the
     * 1412 fixtures). A complete type is not a handle.
     */
    it.each<[string, boolean, boolean]>([
      ["a typedef of a forward-declared struct", true, true],
      ["a complete type", false, false],
    ])(
      "isHeldThroughPointer answers for %s",
      (_label, isTypedefStruct, expected) => {
        if (isTypedefStruct) {
          state.symbolTable.markOpaqueType("Dev");
        }

        expect(state.isHeldThroughPointer("Dev")).toBe(expected);
        expect(state.isHeldThroughPointer("Dev")).toBe(
          DeclaredPointer.isHandleType("Dev", state.symbolTable),
        );
      },
    );
  });

  describe("Scope Type Qualification (ADR-057)", () => {
    it("isScopeType answers for the file being generated, from the program (#1724)", () => {
      // `declares.cnx` declares three scope types. `includer.cnx` includes it;
      // `sibling.cnx` is in the same run and does not. Codegen used to ask the
      // run-wide symbol table, which holds all three for every file -- so a
      // bare name in `sibling.cnx` qualified to a type its generated C cannot
      // see, while 1.4 had settled the header's copy the same wrong way.
      const declares = CNextResolver.resolve(
        parse(
          `scope A { public enum B { X } public struct S { u8 f; } public bitmap8 Flags { Ready, Mode[3], Reserved[4] } }`,
        ),
        "declares.cnx",
        registry,
      );
      const includer = CNextResolver.resolve(
        parse(`u32 x <- 1;`),
        "includer.cnx",
        registry,
      );
      const sibling = CNextResolver.resolve(
        parse(`u32 y <- 1;`),
        "sibling.cnx",
        registry,
      );
      state.program = Program.build([declares, includer, sibling], {
        registry,
        visibility: {
          cnextIncludesByFile: new Map([
            ["includer.cnx", [{ path: "declares.cnx" }]],
          ]),
        },
      });

      state.sourcePath = "includer.cnx";
      expect(state.isScopeType("A__B")).toBe(true);
      expect(state.isScopeType("A__S")).toBe(true);
      expect(state.isScopeType("A__Flags")).toBe(true);
      expect(state.isScopeType("A__Nope")).toBe(false);

      state.sourcePath = "sibling.cnx";
      expect(state.isScopeType("A__S")).toBe(false);
    });

    it("isScopeType returns false without a program", () => {
      state.program = null;
      state.sourcePath = "includer.cnx";
      expect(state.isScopeType("A__B")).toBe(false);
    });

    // #1452: four `qualifyScopeType` cases lived here. The method had no
    // production caller -- codegen binds the predicate through
    // `typeBindingDeps` instead -- so it is deleted along with the CLAUDE.md
    // rule that named it. The SEMANTICS stay covered on the live utility:
    // `ScopeUtils.test.ts` asserts the chain-qualified lookup, the fall-through
    // to a bare name when a scope member is not a type, and that a different
    // scope's type is not reachable bare. What is gone with them is only the
    // binding to `currentScopePath`, which `scopeTypePredicate`'s own test
    // below covers.
  });

  // #1447: the derivation moved to `Program` -- which fields a header's struct
  // has is a cross-file fact. These call `program.externalStructFields()`
  // directly, which IS the route `InitializationAnalyzer` takes
  // (`context.program.externalStructFields()`). They went through a
  // `TranspileState` wrapper that said so in a comment while having no
  // production caller left.
  describe("external struct fields, via Program", () => {
    it("returns empty map when no struct fields exist", () => {
      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();
      expect(result.size).toBe(0);
    });

    it("includes non-array fields in result", () => {
      // Manually add struct fields to the symbol table
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const pointFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      pointFields.set("x", { type: "i32" });
      pointFields.set("y", { type: "i32" });
      structFields.set("Point", pointFields);

      // Use restoreStructFields to populate the symbol table
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      expect(result.has("Point")).toBe(true);
      const fields = result.get("Point");
      expect(fields?.has("x")).toBe(true);
      expect(fields?.has("y")).toBe(true);
    });

    it("excludes array fields from result (Issue #355)", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const bufferFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      bufferFields.set("size", { type: "u32" }); // Non-array
      bufferFields.set("data", { type: "u8", arrayDimensions: [256] }); // Array

      structFields.set("Buffer", bufferFields);
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      expect(result.has("Buffer")).toBe(true);
      const fields = result.get("Buffer");
      expect(fields?.has("size")).toBe(true); // Non-array included
      expect(fields?.has("data")).toBe(false); // Array excluded
    });

    it("excludes structs with only array fields", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();
      const arrayOnlyFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      arrayOnlyFields.set("items", { type: "u8", arrayDimensions: [10] });
      arrayOnlyFields.set("values", { type: "i32", arrayDimensions: [5] });

      structFields.set("ArrayOnly", arrayOnlyFields);
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      // Struct should not be included since all fields are arrays
      expect(result.has("ArrayOnly")).toBe(false);
    });

    it("handles mixed structs correctly", () => {
      const structFields = new Map<
        string,
        Map<string, { type: string; arrayDimensions?: number[] }>
      >();

      // Struct with mixed fields
      const mixedFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      mixedFields.set("id", { type: "u32" });
      mixedFields.set("name", { type: "string", arrayDimensions: [32] });
      mixedFields.set("count", { type: "u16" });

      // Struct with only non-array
      const simpleFields = new Map<
        string,
        { type: string; arrayDimensions?: number[] }
      >();
      simpleFields.set("value", { type: "f32" });

      structFields.set("Mixed", mixedFields);
      structFields.set("Simple", simpleFields);
      state.symbolTable.restoreStructFields(structFields);

      state.program = Program.build([], {
        headerStructFields: state.symbolTable.getAllStructFields(),
      });
      const result = state.program!.externalStructFields();

      // Mixed struct should have only non-array fields
      expect(result.get("Mixed")?.size).toBe(2);
      expect(result.get("Mixed")?.has("id")).toBe(true);
      expect(result.get("Mixed")?.has("count")).toBe(true);
      expect(result.get("Mixed")?.has("name")).toBe(false);

      // Simple struct should have its field
      expect(result.get("Simple")?.has("value")).toBe(true);
    });
  });

  describe("isParameterModifiedAnywhere (#1552, #1529)", () => {
    // The one modification fact behind every auto-const decision. Two callers
    // used to answer it separately with OPPOSITE defaults on a missing entry,
    // which is how a single fact produced a `const` the prototype lacked
    // (#1529) and dropped one the prototype had (#1552). The polarity assertion
    // below is the contract, not a detail.
    const programWith = (modified: ReadonlyMap<string, ReadonlySet<string>>) =>
      ({ modifiedParameters: () => modified }) as unknown as IProgram;

    it("reads the whole-program fact when a Program is present", () => {
      state.program = programWith(new Map([["mutate", new Set(["s"])]]));
      // The per-file accumulator this used to contradict is gone (#1452), so
      // the control is structural now: there is no second source a pass could
      // come from.

      expect(state.isParameterModifiedAnywhere("mutate", "s")).toBe(true);

      state.program = null;
    });

    it("treats a function absent from the program as NOT modified", () => {
      // The polarity that matters: an absent entry means auto-const APPLIES,
      // matching what the prototype does. Reading it the other way is what made
      // an included function-as-type lose its const (#1552).
      state.program = programWith(new Map());

      expect(state.isParameterModifiedAnywhere("record", "s")).toBe(false);

      state.program = null;
    });

    it("treats a known function's unlisted parameter as NOT modified", () => {
      state.program = programWith(new Map([["partly", new Set(["written"])]]));

      expect(state.isParameterModifiedAnywhere("partly", "written")).toBe(true);
      expect(state.isParameterModifiedAnywhere("partly", "read")).toBe(false);

      state.program = null;
    });

    it("answers NOT modified when there is no Program", () => {
      // #1452 retired this test's original subject. It asserted a FALLBACK to a
      // per-file accumulator on `TranspileState` -- the one this method's own
      // docblock named as the bug in #1529 and #1552, empty while declarations
      // are walked and absent entirely for an included function. The
      // accumulator is gone, so there is no second source to fall back to and
      // the branch cannot be tested because it no longer exists.
      //
      // What remains is the polarity, which is the part that was load-bearing:
      // absent means NOT modified, so auto-const applies.
      state.program = null;

      expect(state.isParameterModifiedAnywhere("localOnly", "target")).toBe(
        false,
      );
    });
  });

  /**
   * Issue #1450 box 4: one binding, not six.
   *
   * `isScopeType` is a static that reads `this.symbolTable`, so a bare
   * reference loses its receiver. Six sites each wrote the same closure to work
   * around that. Unifying them rots silently -- every closure returns the same
   * answer, so a seventh would keep every fixture green -- which is why
   * `docs/architecture/README.md` principle 5 wants the invariant stated with a
   * gate rather than in a comment.
   *
   * The forbidden form is derived by reading `src/`, never listed, so the guard
   * cannot go stale against a file it does not know about. The first attempt at
   * the inventory this replaced grepped for the parameter name `qualifiedName`
   * and missed a site that spelled it `qn` -- matching on the RECEIVER is what
   * makes the spelling irrelevant.
   */
  /**
   * Issue #1450 box 4: `withScopePath` exists for the `finally`.
   *
   * Two sites hand-rolled the save/restore with the restore as a plain trailing
   * statement, so a throw anywhere in the body left `currentScopePath` pointing
   * at the wrong scope. That is the same defect #872 extracted
   * `withExpectedType` to fix -- its doc says "add exception safety" -- and
   * scope path never got the same treatment.
   *
   * The happy path is already covered by 1247 fixtures; it is the THROWING path
   * that had no coverage and is the entire reason the helper exists, so that is
   * what this pins. Mutation: replacing the `finally` with a trailing
   * assignment reddens exactly this test.
   */
  describe("withScopePath", () => {
    it("restores the previous scope path when fn throws", () => {
      // #1304 landed while this branch was open: the registry is now the
      // authority on which scopes exist, so both paths must be registered
      // before they can be entered. `enterScope` is main's helper for exactly
      // this; `Inner` is registered directly because `withScopePath` is what
      // enters it.
      enterScope(state, "Outer");
      registerScope("Inner");
      const before = state.currentScopePath;

      expect(() =>
        state.withScopePath("Inner", () => {
          expect(state.currentScopePath).toBe("Inner");
          throw new Error("boom");
        }),
      ).toThrow("boom");

      expect(state.currentScopePath).toBe(before);
    });

    it("restores the previous scope path on the ordinary path too", () => {
      // #1304 landed while this branch was open: the registry is now the
      // authority on which scopes exist, so both paths must be registered
      // before they can be entered. `enterScope` is main's helper for exactly
      // this; `Inner` is registered directly because `withScopePath` is what
      // enters it.
      enterScope(state, "Outer");
      registerScope("Inner");
      const before = state.currentScopePath;

      const seen = state.withScopePath("Inner", () => state.currentScopePath);

      expect(seen).toBe("Inner");
      expect(state.currentScopePath).toBe(before);
    });
  });

  describe("scopeTypePredicate", () => {
    it("survives being passed unbound, which is why it exists", () => {
      const predicate: (name: string) => boolean = state.scopeTypePredicate;

      expect(() => predicate("NoSuchType")).not.toThrow();
      expect(predicate("NoSuchType")).toBe(false);
    });

    it("is the only closure in src/ that binds state.isScopeType", () => {
      // #1452: the module that owns the predicate. The path recorded here was
      // `src/transpiler/state/state.ts`, which has never existed, so the
      // exclusion covered no file -- it passed only because the owner spells
      // the call `this.isScopeType(` and the pattern looked for the class name.
      // Pointed at the real file so the exclusion means what it says.
      const owner = join("src", "TRANSPILE", "TranspileState.ts");

      // Matches the RECEIVER, not the class. The pattern was
      // `/TranspileState\s*\.\s*isScopeType\s*\(/` -- the static-call spelling,
      // which stopped existing the moment box 4 made the class an instance.
      // Every way a site can actually re-bind the predicate today spells it
      // `state.isScopeType(`, `ctx.state.isScopeType(` or
      // `this.host.state.isScopeType(`, and the class-name pattern matched none
      // of them: a seventh duplicate closure was added as a probe and this
      // assertion stayed green. Mutation-checked in both directions -- see the
      // control below, which is what makes the new pattern's reach checkable
      // rather than asserted.
      const binds = /\.\s*isScopeType\s*\(/;

      // POPULATION CONTROL for `binds`. An emptiness claim over a pattern that
      // matches nothing is the failure this assertion just had, so prove the
      // pattern fires on the shape it forbids before trusting that it found
      // none. `state.` is the spelling five call sites used before
      // `typeBindingDeps()` collapsed them.
      expect(
        binds.test("const dup = (n: string) => state.isScopeType(n);"),
      ).toBe(true);

      const walk = (dir: string): string[] =>
        readdirSync(dir).flatMap((entry) => {
          const full = join(dir, entry);
          return statSync(full).isDirectory()
            ? walk(full)
            : entry.endsWith(".ts")
              ? [full]
              : [];
        });

      // Comments are stripped first. `NameExistence` explains at length why
      // `state.isScopeType()` cannot serve its purpose, and a guard that
      // forbade naming the method in prose would forbid exactly the
      // documentation that keeps the next person from reaching for it.
      const code = (source: string): string =>
        source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");

      const offenders = walk(join(repoRootForGuard, "src"))
        .map((file) => relative(repoRootForGuard, file))
        .filter((file) => file !== owner && !file.includes("__tests__"))
        .filter((file) =>
          binds.test(code(readFileSync(join(repoRootForGuard, file), "utf8"))),
        );

      expect(offenders).toEqual([]);
    });
  });

  /**
   * #1295 and #1304 are two halves of ONE decision: a scope's identity is its
   * `cnxScopedName`, and the producer (`TSymbolInfoAdapter.processScope`, which
   * keys `scopeMembers` by it) and the reader (`currentScopePath`) must name the
   * same scope OBJECT.
   *
   * They agree by construction rather than by coincidence, because
   * `setCurrentScopeByPath` does not store its argument -- it reads the path back
   * off the registered scope. The single way to break that is for the registry to
   * hand back a different scope than the producer keyed from, which is exactly
   * what `getOrCreateScope` did when handed a leaf: it minted a fresh orphan
   * parented to global, and the producer's key then missed in silence.
   *
   * These tests drive the READERS. The `TSymbolInfoAdapter` block covers the
   * producer; before this, re-inlining `ScopeUtils.leafOf` at any reader site
   * left the whole suite green.
   */
  describe("scope identity comes from the registry, not the caller's string (#1295, #1304)", () => {
    beforeEach(() => {
      state = new TranspileState();
    });

    it("resolves a member through the whole path when the scope is registered", () => {
      registerScope("Outer.Inner");
      state.setScopeMembers("Outer.Inner", new Set(["token"]));

      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.currentScopePath).toBe("Outer.Inner");
      expect(state.resolveIdentifier("token")).toBe("Outer__Inner__token");
    });

    /**
     * NEGATIVE CONTROL for the case above. Without it the assertions would pass
     * just as well if every name were qualified.
     */
    it("leaves a name that is not a member unqualified", () => {
      registerScope("Outer.Inner");
      state.setScopeMembers("Outer.Inner", new Set(["token"]));
      state.setCurrentScopeByPath("Outer.Inner");

      expect(state.resolveIdentifier("hidden")).toBe("hidden");
    });
  });
});
