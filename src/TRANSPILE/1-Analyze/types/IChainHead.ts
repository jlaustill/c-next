import { TerminalNode } from "antlr4ng";
import TChainRoot from "./TChainRoot";

/**
 * Where a member chain starts: which of ADR-016's three spellings it uses, the
 * chain's first NAME, and how many postfix ops the root consumed.
 *
 * The third field is the one that has to travel with the other two. A bare
 * chain reads its head off the primary and consumes no op; a `this.`/`global.`
 * chain reads it off the first op and consumes it, so every later positional
 * question shifts. Returning the root without the offset is what left each
 * caller to re-derive the shift.
 */
interface IChainHead {
  readonly root: TChainRoot;
  readonly identifier: TerminalNode | null;
  readonly opsConsumed: number;
}

export default IChainHead;
