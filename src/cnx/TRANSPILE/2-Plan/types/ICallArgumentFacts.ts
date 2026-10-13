import type ICallbackTypeInfo from "../../../types/ICallbackTypeInfo";
import type IFunctionSignature from "../../../types/IFunctionSignature";
import type IResolvedSymbols from "../../../types/IResolvedSymbols";

/** What `CallArgumentPassing` reads to find the parameter an argument binds to */
interface ICallArgumentFacts {
  readonly symbolTable: IResolvedSymbols | null;
  readonly functionSignatures: ReadonlyMap<string, IFunctionSignature>;
  readonly callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;
}

export default ICallArgumentFacts;
