/**
 * 1.4 Resolve over 1.3's artifact (#1991): the whole program, built once every
 * file is declared, with the declared files carried forward for 2.1.
 *
 * What 1.4 reads off each declared file -- whether it reaches a foreign header,
 * its C-Next includes, its target directives -- is taken here, from 1.3's
 * artifact, not handed in by the host.
 */
import type IDeclaredSource from "../3-Declare/types/IDeclaredSource";
import Program from "./Program";
import type IProgramInputs from "./types/IProgramInputs";
import type IResolvedProgram from "./types/IResolvedProgram";
import type IRunTargetInputs from "./types/IRunTargetInputs";

type TResolveInputs = Omit<
  IProgramInputs,
  "filesReachingForeignHeaders" | "visibility" | "target"
> & { readonly target: Omit<IRunTargetInputs, "files"> };

class Resolve {
  static program(
    declared: readonly IDeclaredSource[],
    inputs: TResolveInputs,
  ): IResolvedProgram {
    const program = Program.build(
      declared.map((entry) => entry.fileSymbols),
      {
        ...inputs,
        // #1175: where a name nothing binds may be a macro -- discovery's
        // one answer, the same 2.1's E0427 reads
        filesReachingForeignHeaders: new Set(
          declared
            .filter((entry) => entry.file.reachesForeignHeader)
            .map((entry) => entry.fileSymbols.sourceFile),
        ),
        visibility: {
          cnextIncludesByFile: new Map(
            declared.map((entry) => [
              entry.file.path,
              entry.file.cnextIncludes,
            ]),
          ),
        },
        target: {
          ...inputs.target,
          files: declared.map((entry) => ({
            sourcePath: entry.file.path,
            directives: entry.syntax.targetDirectives,
          })),
        },
      },
    );
    return { program, sources: declared };
  }
}

export default Resolve;
