import type ICallbackTypeInfo from "../../../types/ICallbackTypeInfo";
import type IFunctionSignature from "../../../types/IFunctionSignature";
import type IResolvedSymbols from "../../../types/IResolvedSymbols";

/** What `CallArgumentPassing` reads to find the parameter an argument binds to */
interface ICallArgumentFacts {
  readonly symbolTable: IResolvedSymbols | null;
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;
  /** Issue #895: the C callback typedef a C-Next function is used as, if any */
  callbackTypedefTypeFor(functionName: string): string | undefined;
}

export default ICallArgumentFacts;
