/**
 * An ADR-022 ternary, or the single operand that is not one.
 *
 * #1445: `ExpressionGenerator` read its node for one thing -- how many
 * `orExpression` children it has -- and handed each child straight back to the
 * orchestrator. One is a plain expression; three are condition, true arm and
 * false arm. The count IS the discrimination, so the union states it and the
 * recursion stays with the caller, which is the tree-walker.
 *
 * ## The arms are thunks and the single value is not
 *
 * Issue #992: a struct initializer inside a ternary arm needs a compound
 * literal, not a designated initializer, so both arms render with
 * `inDeclarationInit` cleared. That rule is the ternary's, so the generator
 * has to be the one that applies it -- which means it must control WHEN each
 * arm renders. Handing over already-rendered strings would move the rule to
 * the caller, and there is no caller that should own it.
 *
 * The single operand needs no thunk: it is the only thing that arm renders,
 * and the condition needs none either -- it is rendered with the flag as it
 * stands, exactly as before -- but it is one for symmetry with the arms it
 * sits beside, which reads better than one bare string among three callbacks.
 */
type TPlannedTernary =
  | { readonly kind: "value"; readonly code: string }
  | {
      readonly kind: "ternary";
      readonly renderCondition: () => string;
      readonly renderTrue: () => string;
      readonly renderFalse: () => string;
    };

export default TPlannedTernary;
