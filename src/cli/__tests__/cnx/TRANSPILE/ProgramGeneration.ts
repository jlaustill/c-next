import ProgramLowering from "../../../../cnx/PARSE/2-Parse/ProgramLowering";
import TestSymbolTable from "../../../../cnx/TRANSPILE/__tests__/TestSymbolTable";
import type * as Parser from "../../../../cnx/PARSE/2-Parse/grammar/CNextParser";
import CNextResolver from "../../../../cnx/PARSE/3-Declare/cnext/index";
import SymbolRegistry from "../../../../cnx/PARSE/3-Declare/SymbolRegistry";
import Program from "../../../../cnx/PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../../TargetCatalogFile";
import TargetResolver from "../../../TargetResolver";
import invariant from "../../../../cnx/utils/invariant";
import CodeGenWalker from "../../../../cnx/TRANSPILE/CodeGenWalker";
import CodeGenerator from "../../../../cnx/TRANSPILE/3-Render/codegen/CodeGenerator";
import CNextSourceParser from "../../../../cnx/PARSE/2-Parse/CNextSourceParser";
import SymbolTable from "../../../../cnx/PARSE/3-Declare/SymbolTable";
import TSymbolInfoAdapter from "../../../../cnx/PARSE/3-Declare/cnext/adapters/TSymbolInfoAdapter";
import { expect } from "vitest";
import type ITargetDescription from "../../../../cnx/types/ITargetDescription";
import type IProgramSyntax from "../../../../cnx/types/syntax/IProgramSyntax";
import type IAnalyzedFile from "../../../../cnx/types/IAnalyzedFile";
import type IFilePlan from "../../../../cnx/TRANSPILE/2-Plan/types/IFilePlan";
import ValuePositions from "../../../../cnx/TRANSPILE/1-Analyze/helpers/ValuePositions";
import NodeFileSystem from "../../../../cnx/PARSE/1-Discover/NodeFileSystem";

/**
 * Generate with the whole-program artifact in place.
 *
 * #1511: pass-by-value eligibility is a whole-program fact -- is this parameter
 * modified anywhere down the call chain? -- so a generator with no `Program`
 * behind it answers "not eligible" for everything and emits pointers where the
 * real run emits values. Built from the real resolver output by the same
 * `Program.build` production uses, which derives those facts itself (#1825), so
 * a single-file test agrees with a real run rather than approximating one.
 *
 * #1668: the program also carries the run's ONE target (ADR-049), which the
 * operand typer reads for a C type's width, and it is the target the render is
 * handed -- one name settles both, as the orchestrator does. `CodeGenWalker.test`
 * and `CodeGenWalker.coverage.test` each carried a verbatim copy of this, and
 * neither gave the program a target, so the first C call the typer met threw.
 *
 * The lowered program is the one `CNextSourceParser.parse` produced, as in
 * production: 1.2 lowers once, so this helper lowers nothing itself.
 *
 * #1428: the program also carries the run's mode, which codegen reads from it
 * and from nowhere else. A test has no 1.1 to detect one, so it states it:
 * `cppMode` is required here, and nothing falls back to "C".
 */
/**
 * What a test hands `planWith()`, plus the mode a run's 1.1 would have settled.
 * The target may be left out: this helper then supplies the build machine's,
 * as an orchestrator that names none would.
 */
type ITestGenerateOptions = Omit<
  Parameters<CodeGenWalker["planWith"]>[1],
  "targetDescription" | "program"
> & {
  readonly targetDescription?: ITargetDescription;
  readonly cppMode: boolean;
};

class ProgramGeneration {
  static generate(
    generator: CodeGenWalker,
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
    options: ITestGenerateOptions,
    registry: SymbolRegistry,
  ): string {
    return generator.render(
      ProgramGeneration.plan(generator, tree, program, options, registry),
    ).code;
  }

  /** 2.2's decisions for the file, as `generate` hands them to 2.3 */
  static plan(
    generator: CodeGenWalker,
    tree: Parser.ProgramContext,
    program: IProgramSyntax,
    options: ITestGenerateOptions,
    registry: SymbolRegistry,
  ): IFilePlan {
    // ADR-049: the orchestrator always decides a target before codegen; a
    // test that does not care about one gets the build machine's.
    const targetDescription =
      options.targetDescription ??
      TargetResolver.byName("host", NodeFileSystem.instance);
    invariant(targetDescription !== undefined, "the catalog defines `host`");
    const sourcePath = options.sourcePath ?? "test.cnx";
    const state = generator["planner"].transpileState;

    const declared = CNextResolver.resolve(
      ProgramLowering.program(tree, null),
      sourcePath,
      registry,
    );
    state.program = Program.build([declared], {
      symbolTable: TestSymbolTable.of(state),
      registry,
      cppMode: options.cppMode,
      target: {
        option: targetDescription.name,
        catalog: TargetCatalogFile.targets(NodeFileSystem.instance),
        files: [{ sourcePath, directives: [] }],
      },
    });

    // #831/#1285: register the file's symbols, as Transpiler.ts does. A test
    // that passes only `symbolInfo` would otherwise leave the table empty, a
    // state the real pipeline never reaches (#1283 review: every
    // function-as-type `symbolInfo` names must resolve in the table).
    // #1991: 2.1's walk of the file, as `Analyze.run` hands it to 2.2
    const resolved = state.program;
    const analyzed: IAnalyzedFile = {
      program,
      declarationCount: program.declarations.length,
      valuePositions: ValuePositions.of(program, {
        symbols: options.symbolInfo,
        program: resolved,
        symbolTable: resolved.symbolTable(),
        reachesForeignHeader: true,
        sourceFile: sourcePath,
      }),
    };
    return generator.planWith(analyzed, {
      ...options,
      program: resolved,
      targetDescription,
    });
  }

  /** 2.2's plan for one whole C-Next source, its symbols registered as 1.3 would */
  static planSource(source: string): IFilePlan {
    const parsed = CNextSourceParser.parse(source);
    expect(parsed.parseErrors).toEqual([]);
    const registry = new SymbolRegistry();
    const declared = CNextResolver.resolve(
      ProgramLowering.program(parsed.tree, null),
      "test.cnx",
      registry,
    );
    const symbols = [
      ...Program.build([declared], { cppMode: false, registry }).symbolsInFile(
        "test.cnx",
      ),
    ];
    const symbolTable = new SymbolTable();
    symbolTable.addTSymbols(symbols);
    const host = new CodeGenerator();
    const generator = new CodeGenWalker(host);
    TestSymbolTable.install(host.state, symbolTable);
    return ProgramGeneration.plan(
      generator,
      parsed.tree,
      parsed.program,
      {
        cppMode: false,
        symbolInfo: TSymbolInfoAdapter.convert(symbols),
        sourcePath: "test.cnx",
      },
      new SymbolRegistry(),
    );
  }
}

export default ProgramGeneration;
