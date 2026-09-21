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

import { TerminalNode } from "antlr4ng";
import * as Parser from "../../../transpiler/logic/parser/grammar/CNextParser";
import IChainHead from "../types/IChainHead";
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

  /**
   * The root AND where the chain's first name sits -- one answer, because they
   * are one question.
   *
   * `ofPrimary` gives half of it. The other half is the OFFSET: a root keyword
   * consumes the primary, so a rooted chain carries its first name in the first
   * op, and everything positional after it -- call parentheses, member slicing
   * -- shifts by `opsConsumed`. Reading one shape with the other's offset is
   * the defect this class's header already names, and answering only "which
   * root" left every caller to re-derive the rest: five sites did, in four
   * different spellings, two of them keeping the `DOT()` guard below and two
   * dropping it.
   *
   * `identifier` is null when the head is not a name at all -- a literal, a
   * parenthesised expression, or a rooted chain whose first op subscripts
   * rather than names (`this[0]`), which no spelling that omits the guard can
   * tell apart from a member access.
   */
  static headOf(
    primary: Parser.PrimaryExpressionContext,
    ops: readonly Parser.PostfixOpContext[],
  ): IChainHead {
    const root = ChainRoot.ofPrimary(primary);
    if (root === null) {
      return { root, identifier: primary.IDENTIFIER() ?? null, opsConsumed: 0 };
    }

    const first = ops[0];
    const identifier: TerminalNode | null =
      first !== undefined && first.DOT() !== null
        ? (first.IDENTIFIER() ?? null)
        : null;
    return { root, identifier, opsConsumed: 1 };
  }
}

export default ChainRoot;
