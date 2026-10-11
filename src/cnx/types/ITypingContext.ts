import type ICodeGenSymbols from "./ICodeGenSymbols";
import type IForeignSymbolLookup from "./IForeignSymbolLookup";
import type IProgram from "./IProgram";

/**
 * Everything the operand typer reads (#1668). 2.1's `IAnalysisContext` and
 * 2.2's `TranspileState.typingContext()` both satisfy it, so the two passes
 * type an operand from the same facts.
 */
interface ITypingContext {
  readonly sourceFile: string;
  /** This file's symbol view */
  readonly symbols: ICodeGenSymbols;
  /** 1.4's artifact, including the lexical frames and the run's target */
  readonly program: IProgram;
  readonly symbolTable: IForeignSymbolLookup;
}

export default ITypingContext;
