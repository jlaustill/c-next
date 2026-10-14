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
  /** ADR-058: the prefix names a type (`u32`, `Point`), not a value */
  readonly beforeNamesType: boolean;
  /** ADR-058: the prefix is a bitmap field or a header bit-field, with no storage of its own */
  readonly beforeIsBitField: boolean;
  readonly after: IOperandType | null;
  /** A call's: the C name of the function it calls, when the chain names one (#1991) */
  readonly callee: string | null;
}

export default IChainStep;
