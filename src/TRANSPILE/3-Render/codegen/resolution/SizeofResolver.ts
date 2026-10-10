/**
 * SizeofResolver - Handles sizeof expression generation
 *
 * Extracted from CodeGenerator to reduce complexity.
 * Uses CodeGenState for all state access.
 *
 * ADR-023: sizeof expression handling with safety checks:
 * - E0601: sizeof on array parameter is error (returns pointer size)
 * - E0602: Side effects in sizeof are error (MISRA C:2012 Rule 13.6)
 *
 * ## It takes an operand, not a node (#1445)
 *
 * Every question here is about a NAME: what `arr` binds to where the `sizeof`
 * is (#1966), and whether `Scope` is a known scope. The tree was consulted
 * only to find out WHICH grammar alternative matched, which is the caller's
 * question -- so `TSizeofOperand` arrives already discriminated and this
 * module names no parse type. A member chain (#1972) and a type name (#1974)
 * arrive already rendered, by the decisions every other position uses.
 *
 * The one thing it must not do is render a type name for `a.b` before
 * deciding `a.b` is a type, which is why that arm carries a thunk. See
 * `TSizeofOperand`.
 */

import TSizeofOperand from "../types/TSizeofOperand";
import type TSizeofName from "../types/TSizeofName";
import type TParameterInfo from "../../../../types/TParameterInfo";
import invariant from "../../../../utils/invariant";
import type TranspileState from "../../../TranspileState";

/**
 * Resolves sizeof expressions to C code.
 */
export default class SizeofResolver {
  /**
   * Generate sizeof expression.
   * sizeof(type) -> sizeof(c_type)
   * sizeof(variable) -> sizeof(variable)
   */
  static generate(operand: TSizeofOperand, state: TranspileState): string {
    switch (operand.kind) {
      case "qualified-type":
        // `a.b` that is not a member access (#1972): a type, or #1973's form
        return (
          this.sizeofQualifiedType(
            operand.firstName,
            operand.memberName,
            state,
          ) ?? `sizeof(${operand.renderTypeName()})`
        );
      case "user-type":
        return this.sizeofUserType(operand.text, operand.textBinding, state);
      case "plain-type":
        return `sizeof(${operand.cTypeName})`;
      case "expression":
        return this.sizeofExpression(operand);
    }
  }

  /**
   * `a.b` that does not type as a member chain (#1972 renders those as
   * expressions): a scope's or enum's type (`Scope.Type`) renders as a type.
   * Returns null for that case.
   */
  private static sizeofQualifiedType(
    firstName: string,
    memberName: string,
    state: TranspileState,
  ): string | null {
    if (state.isKnownScope(firstName) || state.isKnownEnum(firstName)) {
      return null;
    }
    // #1973: a struct type's field (`Point.y`). ADR-023 has not decided
    // whether that form is valid, so it is written as it is until it does.
    return `sizeof(${firstName}.${memberName})`;
  }

  /**
   * Handle sizeof(identifier) where the identifier binds to a value
   */
  private static sizeofUserType(
    varName: string,
    binding: Exclude<TSizeofName, { readonly kind: "none" }>,
    state: TranspileState,
  ): string {
    switch (binding.kind) {
      case "parameter":
        return this.sizeofParameter(varName, this.parameterOf(varName, state));
      case "value":
        // ADR-057: without the emitted name `sizeof(arr)` measured the GLOBAL
        // array -- 16 bytes where 8 was correct, compiling clean -- and a scope
        // member's bare name did not compile (#1967)
        return `sizeof(${binding.cName})`;
    }
  }

  /** The current function's parameter a `sizeof` operand binds to */
  private static parameterOf(
    name: string,
    state: TranspileState,
  ): TParameterInfo {
    const paramInfo = state.currentParameters.get(name);
    invariant(
      paramInfo !== undefined,
      `a name that binds to a parameter ('${name}') is one of the current function's`,
    );
    return paramInfo;
  }

  /**
   * Handle sizeof on a parameter - validates and generates appropriate code
   */
  private static sizeofParameter(
    varName: string,
    paramInfo: { isArray?: boolean; isCallback?: boolean; isStruct?: boolean },
  ): string {
    // E0601: Array parameters decay to pointers
    if (paramInfo.isArray) {
      this.throwArrayParamSizeofError(varName);
    }
    // For pass-by-reference parameters (non-array, non-callback, non-struct),
    // use pointer dereference
    if (!paramInfo.isCallback && !paramInfo.isStruct) {
      return `sizeof(*${varName})`;
    }
    return `sizeof(${varName})`;
  }

  /**
   * #1322: E0601 is a pass-2.1 diagnostic. What remains is the assertion that
   * it ran -- and it also fixes the advice: the old message pointed at
   * `.length`, which ADR-058 deprecated and E0886 now rejects, so following it
   * produced a second error.
   */
  private static throwArrayParamSizeofError(varName: string): never {
    invariant(
      false,
      `sizeof() is not applied to an array parameter ('${varName}') -- E0601 rejects this in pass 2.1, before this runs`,
    );
  }

  /**
   * Handle sizeof(expression) with validation
   */
  private static sizeofExpression(
    operand: Extract<TSizeofOperand, { kind: "expression" }>,
  ): string {
    // E0601: Check if expression is an array parameter
    if (operand.simpleIdentifier !== null) {
      if (operand.parameter?.isArray) {
        this.throwArrayParamSizeofError(operand.simpleIdentifier);
      }
    }

    // #1322: MISRA C:2012 Rule 13.6 is E0602 in pass 2.1, which asks the tree
    // for a call. The predicate behind this also tested the operand's TEXT for
    // eleven assignment operators, none of which can appear in an expression --
    // assignment is a statement in this grammar.
    invariant(
      !operand.hasSideEffects,
      "sizeof()'s operand has no side effects -- E0602 rejects this in pass 2.1, before this runs",
    );

    return `sizeof(${operand.code})`;
  }
}
