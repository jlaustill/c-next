/**
 * #1659: a fact reaches a step through one channel -- asserted, not remembered.
 *
 * 2.1's analyzers receive their facts on `IAnalysisContext` (#1456), and that
 * context carries the symbol table. `runAnalyzers` used to hand four analyzers
 * the same table a second time as an `analyze` argument, so each one held two
 * routes to one fact and nothing said they had to agree. 2.2's
 * `AssignmentClassifier` did the same with 2.3's `TranspileState`: every
 * method took the `IAssignmentContext` that carries it, and the state again
 * beside it.
 *
 * Each arm has a population control, so none can pass by matching nothing.
 */
import { beforeAll, describe, it, expect } from "vitest";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  type ClassDeclaration,
  Node,
  Project,
  type ParameterDeclaration,
  type SourceFile,
} from "ts-morph";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const project = new Project({
  tsConfigFilePath: join(repoRoot, "tsconfig.json"),
});

function sourceFiles(prefix: string): SourceFile[] {
  return project.getSourceFiles().filter((f) => {
    const path = relative(repoRoot, f.getFilePath());
    return path.startsWith(prefix) && !path.includes("__tests__");
  });
}

/** The declared type's name; an optional parameter's `| undefined` is not a second type */
function typeName(node: Node): string | undefined {
  const type = node.getType().getNonNullableType();
  return (type.getAliasSymbol() ?? type.getSymbol())?.getName();
}

/** The types an instance member can read through `this` */
const classMemberTypes = new Map<ClassDeclaration, (string | undefined)[]>();
function membersOf(cls: ClassDeclaration): (string | undefined)[] {
  let members = classMemberTypes.get(cls);
  if (!members) {
    members = cls
      .getProperties()
      .map(typeName)
      .concat(
        cls.getConstructors().flatMap((c) =>
          c
            .getParameters()
            .filter((p) => p.isParameterProperty())
            .map(typeName),
        ),
      );
    classMemberTypes.set(cls, members);
  }
  return members;
}

interface IFunctionSite {
  where: string;
  params: (string | undefined)[];
  classMembers: (string | undefined)[];
}

/** Every function-like declaration with the parameters it takes */
function functionsIn(files: SourceFile[]): IFunctionSite[] {
  return files.flatMap((file) =>
    file
      .getDescendants()
      .filter(
        (node) =>
          Node.isFunctionDeclaration(node) ||
          Node.isMethodDeclaration(node) ||
          Node.isConstructorDeclaration(node) ||
          Node.isArrowFunction(node) ||
          Node.isFunctionExpression(node),
      )
      .map((node) => {
        const fn = node as Node & {
          getParameters(): ParameterDeclaration[];
        };
        // Only an instance method or constructor reaches the instance's
        // members; a static helper or a callback reaches only what it is given
        const reachesInstance =
          (Node.isMethodDeclaration(node) && !node.isStatic()) ||
          Node.isConstructorDeclaration(node);
        const cls = reachesInstance
          ? node.getFirstAncestor(Node.isClassDeclaration)
          : undefined;
        return {
          where: `${relative(repoRoot, file.getFilePath())}:${node.getStartLineNumber()}`,
          params: fn.getParameters().map(typeName),
          classMembers: cls ? membersOf(cls) : [],
        };
      }),
  );
}

describe("one channel per fact (#1659)", () => {
  // One type-checked scan of the pipeline, shared by every arm
  let pipeline: IFunctionSite[] = [];
  const under = (prefix: string) =>
    pipeline.filter((fn) => fn.where.startsWith(prefix));
  beforeAll(() => {
    pipeline = functionsIn(sourceFiles("src/TRANSPILE/"));
  }, 120_000);

  it("2.1: nothing that can reach an IAnalysisContext also takes a SymbolTable", () => {
    const reachesContext = under("src/TRANSPILE/1-Analyze/").filter(
      (fn) =>
        fn.params.includes("IAnalysisContext") ||
        fn.classMembers.includes("IAnalysisContext"),
    );
    // Population control: 330 when this was written; a floor, not a reading
    expect(reachesContext.length).toBeGreaterThan(200);

    const twoRoutes = reachesContext
      .filter((fn) => fn.params.includes("SymbolTable"))
      .map((fn) => fn.where);
    expect(twoRoutes).toEqual([]);
  });

  it("2.2: nothing that takes an IAssignmentContext also takes a TranspileState", () => {
    const takesCtx = pipeline.filter((fn) =>
      fn.params.includes("IAssignmentContext"),
    );
    // Population control: 61 when this was written
    expect(takesCtx.length).toBeGreaterThan(40);

    const twoRoutes = takesCtx
      .filter((fn) => fn.params.includes("TranspileState"))
      .map((fn) => fn.where);
    expect(twoRoutes).toEqual([]);
  });

  it("2.2: AssignmentClassifier reaches TranspileState only through ctx", () => {
    const classifier = under("src/TRANSPILE/2-Plan/AssignmentClassifier.ts:");
    // Population control: 29 when this was written
    expect(classifier.length).toBeGreaterThan(20);

    const takesState = classifier
      .filter((fn) => fn.params.includes("TranspileState"))
      .map((fn) => fn.where);
    expect(takesState).toEqual([]);
  });
});
