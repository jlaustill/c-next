/**
 * 1.4 Resolve over 1.3's artifact (#1991): the whole program, built once every
 * file is declared, with the declared files carried forward for 2.1.
 *
 * What 1.4 reads off each declared file -- whether it reaches a foreign header,
 * its C-Next includes, its target directives -- is taken here, from 1.3's
 * artifact, not handed in by the host.
 */
import type IDeclaredSources from "../3-Declare/types/IDeclaredSources";
import HeaderMacros from "./HeaderMacros";
import Program from "./Program";
import type IForeignSymbols from "./types/IForeignSymbols";
import type THeaderMacro from "../../types/THeaderMacro";
import TargetDescriptions from "./TargetDescriptions";
import type IProgramInputs from "./types/IProgramInputs";
import type IResolvedProgram from "./types/IResolvedProgram";
import type IRunTargetInputs from "./types/IRunTargetInputs";

type TResolveInputs = Omit<
  IProgramInputs,
  | "filesReachingForeignHeaders"
  | "visibility"
  | "target"
  | "cppMode"
  | "foreign"
> & {
  readonly foreign: Omit<IForeignSymbols, "macros" | "macrosUnread">;
  readonly target: Omit<IRunTargetInputs, "files" | "catalog" | "platformio">;
};

class Resolve {
  static program(
    input: IDeclaredSources,
    inputs: TResolveInputs,
  ): IResolvedProgram {
    const declared = input.declared;
    // #1688: each file's header macros, typed (ADR-024) from the macro dump
    // 1.1 took of that file's own C includes. Unread is not "no macros".
    const macros = new Map<string, ReadonlyMap<string, THeaderMacro>>();
    const macrosUnread = new Set<string>();
    for (const [path, read] of input.discovery.headerMacroDumps) {
      if (!read.complete) macrosUnread.add(path);
      if (read.dump !== null) macros.set(path, HeaderMacros.collect(read.dump));
    }
    const program = Program.build(
      declared.map((entry) => entry.fileSymbols),
      {
        ...inputs,
        foreign: { ...inputs.foreign, macros, macrosUnread },
        // #1428: 1.1's one answer, which every pass after 1.4 reads from here
        cppMode: input.discovery.cppMode,
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
          catalog: TargetDescriptions.catalog(
            input.targetCatalog.source,
            input.targetCatalog.path,
          ),
          // ADR-049's build-system rung, read once by 1.1 from the text its
          // include discovery used (#1444, owner ruling 3)
          platformio: input.discovery.anchor.platformio,
          files: declared.map((entry) => ({
            sourcePath: entry.file.path,
            directives: entry.syntax.targetDirectives,
          })),
        },
      },
    );
    return { program, sources: declared, discovery: input.discovery };
  }
}

export default Resolve;
