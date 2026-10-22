import type IResolvedSymbols from "../../types/IResolvedSymbols";
import type IByValueFacts from "./IByValueFacts";

/** What the shape decision reads; each pass hands over its own view */
interface ICallbackShapeFacts extends IByValueFacts {
  readonly symbolTable: IResolvedSymbols;
  /** ADR-029: a function that is also a type, as the reader sees it */
  isFunctionType(typeName: string): boolean;
  /** A resolved cnx type name as the function's own prototype spells it */
  cType(typeName: string): string;
}

export default ICallbackShapeFacts;
