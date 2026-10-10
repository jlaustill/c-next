import type * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import CNextResolver from "../../PARSE/3-Declare/cnext/index";
import type SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import Program from "../../PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../cli/TargetCatalogFile";
import TargetResolver from "../../cli/TargetResolver";
import invariant from "../../utils/invariant";
import type CodeGenWalker from "../CodeGenWalker";
import type ITargetDescription from "../../types/ITargetDescription";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

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
 * What a test hands `generate()`, plus the mode a run's 1.1 would have settled.
 * The target may be left out: this helper then supplies the build machine's,
 * as an orchestrator that names none would.
 */
type ITestGenerateOptions = Omit<
  Parameters<CodeGenWalker["generate"]>[1],
  "targetDescription"
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
  ): ReturnType<CodeGenWalker["generate"]> {
    // ADR-049: the orchestrator always decides a target before codegen; a
    // test that does not care about one gets the build machine's.
    const targetDescription =
      options.targetDescription ??
      TargetResolver.byName("host", NodeFileSystem.instance);
    invariant(targetDescription !== undefined, "the catalog defines `host`");
    const sourcePath = options.sourcePath ?? "test.cnx";
    const state = generator.transpileState;

    const declared = CNextResolver.resolve(tree, sourcePath, registry);
    state.program = Program.build([declared], {
      symbolTable: state.symbolTable,
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
    if (state.symbolTable.getTSymbolsByFile(sourcePath).length === 0) {
      state.symbolTable.addTSymbols([
        ...state.program.symbolsInFile(sourcePath),
      ]);
    }

    return generator.generate(program, {
      ...options,
      targetDescription,
    });
  }
}

export default ProgramGeneration;
