import type IOperandType from "./IOperandType";
import type TSubscriptKind from "./TSubscriptKind";

/** One postfix operation of a chain, with the types on either side of it */
interface IChainStep {
  /** The prefix the operation applies to */
  readonly before: IOperandType | null;
  /** For a subscript, what it is (element, slice, bit, bit range) */
  readonly subscript: TSubscriptKind | null;
  readonly after: IOperandType | null;
}

export default IChainStep;
