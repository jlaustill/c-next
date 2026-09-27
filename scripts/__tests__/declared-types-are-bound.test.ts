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
 * (`DeclaredTypeInfo.of`). These three arms keep it deleted, each with a
 * population control, so none can pass by matching nothing.
 *
 * `constValues` is the registry's twin and is deleted by C11; its arms join
 * these then.
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

/** `Map<string, TTypeInfo>`, however it is spelled */
function isTypeInfoMap(type: Type): boolean {
  if (type.getSymbol()?.getName() !== "Map") return false;
  const [key, value] = type.getTypeArguments();
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

/**
 * Every IDENTIFIER in code that names the registry, as `file:line:name`.
 * Identifiers, not text: a doc comment recording the registry's history is
 * not a use of it.
 */
function registryReferences(paths: readonly string[]): string[] {
  const found: string[] = [];
  for (const path of paths) {
    const file = project.getSourceFileOrThrow(join(repoRoot, path));
    for (const id of file.getDescendantsOfKind(SyntaxKind.Identifier)) {
      if (REGISTRY.has(id.getText())) {
        found.push(`${path}:${id.getStartLineNumber()}:${id.getText()}`);
      }
    }
  }
  return found;
}

describe("declared types are bound, not registered", () => {
  it("arm A: no render-side class holds a Map<string, TTypeInfo>", () => {
    expect(typeInfoMapFields(renderSideFiles())).toEqual([]);
  });

  it("arm A control: the walk finds such a map where one is declared", () => {
    // A class planted in memory, so the control exercises the very walk the
    // arm runs rather than a hand-written copy of it
    const planted = project.createSourceFile(
      join(repoRoot, "src/TRANSPILE/3-Render/__planted__.ts"),
      `import type TTypeInfo from "../../transpiler/types/TTypeInfo";
       export default class Planted {
         private readonly registry: Map<string, TTypeInfo> = new Map();
       }`,
      { overwrite: true },
    );
    try {
      expect(
        typeInfoMapFields(["src/TRANSPILE/3-Render/__planted__.ts"]),
      ).toEqual(["src/TRANSPILE/3-Render/__planted__.ts:Planted.registry"]);
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

  it("arm C: no code in src/ names the registry, tests excluded", () => {
    const paths = project
      .getSourceFiles()
      .map((f) => relative(repoRoot, f.getFilePath()))
      .filter((path) => path.startsWith("src/") && !path.includes("__tests__"));
    expect(registryReferences(paths)).toEqual([]);
  });

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
      expect(registryReferences(["src/TRANSPILE/__planted_c__.ts"])).toEqual([
        "src/TRANSPILE/__planted_c__.ts:2:setVariableTypeInfo",
        "src/TRANSPILE/__planted_c__.ts:3:setVariableTypeInfo",
      ]);
    } finally {
      project.removeSourceFile(planted);
    }
  });
});
