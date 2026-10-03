/**
 * #1668 (C8), #1664 box 3: a name's declared type is bound where it is used,
 * never looked up in a registry the render walk writes -- asserted, not
 * remembered.
 *
 * The per-file type registry was a `Map<string, TTypeInfo>` on the render
 * state, written by declaration walks (`TypeRegistrationEngine`, the walker,
 * `FunctionContextManager`, `ArrayInitHelper`) and read by name. Its one flat
 * key space per function could not tell an inner block's `x` from its
 * sibling's, nor `global.x` from a local `x`, and a string global read as a C
 * buffer in its own file and as a scalar in the next. #1668 deleted it: every
 * read binds the declaration it means (`program.bindValue`) and projects it
 * (`DeclaredTypeInfo.of`). These arms keep it deleted, each with a
 * population control, so none can pass by matching nothing.
 *
 * `constValues` was the registry's twin (#1664 box 7): one mutable map per
 * file, seeded with every const under its bare name and written as the walk
 * passed a local const, so a local `N` in one function sized another's
 * `u8[N]`. C11 deleted it; a dimension folds with the values 1.4 settled as
 * visible where it is written. Arm D keeps it deleted.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { Project, SyntaxKind, type Type } from "ts-morph";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const project = new Project({
  tsConfigFilePath: join(repoRoot, "tsconfig.json"),
});

/** The files render and the walk it serves are made of, tests excluded */
function renderSideFiles(): string[] {
  return project
    .getSourceFiles()
    .map((f) => relative(repoRoot, f.getFilePath()))
    .filter(
      (path) =>
        !path.includes("__tests__") &&
        (path === "src/TRANSPILE/TranspileState.ts" ||
          path === "src/TRANSPILE/CodeGenWalker.ts" ||
          path.startsWith("src/TRANSPILE/3-Render/")),
    );
}

/**
 * The fewest render-side files there can be before the arms are taken to
 * have lost their target. 157 when this was written; a floor, not a reading.
 */
const RENDER_FLOOR = 100;

/** The string-keyed map types a registry could be spelled with */
const MAP_NAMES = new Set(["Map", "ReadonlyMap", "Record"]);

/** `Map<string, TTypeInfo>`, `ReadonlyMap<…>` or `Record<…>` */
function isTypeInfoMap(type: Type): boolean {
  // `Record` is an alias, so its name and arguments are the alias's
  const alias = type.getAliasSymbol();
  const name = (alias ?? type.getSymbol())?.getName();
  if (name === undefined || !MAP_NAMES.has(name)) return false;
  const [key, value] = alias
    ? type.getAliasTypeArguments()
    : type.getTypeArguments();
  return (
    key?.isString() === true &&
    value !== undefined &&
    /\bTTypeInfo\b/.test(value.getText())
  );
}

/** Every class field whose type is a type-info map, as `file:Class.field` */
function typeInfoMapFields(paths: readonly string[]): string[] {
  const found: string[] = [];
  for (const path of paths) {
    const file = project.getSourceFileOrThrow(join(repoRoot, path));
    for (const cls of file.getClasses()) {
      for (const property of cls.getProperties()) {
        if (isTypeInfoMap(property.getType())) {
          found.push(`${path}:${cls.getName()}.${property.getName()}`);
        }
      }
    }
  }
  return found;
}

/** The modules that author declarations -- 1.3 and 1.4, not the render side */
const AUTHORING = /\/(LexicalScopeCollector|LexicalFrames|VariableCollector)"/;

/** The deleted registry's API and its writers, by name */
const REGISTRY = new Set([
  "setVariableTypeInfo",
  "deleteVariableTypeInfo",
  "getVariableTypeInfo",
  "getTypeRegistryView",
  "TypeRegistrationEngine",
  "TypeRegistrationUtils",
]);

/** The deleted per-file const map and its writers, by name */
const CONST_MAP = new Set([
  "constValues",
  "registerConstValue",
  "registerGlobalConstValues",
]);

/**
 * Every IDENTIFIER in code that names one of `names`, as `file:line:name`.
 * Identifiers, not text: a doc comment recording the registry's history is
 * not a use of it.
 */
function referencesTo(
  paths: readonly string[],
  names: ReadonlySet<string>,
): string[] {
  const found: string[] = [];
  for (const path of paths) {
    const file = project.getSourceFileOrThrow(join(repoRoot, path));
    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (names.has(id.getText())) {
        found.push(`${path}:${id.getStartLineNumber()}:${id.getText()}`);
      }
    }
  }
  return found;
}

describe("declared types are bound, not registered", () => {
  // The type checker over all of src/ is built by the first `getType()`,
  // which made it a cost of whichever test asked first -- arm A, on vitest's
  // 5 s default. It ran 4.0 s there under CI coverage and timed out at 5.3 s
  // when another run shared the machine (#1850). Building it here, once, puts
  // the cost on setup, under the budget the whole-tree arm C also sets.
  beforeAll(() => {
    project.getProgram().compilerObject.getTypeChecker();
  }, 60_000);

  // #1760 review: arms A, B and D are keyed on paths. Were the render side to
  // move, each would compare [] to [] and stay green.
  it("finds the render side the arms search", () => {
    const files = renderSideFiles();
    expect(files).toContain("src/TRANSPILE/TranspileState.ts");
    expect(files).toContain("src/TRANSPILE/CodeGenWalker.ts");
    expect(
      files.filter((path) => path.startsWith("src/TRANSPILE/3-Render/")).length,
    ).toBeGreaterThan(RENDER_FLOOR);
  });

  it("arm A: no render-side class holds a Map<string, TTypeInfo>", () => {
    expect(typeInfoMapFields(renderSideFiles())).toEqual([]);
  });

  it("arm A control: the walk finds such a map where one is declared", () => {
    // A class planted in memory, so the control exercises the very walk the
    // arm runs rather than a hand-written copy of it
    const planted = project.createSourceFile(
      join(repoRoot, "src/TRANSPILE/3-Render/__planted__.ts"),
      `import type TTypeInfo from "../../types/TTypeInfo";
       export default class Planted {
         private readonly registry: Map<string, TTypeInfo> = new Map();
         private readonly view: ReadonlyMap<string, TTypeInfo> = new Map();
         private readonly record: Record<string, TTypeInfo> = {};
         private readonly counts: Map<string, number> = new Map();
       }`,
      { overwrite: true },
    );
    try {
      // The planted file must compile. An unresolved import still prints its
      // alias name, so a stale path kept the match below green on any path at
      // all: #1853 moved TTypeInfo, and `move:modules` cannot rewrite a path
      // inside a template literal (#1859 review)
      expect(planted.getPreEmitDiagnostics().map((d) => d.getCode())).toEqual(
        [],
      );
      // One per spelling, and not the map of something else
      expect(
        typeInfoMapFields(["src/TRANSPILE/3-Render/__planted__.ts"]),
      ).toEqual([
        "src/TRANSPILE/3-Render/__planted__.ts:Planted.registry",
        "src/TRANSPILE/3-Render/__planted__.ts:Planted.view",
        "src/TRANSPILE/3-Render/__planted__.ts:Planted.record",
      ]);
    } finally {
      project.removeSourceFile(planted);
    }
  });

  it("arm B: nothing render-side imports a declaration-authoring module", () => {
    const importers = renderSideFiles().filter((path) =>
      AUTHORING.test(readFileSync(join(repoRoot, path), "utf8")),
    );
    expect(importers).toEqual([]);
  });

  it("arm B control: the pattern matches an authoring import", () => {
    expect(
      AUTHORING.test(
        'import LexicalFrames from "../../PARSE/4-Resolve/LexicalFrames";',
      ),
    ).toBe(true);
  });

  // The first arm to walk every source file pays for ts-morph parsing all of
  // src/: 1.3 s alone, 13.5 s measured on a loaded machine, past vitest's
  // 5 s default -- the budget the other whole-tree script tests also set.
  it("arm C: no code in src/ names the registry, tests excluded", () => {
    const paths = project
      .getSourceFiles()
      .map((f) => relative(repoRoot, f.getFilePath()))
      .filter((path) => path.startsWith("src/") && !path.includes("__tests__"));
    expect(referencesTo(paths, REGISTRY)).toEqual([]);
  }, 60_000);

  it("arm C control: a call into the registry is found in code", () => {
    const planted = project.createSourceFile(
      join(repoRoot, "src/TRANSPILE/__planted_c__.ts"),
      `// setVariableTypeInfo in a comment is history, not a use
       export function f(state: { setVariableTypeInfo(n: string): void }) {
         state.setVariableTypeInfo("x");
       }`,
      { overwrite: true },
    );
    try {
      expect(
        referencesTo(["src/TRANSPILE/__planted_c__.ts"], REGISTRY),
      ).toEqual([
        "src/TRANSPILE/__planted_c__.ts:2:setVariableTypeInfo",
        "src/TRANSPILE/__planted_c__.ts:3:setVariableTypeInfo",
      ]);
    } finally {
      project.removeSourceFile(planted);
    }
  });

  it("arm D: nothing render-side names the per-file const map", () => {
    // Render reads const values only through `dimensionEvalOptions` (2.2),
    // which asks the program at a position; it holds and writes none
    expect(referencesTo(renderSideFiles(), CONST_MAP)).toEqual([]);
  });

  it("arm D control: a write into the const map is found in code", () => {
    const planted = project.createSourceFile(
      join(repoRoot, "src/TRANSPILE/3-Render/__planted_d__.ts"),
      `// constValues in a comment is history, not a use
       export function f(state: { constValues: Map<string, number> }) {
         state.constValues.set("N", 2);
       }`,
      { overwrite: true },
    );
    try {
      expect(
        referencesTo(["src/TRANSPILE/3-Render/__planted_d__.ts"], CONST_MAP),
      ).toEqual([
        "src/TRANSPILE/3-Render/__planted_d__.ts:2:constValues",
        "src/TRANSPILE/3-Render/__planted_d__.ts:3:constValues",
      ]);
    } finally {
      project.removeSourceFile(planted);
    }
  });
});
