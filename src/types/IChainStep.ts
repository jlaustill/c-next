import type IOperandType from "./IOperandType";
import type TSubscriptKind from "./TSubscriptKind";

/** One postfix operation of a chain, with the types on either side of it */
interface IChainStep {
  /** The prefix the operation applies to */
  readonly before: IOperandType | null;
  /** For a subscript, what it is (element, slice, bit, bit range) */
  readonly subscript: TSubscriptKind | null;
  /**
   * For a `.name` step that reads an ADR-058/ADR-045 property, its name;
   * null for a field -- one named like a property included -- and for any
   * other step. The typer decides it, once (#1760 review).
   */
  readonly property: string | null;
  readonly after: IOperandType | null;
}

export default IChainStep;
