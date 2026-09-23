import type IPlannedCallArgument from "./IPlannedCallArgument";

/**
 * One operation applied to a postfix expression's primary.
 *
 * The grammar's `postfixOp` is three things behind one node, told apart by
 * which child it carries: an IDENTIFIER is a member access, one or two
 * bracketed expressions are a subscript, and neither is a call. That
 * discrimination is the planner's now, so what arrives is already the arm.
 *
 * #1445 box 3: `PostfixExpressionGenerator` is 2028 lines and touched a parse
 * node in eight of them -- this union is most of what those eight did.
 */
type TPlannedPostfixOp =
  /** `.field` */
  | { readonly kind: "member"; readonly name: string }
  /**
   * `[i]` or `[start, width]`.
   *
   * `indexCount` is 1 or 2 and it is the DISCRIMINATOR: one index is an array
   * or bit access, two is a bit RANGE. Counting operations rather than
   * expressions is what keeps `flags[4, 3]` (one op, two expressions) distinct
   * from `flags[4][3]` (two ops, one each).
   *
   * `renderIndexes` returns them together, in order, because the generator
   * invokes it inside a single `withExpectedType("size_t", ...)` window --
   * MISRA C:2012 Rule 7.2's `U` suffix on an index literal comes from that
   * window, so a value rendered outside it silently loses the suffix.
   */
  | {
      readonly kind: "subscript";
      readonly indexCount: number;
      readonly renderIndexes: () => readonly string[];
      /**
       * The FINAL index folded to a compile-time constant, or undefined.
       *
       * Issue #1094: a bit range resolves a const or macro width to its value
       * so the mask is precomputed, byte-identical to a literal width, instead
       * of a runtime `((1U << W) - 1)` -- which is undefined behavior at full
       * width and uses the wrong base type above 32 bits. Only the two-index
       * arm asks.
       */
      readonly foldWidth: () => number | undefined;
    }
  /**
   * `(args)`
   *
   * `line` is where ADR-010's promise -- a declaration reached through an
   * `#include` is callable exactly where a local one is -- is recorded when it
   * fires. At the CALL rather than at the directive: an `#include` sits in no
   * scope, function or variable, so the matrix's context axis has nothing to
   * ask it (#1508).
   *
   * The arguments are unevaluated: a call whose result is discarded must not
   * render its arguments, and planning them reads the callee's parameters.
   */
  | {
      readonly kind: "call";
      readonly line: number | undefined;
      readonly planArguments: () => readonly IPlannedCallArgument[] | null;
    };

export default TPlannedPostfixOp;
