/**
 * One file's facts, read from where 1.1 Discover and 1.4 Resolve recorded
 * them (#1991). 2.1, 2.2 and the host all look a file up here, so each
 * lookup has one invariant.
 */
import type IFileIncludes from "../PARSE/1-Discover/types/IFileIncludes";
import type IOutputPaths from "../PARSE/1-Discover/types/IOutputPaths";
import type TDiscoveryFacts from "../PARSE/1-Discover/types/TDiscoveryFacts";
import type ICodeGenSymbols from "../types/ICodeGenSymbols";
import type IProgram from "../types/IProgram";
import invariant from "./invariant";

class FileFacts {
  /** 1.4's visible symbol view of one file */
  static symbolsFor(program: IProgram, sourcePath: string): ICodeGenSymbols {
    const symbols = program.codeGenSymbolsFor(sourcePath);
    invariant(
      symbols,
      `1.4 Resolve built every file's visible symbol view, ${sourcePath}'s included`,
    );
    return symbols;
  }

  /** What 1.1 learned about one file's includes (#1444) */
  static includesOf(
    discovery: TDiscoveryFacts,
    sourcePath: string,
  ): IFileIncludes {
    const includes = discovery.includes.get(sourcePath);
    invariant(
      includes !== undefined,
      `1.1 Discover records the includes of every file it discovers (missing ${sourcePath})`,
    );
    return includes;
  }

  /** Where 3.1 writes one file's outputs, as 1.1 named them */
  static outputsOf(
    discovery: TDiscoveryFacts,
    sourcePath: string,
  ): IOutputPaths {
    const outputs = discovery.outputs.get(sourcePath);
    invariant(
      outputs !== undefined,
      `1.1 Discover names the outputs of every file it discovers (missing ${sourcePath})`,
    );
    return outputs;
  }
}

export default FileFacts;
