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
 * Every question here is about a NAME and `CodeGenState`: is `arr` a
 * parameter, is `cfg` a local that shadows a file-scope name, is `Scope` a
 * known scope. The tree was consulted only to find out WHICH grammar
 * alternative matched, which is the caller's question -- so `TSizeofOperand`
 * arrives already discriminated and this module names no parse type.
 *
 * The one thing it must not do is render a type name for `a.b` before
 * deciding `a.b` is a type, which is why that arm carries a thunk. See
 * `TSizeofOperand`.
 */

import TSizeofOperand from "../types/TSizeofOperand";
import invariant from "../../../../utils/invariant";
import type RenderState from "../../RenderState";

/**
 * Resolves sizeof expressions to C code.
 */
export default class SizeofResolver {
  /**
   * Generate sizeof expression.
   * sizeof(type) -> sizeof(c_type)
   * sizeof(variable) -> sizeof(variable)
   */
  static generate(operand: TSizeofOperand, state: RenderState): string {
    switch (operand.kind) {
      case "qualified-type":
        // `a.b` matched the qualified-TYPE alternative, and may still be a
        // member access -- only `CodeGenState` knows which.
        return (
          this.sizeofQualifiedType(
            operand.firstName,
            operand.memberName,
            state,
          ) ?? `sizeof(${operand.renderTypeName()})`
        );
      case "user-type":
        return this.sizeofUserType(operand.text, state);
      case "plain-type":
        return `sizeof(${operand.cTypeName})`;
      case "expression":
        return this.sizeofExpression(operand, state);
    }
  }

  /**
   * Handle sizeof(qualified.type) - may be struct.member access
   * Returns null if this is actually a type reference (Scope.Type)
   */
  private static sizeofQualifiedType(
    firstName: string,
    memberName: string,
    state: RenderState,
  ): string | null {
    // Check if first identifier is a local variable (struct instance)
    if (state.localVariables.has(firstName)) {
      // ADR-057: a local that shadows a file-scope name is emitted under a
      // distinct C identifier. Without this, `sizeof(cfg.x)` measured the
      // GLOBAL `cfg` -- a wrong number, compiling clean.
      return `sizeof(${state.emittedLocalName(firstName)}.${memberName})`;
    }

    // Check if first identifier is a parameter (struct parameter)
    const paramInfo = state.currentParameters.get(firstName);
    if (paramInfo) {
      const sep = paramInfo.isStruct ? "->" : ".";
      return `sizeof(${firstName}${sep}${memberName})`;
    }

    // Check if first identifier is a global variable
    // If not a scope or enum, it's likely a global struct variable
    if (!state.isKnownScope(firstName) && !state.isKnownEnum(firstName)) {
      return `sizeof(${firstName}.${memberName})`;
    }

    // It's an actual type reference (Scope.Type), return null to fall through
    return null;
  }

  /**
   * Handle sizeof(identifier) - could be variable or type name
   */
  private static sizeofUserType(varName: string, state: RenderState): string {
    // Check if it's a known parameter
    const paramInfo = state.currentParameters.get(varName);
    if (paramInfo) {
      return this.sizeofParameter(varName, paramInfo);
    }

    // Check if it's a known local variable, struct type, or enum type
    // For all these cases, generate sizeof(name) directly
    // Unknown identifiers are also treated as variables for safety
    //
    // ADR-057: emittedLocalName is a no-op for type names and for locals that
    // shadow nothing -- a rename exists only for a local of this exact name in
    // this function. Without it `sizeof(arr)` measured the GLOBAL array: 16
    // bytes where 8 was correct, with no diagnostic and a clean compile.
    return `sizeof(${state.emittedLocalName(varName)})`;
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
    state: RenderState,
  ): string {
    // E0601: Check if expression is an array parameter
    if (operand.simpleIdentifier !== null) {
      const paramInfo = state.currentParameters.get(operand.simpleIdentifier);
      if (paramInfo?.isArray) {
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
