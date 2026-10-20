/**
 * 2.2's options for one file, read off 2.1's artifact (#1991): the host
 * hands 2.2 what 2.1 returned and decides nothing in between.
 */
import type IAnalysis from "../1-Analyze/types/IAnalysis";
import invariant from "../../utils/invariant";
import FileFacts from "../../utils/FileFacts";
import type ICodeGeneratorOptions from "../types/ICodeGeneratorOptions";
import PublicInterface from "./PublicInterface";

class PlanOptions {
  static of(sourcePath: string, analysis: IAnalysis): ICodeGeneratorOptions {
    const program = analysis.program;
    const discovery = analysis.discovery;
    const symbolInfo = FileFacts.symbolsFor(program, sourcePath);
    const target = program.target();
    invariant(
      target.kind === "resolved",
      "Stage 3b halts a run whose target did not resolve",
    );
    const includes = FileFacts.includesOf(discovery, sourcePath);
    const outputs = FileFacts.outputsOf(discovery, sourcePath);
    return {
      program,
      debugMode: discovery.run.debugMode,
      targetDescription: target.description,
      sourcePath,
      symbolInfo,
      selfInclude: outputs.selfInclude,
      cnxIncludeRewrites: includes.cnxIncludeRewrites,
      includeKinds: includes.kinds,
      // #1515: decided by the rule's owner. 1.3 Declare used to answer this,
      // which put an emission decision in the parse layer.
      hasPublicInterface: PublicInterface.existsIn(
        program.symbolTable().getTSymbolsByFile(sourcePath),
      ),
      header: {
        anchor: discovery.anchor,
        includes: discovery.includes,
        ownIncludes: includes,
      },
    };
  }
}

export default PlanOptions;
