/**
 * 1.4 Resolve over 1.3's artifact (#1991): the whole program, built once every
 * file is declared, with the declared files carried forward for 2.1.
 *
 * What 1.4 reads off each declared file -- whether it reaches a foreign header,
 * its cnx includes, its target directives -- is taken here, from 1.3's
 * artifact, not handed in by the host.
 */
import type IDeclaredSources from "../3-Declare/types/IDeclaredSources";
import HeaderMacros from "./HeaderMacros";
import Program from "./Program";
import type THeaderMacro from "../../types/THeaderMacro";
import type IResolvedProgram from "./types/IResolvedProgram";

class Resolve {
  static program(input: IDeclaredSources): IResolvedProgram {
    const declared = input.declared;
    const table = input.symbolTable;
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
        // #1511: everything the C/C++ headers contributed, from 1.3's table.
        // The opacity inputs are the raw bookkeeping, not the verdict --
        // `Program` resolves which typedefs never received a body. #985's
        // phantom-body recovery ran in 1.3, so the state is final: a struct
        // known only through it has its fields here, and a read before 1.3
        // would drop it from `externalStructFields`, exempting it from
        // ADR-016's init-completeness check, the fact's one consumer.
        headerStructFields: table.getAllStructFields(),
        foreign: {
          c: table.getAllCSymbols(),
          cpp: table.getAllCppSymbols(),
          opaqueTypedefs: new Set(table.getAllOpaqueTypes()),
          typedefToTag: new Map(table.getAllTypedefToTag()),
          structTagsWithBodies: new Set(table.getAllStructTagsWithBodies()),
          macros,
          macrosUnread,
        },
        // #1825: ADR-006's and ADR-029's derivations look callees and typedefs
        // up in it. 1.4 completes it with every file's resolved symbols and
        // hands it on as `program.symbolTable()` (#1991).
        symbolTable: table,
        registry: input.registry,
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
          cnxIncludesByFile: new Map(
            declared.map((entry) => [entry.file.path, entry.file.cnxIncludes]),
          ),
        },
        // #1713: ADR-049's one target, which 1.2 chose
        target: input.target,
      },
    );
    return { program, sources: declared, discovery: input.discovery };
  }
}

export default Resolve;
