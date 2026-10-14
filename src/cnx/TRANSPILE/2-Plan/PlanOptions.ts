/**
 * 2.2's options for one file, read off 2.1's artifact (#1991): the host
 * hands 2.2 what 2.1 returned and decides nothing in between.
 */
import type IAnalysis from "../1-Analyze/types/IAnalysis";
import type IAnalyzedFile from "../../types/IAnalyzedFile";
import OutputExtensions from "../../utils/OutputExtensions";
import invariant from "../../utils/invariant";
import type ICodeGeneratorOptions from "../types/ICodeGeneratorOptions";
import PublicInterface from "./PublicInterface";

class PlanOptions {
  static of(file: IAnalyzedFile, analysis: IAnalysis): ICodeGeneratorOptions {
    const program = analysis.program;
    const discovery = analysis.discovery;
    const sourcePath = file.path;
    const symbolInfo = program.codeGenSymbolsFor(sourcePath);
    invariant(
      symbolInfo,
      `1.4 Resolve built every file's visible symbol view, ${sourcePath}'s included`,
    );
    const target = program.target();
    invariant(
      target?.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    const includes = discovery.includes.get(sourcePath);
    invariant(
      includes !== undefined,
      `1.1 Discover records the includes of every file it discovers (missing ${sourcePath})`,
    );
    const outputs = discovery.outputs.get(sourcePath);
    invariant(
      outputs !== undefined,
      `1.1 Discover names the outputs of every file it discovers (missing ${sourcePath})`,
    );
    return {
      program,
      debugMode: discovery.run.debugMode,
      targetDescription: target.description,
      sourcePath,
      symbolInfo,
      sourceRelativePath: outputs.sourceRelativePath,
      cnxIncludeRewrites: includes.cnxIncludeRewrites,
      includeKinds: includes.kinds,
      // #1515: decided by the rule's owner. 1.3 Declare used to answer this,
      // which put an emission decision in the parse layer.
      hasPublicInterface: PublicInterface.existsIn(
        program.symbolTable().getTSymbolsByFile(sourcePath),
      ),
      header: {
        anchor: discovery.anchor,
        // #1428: the mode has one source, the program's
        headerExtension: OutputExtensions.forCppMode(program.cppMode()).header,
        includes: discovery.includes,
        ownIncludes: includes,
      },
    };
  }
}

export default PlanOptions;
