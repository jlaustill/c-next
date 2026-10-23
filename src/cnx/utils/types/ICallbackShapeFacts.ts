import type ICodeGenSymbols from "../../types/ICodeGenSymbols";
import type IProgram from "../../types/IProgram";
import type IResolvedSymbols from "../../types/IResolvedSymbols";

/**
 * The data the `_fp` shape is decided from. Data only, no answers: 2.1 and
 * 2.2 hand over the same three things, and every rule that reads them lives
 * in `CallbackParameterShape`.
 */
interface ICallbackShapeFacts {
  readonly program: IProgram | null;
  /** The file's declared types; its `functionReturnTypes` are its function-as-types */
  readonly symbols: ICodeGenSymbols;
  readonly symbolTable: IResolvedSymbols;
}

export default ICallbackShapeFacts;
