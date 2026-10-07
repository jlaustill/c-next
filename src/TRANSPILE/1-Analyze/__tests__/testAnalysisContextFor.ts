import CNextSourceParser from "../../../PARSE/2-Parse/CNextSourceParser";
import type * as Parser from "../../../PARSE/2-Parse/grammar/CNextParser";
import CNextResolver from "../../../PARSE/3-Declare/cnext/index";
import SymbolRegistry from "../../../PARSE/3-Declare/SymbolRegistry";
import SymbolTable from "../../../PARSE/3-Declare/SymbolTable";
import Program from "../../../PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../../cli/TargetCatalogFile";
import invariant from "../../../utils/invariant";
import type IAnalysisContext from "../types/IAnalysisContext";
import type ILexicalFrame from "../../../types/ILexicalFrame";
import NodeFileSystem from "../../../PARSE/1-Discover/NodeFileSystem";

/** Where a test's source is taken to live */
const TEST_SOURCE = "test.cnx";

/**
 * Parse, declare and resolve `source` the way the pipeline does, and return
 * 2.1's context for it (#1668, C1).
 *
 * `testAnalysisContext(state)` reads facts a test set on `TranspileState`, and
 * stands an EMPTY `Program` in for one the test never built. That was harmless
 * while every analyzer derived its own declarations from the tree. Once they
 * read them from `Program` -- the lexical frames, the bindings, the settled
 * symbols -- an empty program answers "nothing is declared", and every typing
 * test would pass by asserting silence. So this builds the real artifacts:
 *
 * - 1.2 and 1.3 on the source, 1.4 over the one file, with the file's own
 *   `#pragma target` or else `host` (ADR-049: every program has a target);
 * - the settled symbols published to a `SymbolTable`, as
 *   `Transpiler._publishResolvedFile` does, on top of any C/C++ symbols the
 *   test put in the table it passes;
 * - the per-file view from `program.codeGenSymbolsFor`, as
 *   `Transpiler._analyzeFile` reads it.
 *
 * It refuses a context whose program has no resolved target, or declares a
 * function with no lexical frame, so a test cannot run an analyzer against an
 * unfinished program.
 */
function testAnalysisContextFor(
  source: string,
  options: {
    /**
     * Other C-Next files the test source includes, path to source. Each is
     * declared as its own file, ahead of the test source, which sees them all
     * -- a cross-file fact is then a real one, not a mocked view.
     */
    helpers?: Record<string, string>;
    /** C/C++ symbols the test registered, as Stage 2 would have */
    symbolTable?: SymbolTable;
    overrides?: Partial<IAnalysisContext>;
    /**
     * #1428: the run's mode, as 1.1 would have settled it. Required: a test
     * has no 1.1, so it states its mode, and the program carries it as in a run.
     */
    cppMode: boolean;
  },
): { tree: Parser.ProgramContext; context: IAnalysisContext } {
  const registry = new SymbolRegistry();
  const files = [
    ...Object.entries(options.helpers ?? {}),
    [TEST_SOURCE, source] as const,
  ].map(([path, text]) => {
    const parsed = CNextSourceParser.parse(text);
    return {
      path,
      parsed,
      declared: CNextResolver.resolve(parsed.tree, path, registry),
    };
  });
  const main = files.at(-1)!;
  const symbolTable = options.symbolTable ?? new SymbolTable();

  const program = Program.build(
    files.map((file) => file.declared),
    {
      registry,
      cppMode: options.cppMode,
      visibility: {
        cnextIncludesByFile: new Map([
          [
            TEST_SOURCE,
            Object.keys(options.helpers ?? {}).map((path) => ({ path })),
          ],
        ]),
      },
      foreign: {
        c: symbolTable.getAllCSymbols(),
        cpp: symbolTable.getAllCppSymbols(),
        opaqueTypedefs: new Set(symbolTable.getAllOpaqueTypes()),
        typedefToTag: new Map(symbolTable.getAllTypedefToTag()),
        macros: new Map(),
        macrosUnread: new Set<string>(),
        structTagsWithBodies: new Set(symbolTable.getAllStructTagsWithBodies()),
      },
      headerStructFields: symbolTable.getAllStructFields(),
      target: {
        option: "host",
        catalog: TargetCatalogFile.targets(NodeFileSystem.instance),
        files: files.map((file) => ({
          sourcePath: file.path,
          directives: file.parsed.targetDirectives,
        })),
      },
    },
  );
  invariant(
    program.target().kind === "resolved",
    "a test's program names a known target",
  );

  for (const file of files) {
    symbolTable.addTSymbols(program.symbolsInFile(file.path));
  }

  // Every function the test declares has its lexical frame, so an analyzer
  // reading locals from Program cannot pass by finding none.
  const framed = new Set<string>();
  const collect = (frame: ILexicalFrame): void => {
    if (frame.functionCName !== null) {
      framed.add(frame.functionCName);
    }
    frame.children.forEach(collect);
  };
  collect(program.lexicalFrameAt(TEST_SOURCE, { line: 0, column: 0 }));
  for (const symbol of program.symbolsInFile(TEST_SOURCE)) {
    invariant(
      symbol.kind !== "function" || framed.has(symbol.fullyQualifiedCName),
      `function ${symbol.fullyQualifiedCName} has a lexical frame`,
    );
  }
  const symbols = program.codeGenSymbolsFor(TEST_SOURCE);
  invariant(symbols, "1.4 built this file's symbol view");

  return {
    tree: main.parsed.tree,
    context: {
      symbols,
      program,
      symbolTable,
      reachesForeignHeader: true,
      sourceFile: TEST_SOURCE,
      ...options.overrides,
    },
  };
}

export default testAnalysisContextFor;
