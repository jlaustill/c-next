import type RenderState from "../../../RenderState";
/**
 * Callbacks required for argument generation.
 * These need CodeGenerator context and cannot be replaced with static state.
 *
 * Issue #794: Extracted from CodeGenerator to reduce file size.
 *
 * #1445 box 3: these are THUNKS, closing over the expression node at the call
 * site. Every one of them took `Parser.ExpressionContext` as its first
 * parameter and `ArgumentGenerator` never read a member off it --
 * `grep -n 'ctx\.' ArgumentGenerator.ts` exits 1 -- so the node was threaded
 * through five signatures and four private helpers purely to be handed back.
 * `isCppMemberConversionRequired` keeps `targetType` because that is a string,
 * not a node.
 */

interface IArgumentGeneratorCallbacks {
  /**
   * 2.3 Render's per-file working state (#1452 box 4).
   *
   * Carried on the deps object this helper already receives, rather than read
   * off a static class.
   */
  readonly state: RenderState;

  /** Determine if expression is an lvalue (member access or array access) */
  getLvalueType: () => "member" | "array" | null;

  /** Check if member access is to an array field */
  getMemberAccessArrayStatus: () => "array" | "not-array" | "unknown";

  /** Check if C++ mode needs temp variable for type conversion */
  isCppMemberConversionRequired: (targetType?: string) => boolean;

  /** Check if expression is subscript access on a string variable */
  isStringSubscriptAccess: () => boolean;

  /** Generate expression code */
  generateExpression: () => string;
}

export default IArgumentGeneratorCallbacks;
