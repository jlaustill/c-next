/**
 * #1445 box 2: no artifact a pass hands forward reaches a parse node.
 *
 * `docs/architecture/README.md` makes the AST Tier 1 with a short lifetime, and
 * rests the whole lifetime axis on one rule:
 *
 * > Pass 1.3 consumes `ParsedFile` and does not re-export it. That single rule
 * > is what makes the lifetime axis enforceable -- the tree is not reachable
 * > from any artifact a downstream pass holds, so a dependency rule is a
 * > backstop rather than the primary guard.
 *
 * `parse-tree:check` is that backstop. It counts modules that NAME a parse
 * type, which is a different property: a module is free to receive a tree,
 * walk it and drop it, and 2.1 Analyze must. What this file asserts is the
 * primary guard -- that the values passes hand each other do not CARRY one, so
 * a later pass cannot reach the tree by holding the previous pass's output.
 *
 * The violation this was written against was `IDeclaredFile`, which looked like
 * 1.3's artifact and was `{ parsed: IParsedFile; symbols: readonly TSymbol[] }`.
 * Anything holding it reached the tree in one property access. Its `symbols`
 * half had no reader at all, so the bundle existed to carry the re-export.
 *
 * ## Why this is a type walk and not a grep
 *
 * The carrier is reachability, not spelling. `IDeclaredFile` never wrote
 * `Parser.ProgramContext`; it wrote `IParsedFile`. A grep for the grammar finds
 * neither, and that is the whole failure mode -- the depcruise rule had to name
 * `IParsedFile` in its `to:` list for exactly this reason.
 */
import { describe, it, expect } from "vitest";
import {
  Project,
  type ClassDeclaration,
  type ParameterDeclaration,
  type PropertyDeclaration,
  type Type,
} from "ts-morph";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

const project = new Project({
  tsConfigFilePath: join(repoRoot, "tsconfig.json"),
});

/** A type declared by the generated grammar or by the antlr4ng runtime. */
function isParseType(type: Type): boolean {
  try {
    const symbol = type.getSymbol();
    if (!symbol) return false;
    return symbol
      .getDeclarations()
      .some((d) =>
        /CNextParser\.ts$|antlr4ng/.test(d.getSourceFile().getFilePath()),
      );
  } catch {
    return false;
  }
}

/**
 * Whether a parse node is reachable from `type` by any chain of properties,
 * generic arguments, array elements or union members.
 *
 * **The generic arguments are not optional.** `Map<string, IParsedFile>` exposes
 * `size`, `get` and `set` through `getProperties()` and never its value type, so
 * a walk over properties alone reports a clean result for the one field in this
 * repository that genuinely holds every retained tree. The first version of this
 * scan did exactly that and returned 0 for its own control.
 */
function reachesParseNode(
  type: Type,
  depth = 0,
  seen = new Set<string>(),
): boolean {
  if (depth > 5) return false;
  const key = `${type.getText().slice(0, 140)}|${depth}`;
  if (seen.has(key)) return false;
  seen.add(key);

  if (isParseType(type)) return true;

  try {
    for (const arg of type.getTypeArguments())
      if (reachesParseNode(arg, depth + 1, seen)) return true;
  } catch {
    /* not generic */
  }
  try {
    const element = type.getArrayElementType();
    if (element && reachesParseNode(element, depth + 1, seen)) return true;
  } catch {
    /* not an array */
  }
  try {
    for (const member of type.getUnionTypes())
      if (reachesParseNode(member, depth + 1, seen)) return true;
  } catch {
    /* not a union */
  }

  // What a callable HANDS BACK. This is the difference between a thunk and a
  // re-export, and it is the whole reason these artifacts are legal.
  // `IAssignmentContext` carries eight functions that close over
  // `Parser.AssignmentTargetContext` and friends, and `ICodeGenApi` takes parse
  // nodes as `unknown`; a consumer therefore RETAINS a tree for the duration of
  // a render. But every one returns `string`, `IBitAccessAnalysis`,
  // `number | undefined` -- a value, never a node -- so no later pass can
  // OBTAIN a parse node from an artifact and walk it. Retention for the length
  // of the render is the lifetime the design asks for; handing the node back is
  // what box 2 forbids, and only this check can tell the two apart.
  try {
    for (const sig of type.getCallSignatures())
      if (reachesParseNode(sig.getReturnType(), depth + 1, seen)) return true;
  } catch {
    /* not callable */
  }

  for (const prop of type.getProperties()) {
    const decl = prop.getDeclarations()[0];
    if (!decl) continue;
    try {
      if (reachesParseNode(prop.getTypeAtLocation(decl), depth + 1, seen))
        return true;
    } catch {
      /* unresolvable property */
    }
  }
  return false;
}

function namedType(file: string, name: string): Type {
  const sf = project.getSourceFileOrThrow(join(repoRoot, file));
  const decl =
    sf.getInterface(name) ?? sf.getTypeAlias(name) ?? sf.getClass(name);
  if (!decl) throw new Error(`${name} not found in ${file}`);
  return decl.getType();
}

/**
 * The values that cross a pass boundary: what a pass emits and a later pass
 * holds. A parameter a pass receives and drops is deliberately NOT here --
 * 2.1 Analyze is handed the tree and must be.
 */
const ARTIFACTS: ReadonlyArray<readonly [string, string]> = [
  ["src/transpiler/types/IFileSymbols.ts", "IFileSymbols"],
  ["src/transpiler/types/ICodeGenSymbols.ts", "ICodeGenSymbols"],
  ["src/transpiler/types/ICodeGenApi.ts", "ICodeGenApi"],
  ["src/transpiler/types/symbols/TSymbol.ts", "TSymbol"],
  ["src/PARSE/4-Resolve/Program.ts", "Program"],
  ["src/PARSE/4-Resolve/VisibleSymbols.ts", "VisibleSymbols"],
  ["src/PARSE/3-Declare/SymbolTable.ts", "SymbolTable"],
  ["src/PARSE/3-Declare/SymbolRegistry.ts", "SymbolRegistry"],
  // The two artifacts whose RUNTIME values retain a tree through closures --
  // included precisely so the return-type check above is exercised on them.
  ["src/transpiler/types/IAssignmentContext.ts", "IAssignmentContext"],
  ["src/transpiler/types/TPlannedTargetOp.ts", "TPlannedTargetOp"],
];

/** Every class field under a directory whose type reaches a parse node. */
/**
 * Every own property a class declares -- fields AND constructor parameter
 * properties.
 *
 * `constructor(private readonly file: IParsedFile) {}` declares a property
 * exactly as a field does, but the node is a `Parameter` under the
 * `Constructor`, so `getProperties()` never reaches it. This guard shipped
 * without that and was **unable to fail on the shape it was written against**:
 * adding that exact constructor to a 2-Plan module left all six assertions
 * green, and only `parse-tree:check` -- which the header above calls the
 * backstop -- caught it. That inverted the claim this file makes about itself.
 *
 * Its sibling `bitmap-field-layout.test.ts` had already recorded the same hole
 * and closed it the same way, noting that 17 non-test files declare one. Found
 * by review, not by the guard.
 *
 * `getModifiers().length` is what separates a parameter property from a plain
 * constructor parameter, which declares nothing.
 */
function declaredProperties(
  cls: ClassDeclaration,
): (PropertyDeclaration | ParameterDeclaration)[] {
  const fields: (PropertyDeclaration | ParameterDeclaration)[] = [
    ...cls.getProperties(),
  ];
  for (const ctor of cls.getConstructors())
    for (const parameter of ctor.getParameters())
      if (parameter.getModifiers().length) fields.push(parameter);
  return fields;
}

function storedParseNodes(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const sf of project.getSourceFiles()) {
    const path = sf.getFilePath();
    if (path.includes("__tests__") || !pattern.test(path)) continue;
    for (const cls of sf.getClasses())
      for (const prop of declaredProperties(cls)) {
        try {
          if (reachesParseNode(prop.getType()))
            found.push(
              `${relative(repoRoot, path)}:${prop.getStartLineNumber()} ${cls.getName()}.${prop.getName()}`,
            );
        } catch {
          /* unresolvable field */
        }
      }
  }
  return found;
}

/**
 * Each assertion walks types across the whole program, and `npm run unit` runs
 * under v8 coverage in CI, which took these from ~0.5s to 5.8-11.4s -- past
 * vitest's 5000ms default. The local gate passed because it does not instrument.
 */
const WALK_TIMEOUT_MS = 60_000;

describe("artifact lifetime (#1445 box 2)", () => {
  it(
    "the walk works at all",
    () => {
      // The control, and it is load-bearing. Every assertion below is an
      // emptiness claim, and an emptiness claim from a broken scan is
      // indistinguishable from a true one. `Transpiler.retainedParses` is
      // `Map<string, IParsedFile>` -- the one field in this repository that holds
      // every retained tree on purpose -- so the scan must see it.
      const control = storedParseNodes(/src\/transpiler\/Transpiler\.ts$/);

      expect(control.some((f) => f.includes("retainedParses"))).toBe(true);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no artifact a pass hands forward reaches a parse node",
    () => {
      const carriers = ARTIFACTS.filter(([file, name]) =>
        reachesParseNode(namedType(file, name)),
      ).map(([, name]) => name);

      expect(carriers).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no shared state holds one",
    () => {
      // `CodeGenState`, `SymbolTable` and `SymbolRegistry` outlive every pass and
      // are reachable from all of them, so a tree parked on one is the lifetime
      // violation with the longest reach available.
      expect(storedParseNodes(/src\/transpiler\/state\//)).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "pins every field outside the parser that holds a parse node",
    () => {
      // An EXHAUSTIVE roster, not an emptiness claim. Four fields legitimately
      // hold one and all are released when the run ends; asserting "none" would
      // have to exempt them, and an exemption is invisible once written. A roster
      // makes a fifth holder a failing diff.
      //
      // The pattern is ALL of `src/` minus the two directories whose emptiness
      // the other assertions here own, because a roster scoped to where the
      // holders were already known cannot find one anywhere else. It used to
      // read `src/transpiler/|src/TRANSPILE/CodeGenWalker.ts$` -- one directory
      // plus one file -- so `src/cli/` was outside it, and `ServeCommand`
      // sat unlisted under a test named "pins EVERY field outside the parser".
      // Found by review. The backstop did not cover the gap either:
      // `parse-tree-sites.md` reports modules that NAME a parse type, and
      // `ServeCommand` names none -- transitive reach is precisely what this
      // file exists to catch.
      const holders = storedParseNodes(
        /src\/(?!PARSE\/2-Parse|TRANSPILE\/1-Analyze)/,
      ).map((f) => f.replace(/:\d+ /, " "));

      expect(holders.sort()).toEqual(
        [
          // #1301: Stage 5 reuses Stage 3's parse. Cleared in a `finally`, which
          // `RetainedParseCacheRelease.test.ts` asserts and mutation-checks.
          "src/transpiler/Transpiler.ts Transpiler.codeGenerator",
          "src/transpiler/Transpiler.ts Transpiler.retainedParses",
          // The walk itself. `tokenStream` and the `CommentScanner` over it are
          // ADR-043 comment plumbing, assigned per file and released by
          // `releaseParseState()` at run end -- they used not to be, which is the
          // residency defect #1445 box 2 found and fixed.
          "src/TRANSPILE/CodeGenWalker.ts CodeGenWalker.commentExtractor",
          "src/TRANSPILE/CodeGenWalker.ts CodeGenWalker.tokenStream",
          // The longest-lived holder in the codebase, and `private static` --
          // CLAUDE.md singles it out ("`ServeCommand` holds a static transpiler
          // and serves many requests"). Not a leak: it reaches a tree only
          // through the two `Transpiler` fields above, which `Transpiler`
          // clears in a `finally`. It is here because the roster claims to be
          // exhaustive, and a holder reachable only transitively is the one
          // shape the generated `parse-tree-sites.md` backstop cannot see.
          "src/cli/serve/ServeCommand.ts ServeCommand.transpiler",
        ].sort(),
      );
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "no pass after 1.3 holds one on a field",
    () => {
      // The passes proper. 1-Analyze is excluded and that is by CONSTRUCTION, not
      // exemption: its listeners index nodes while walking, but every one is a
      // local built per traversal (`new ShiftListener(...)`) with no static
      // holder in the pass, so nothing survives the walk that created it.
      const holders = storedParseNodes(
        /src\/(PARSE\/4-Resolve|TRANSPILE\/2-Plan|TRANSPILE\/3-Render)\//,
      );

      expect(holders).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );

  it(
    "1-Analyze holds parse nodes only on per-walk instances",
    () => {
      // Its listeners index nodes while walking -- `Map<ParserRuleContext, …>` on
      // roughly two dozen fields -- and that is what analysis IS. What makes them
      // working state rather than artifacts is that none outlives its traversal,
      // so the property to assert is that no STATIC field holds one. Listing the
      // instance fields instead would pin two dozen names that churn with every
      // analyzer, and would assert nothing about lifetime.
      const statics: string[] = [];
      for (const sf of project.getSourceFiles()) {
        const path = sf.getFilePath();
        if (
          path.includes("__tests__") ||
          !/src\/TRANSPILE\/1-Analyze\//.test(path)
        )
          continue;
        for (const cls of sf.getClasses())
          for (const prop of cls.getProperties()) {
            if (!prop.isStatic()) continue;
            try {
              if (reachesParseNode(prop.getType()))
                statics.push(`${cls.getName()}.${prop.getName()}`);
            } catch {
              /* unresolvable field */
            }
          }
      }

      expect(statics).toEqual([]);
    },
    WALK_TIMEOUT_MS,
  );
});
