import type * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import CNextResolver from "../../PARSE/3-Declare/cnext/index";
import type SymbolRegistry from "../../PARSE/3-Declare/SymbolRegistry";
import ModificationFacts from "../../PARSE/4-Resolve/ModificationFacts";
import CallbackCompatibility from "../../PARSE/4-Resolve/CallbackCompatibility";
import Program from "../../PARSE/4-Resolve/Program";
import TargetCatalogFile from "../../PARSE/1-Discover/TargetCatalogFile";
import TargetResolver from "../../utils/TargetResolver";
import invariant from "../../utils/invariant";
import type CodeGenWalker from "../CodeGenWalker";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";

/**
 * Generate with the whole-program artifact in place.
 *
 * #1511: pass-by-value eligibility is a whole-program fact -- is this parameter
 * modified anywhere down the call chain? -- so a generator with no `Program`
 * behind it answers "not eligible" for everything and emits pointers where the
 * real run emits values. Built from the real resolver output and through the
 * same `ModificationFacts.derive` and `CallbackCompatibility.derive` production
 * uses, so a single-file test agrees with a real run rather than approximating
 * one.
 *
 * #1668: the program also carries the run's ONE target (ADR-049), which the
 * operand typer reads for a C type's width, and it is the target the render is
 * handed -- one name settles both, as the orchestrator does. `CodeGenWalker.test`
 * and `CodeGenWalker.coverage.test` each carried a verbatim copy of this, and
 * neither gave the program a target, so the first C call the typer met threw.
 */
class ProgramGeneration {
  static generate(
    generator: CodeGenWalker,
    tree: Parser.ProgramContext,
    tokenStream: Parameters<CodeGenWalker["generate"]>[1],
    options: Parameters<CodeGenWalker["generate"]>[2],
    registry: SymbolRegistry,
  ): ReturnType<CodeGenWalker["generate"]> {
    // ADR-049: the orchestrator always decides a target before codegen; a
    // test that does not care about one gets the build machine's.
    const targetDescription =
      options?.targetDescription ??
      TargetResolver.byName("host", NodeFileSystem.instance);
    invariant(targetDescription !== undefined, "the catalog defines `host`");
    const sourcePath = options?.sourcePath ?? "test.cnx";
    const state = generator.transpileState;

    const declared = CNextResolver.resolve(tree, sourcePath, registry);
    const modifications = ModificationFacts.derive(
      [declared],
      registry,
      state.symbolTable,
    );
    // #1825: the callback map too, which this harness used to leave empty, so
    // a test wiring a function to a C callback typedef rendered the signature
    // a real run would not.
    const callbackCompatibleFunctions = CallbackCompatibility.derive(
      [declared],
      state.symbolTable,
    );
    state.program = Program.build([declared], {
      modifications,
      callbackCompatibleFunctions,
      registry,
      target: {
        option: targetDescription.name,
        catalog: TargetCatalogFile.targets(NodeFileSystem.instance),
        files: [{ sourcePath, directives: [] }],
      },
    });

    return generator.generate(tree, tokenStream, {
      ...options,
      targetDescription,
    });
  }
}

export default ProgramGeneration;
