import type ICodeGenSymbols from "../../../transpiler/types/ICodeGenSymbols";
import type IProgram from "../../../transpiler/types/IProgram";
import type SymbolTable from "../../../PARSE/3-Declare/SymbolTable";

/**
 * What 2.1 Analyze is allowed to know about the program it is judging.
 *
 * #1456. These three facts were reached through `CodeGenState`, which is the
 * render pass's state container and is reachable from every pass at once. That
 * is the shape `docs/architecture/README.md` forbids -- *"a container that
 * outlives a pass is how facts come to be stashed instead of carried"* -- and
 * the cost is not theoretical: #1430 and #1432 are both an analyzer reading a
 * field a LATER pass fills, getting the previous file's answer or the previous
 * run's.
 *
 * Carrying them makes the boundary checkable. An analyzer can only read what
 * is on this object, and what is on this object is settled before 2.1 begins.
 *
 * ## Why `program` is not nullable here
 *
 * `CodeGenState.program` is `IProgram | null`, so all thirteen analyzer reads
 * spelled `CodeGenState.program?.x() ?? fallback`. Every one of those was a
 * guard that could not fire and a wrong answer if it ever did: `Transpiler`
 * asserts the artifact with `invariant` before it calls `runAnalyzers`, so by
 * 2.1 it always exists -- and a `?? []` for "what consts does this scope have"
 * is a REAL answer meaning "none", not a missing one.
 */
interface IAnalysisContext {
  /**
   * What THIS file can see: its own declarations plus its `.cnx` includes.
   *
   * Nullable, unlike `program`. Production always has one --
   * `_requireSymbolInfo` throws rather than returning undefined -- but several
   * analyzers answer "no symbol view" DELIBERATELY, with "no evidence is not
   * evidence of absence", and `UndeclaredTypeAnalyzer` has a test for it whose
   * own comment records that no integration fixture can construct the state.
   * Making this non-nullable would delete that behavior by making it
   * unrepresentable, which is a decision about diagnostics rather than about
   * where a fact lives -- so #1456 moves the fact and leaves the question.
   */
  readonly symbols: ICodeGenSymbols | null;

  /** 1.4 Resolve's artifact -- every cross-file fact, settled before 2.1. */
  readonly program: IProgram;

  /** What the program declares, C and C++ headers included. */
  readonly symbolTable: SymbolTable;

  /**
   * Whether this file can see a C/C++ header, which is what decides if an
   * unresolved name is a defect or a type the compiler will supply.
   *
   * The orchestrator computes it per file in `_establishPerFileCodeGenState`,
   * the single site #1430 forced it into. It travels here rather than on
   * `CodeGenState` for the same reason as the rest: 2.1 reads it, and 2.3
   * happens to be where it was parked.
   */
  readonly reachesForeignHeader: boolean;
}

export default IAnalysisContext;
