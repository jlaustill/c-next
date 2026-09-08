/**
 * Which of ADR-016's three spellings a member chain is written in.
 *
 * #1322 review. Four copies of this two-line decision existed --
 * `RegisterMemberReference` held two, `BitAccessAnalyzer` held one as a method
 * and one as an inline nested ternary -- and they are one decision, not four.
 *
 * The two overloads are not a convenience: a POSTFIX EXPRESSION carries its
 * root on the primary and the chain's first name in its first op, while an
 * ASSIGNMENT TARGET carries both the root and the first name on the target
 * itself. Reading one shape with the other's offset is what left a register
 * READ silent while the write beside it fired (see `BitmapAccessAnalyzer`), so
 * the two node shapes stay two named questions rather than one guess.
 */

import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import TChainRoot from "../types/TChainRoot";

class ChainRoot {
  /** The root a postfix expression starts from. */
  static ofPrimary(primary: Parser.PrimaryExpressionContext): TChainRoot {
    if (primary.THIS()) return "this";
    if (primary.GLOBAL()) return "global";
    return null;
  }

  /** The same for an assignment target, whose keywords sit on the target. */
  static ofTarget(target: Parser.AssignmentTargetContext): TChainRoot {
    if (target.THIS()) return "this";
    if (target.GLOBAL()) return "global";
    return null;
  }
}

export default ChainRoot;
