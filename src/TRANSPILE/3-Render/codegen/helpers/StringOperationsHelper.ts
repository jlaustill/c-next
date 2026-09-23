/**
 * StringOperationsHelper - what ADR-045's string operations render as.
 *
 * Extracted from CodeGenerator to reduce file size.
 *
 * ADR-045: String type support
 *
 * ## It asks the type registry, not the tree (#1445)
 *
 * Every question here is answered from a NAME and the render-time type
 * registry: how long is this literal, how wide is this declared string. The
 * tree navigation that used to sit in front of those questions --
 * "is this expression a two-operand `+`", "is it an identifier with one
 * subscript" -- moved to `ExpressionUnwrapper`, which is what that utility is
 * for and which keeps both shapes unit-tested.
 *
 * That split is also an ORDERING, not just a relocation. Generating an index
 * expression can allocate a C++ temp and queue its declaration, so the caller
 * asks `getStringExprCapacity` -- which is what makes `s[i]` a substring
 * rather than an array index -- BEFORE it generates anything it might discard.
 * A helper that took the generated code and then decided would have had the
 * decision arrive too late to be free.
 */

import ISubstringOps from "../types/ISubstringOps";
import IStringConcatOps from "../types/IStringConcatOps";
import CodeGenState from "../../../../transpiler/state/CodeGenState";
import StringUtils from "../../../../utils/StringUtils";
import BareIdentifier from "../../../../utils/BareIdentifier";

/**
 * Helper for string operation rendering.
 * All methods are static - uses CodeGenState for shared state.
 */
class StringOperationsHelper {
  /**
   * Get the capacity of a string expression.
   * For string literals, capacity equals content length.
   * For string variables, capacity is from the type registry.
   *
   * ADR-045: String capacity resolution for concatenation and bounds checking.
   *
   * @param exprCode - Expression code text (e.g., "hello" or varName)
   * @returns Capacity in characters, or null if not a string
   */
  static getStringExprCapacity(exprCode: string): number | null {
    // String literal - capacity equals content length
    if (exprCode.startsWith('"') && exprCode.endsWith('"')) {
      return StringUtils.literalLength(exprCode);
    }

    // Variable - check type registry
    if (BareIdentifier.matches(exprCode)) {
      const typeInfo = CodeGenState.getVariableTypeInfo(exprCode);
      if (typeInfo?.isString && typeInfo.stringCapacity !== undefined) {
        return typeInfo.stringCapacity;
      }
    }

    return null;
  }

  /**
   * The operands of a string concatenation, given the two addition operands.
   *
   * ADR-045: concatenation detection for strncpy/strncat generation. Null
   * unless BOTH operands are strings -- `str + 5` is not a concatenation, and
   * neither is `1 + 2`.
   *
   * @param leftText - source text of the left operand
   * @param rightText - source text of the right operand
   */
  static getStringConcatOperands(
    leftText: string,
    rightText: string,
  ): IStringConcatOps | null {
    const leftCapacity = StringOperationsHelper.getStringExprCapacity(leftText);
    const rightCapacity =
      StringOperationsHelper.getStringExprCapacity(rightText);

    if (leftCapacity === null || rightCapacity === null) {
      return null;
    }

    return {
      left: leftText,
      right: rightText,
      leftCapacity,
      rightCapacity,
    };
  }

  /**
   * The operands of a substring extraction, or null when `sourceName` is not a
   * string -- which is what makes `s[i]` a substring rather than an array
   * index.
   *
   * ADR-045: safe string slicing. Issue #140: `source[i]` is sugar for
   * `source[i, 1]`, which is the whole difference between the one-index and
   * two-index forms -- the grammar admits no other arity.
   *
   * ## The indexes arrive as a thunk, and that is the point
   *
   * Generating an expression is not free, and it cannot be taken back: it
   * can queue a pending temp declaration into the enclosing block --
   * `ArgumentGenerator.createCppMemberConversionTemp` for a C++ member
   * conversion, and the float bit-range shadow union in the postfix generator
   * both do. So an index generated for an expression that turns out NOT to be
   * a substring leaks a declaration for a value nothing reads.
   *
   * Taking generated strings and deciding afterwards would put that decision
   * one step too late, and taking the capacity as a parameter would move the
   * decision to the caller. Taking a thunk keeps the decision here and makes
   * the order impossible to get wrong at a call site. It is asserted rather
   * than remembered: a unit test counts the invocations and fails if the
   * lookup stops coming first -- measured, because reordering it reddens 0 of
   * the 1254 integration fixtures.
   */
  static getSubstringOperands(
    sourceName: string,
    generateIndexes: () => readonly string[],
  ): ISubstringOps | null {
    const sourceCapacity =
      StringOperationsHelper.getStringExprCapacity(sourceName);
    if (sourceCapacity === null) return null;

    const indexCodes = generateIndexes();
    return {
      source: sourceName,
      start: indexCodes[0],
      lengthExpression: indexCodes[1] ?? "1",
      sourceCapacity,
    };
  }
}

export default StringOperationsHelper;
