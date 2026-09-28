/**
 * ArgumentGenerator - Generates function arguments with proper ADR-006 semantics
 *
 * Issue #794: Extracted from CodeGenerator to reduce file size.
 * Uses CodeGenState for state access and callbacks for CodeGenerator methods.
 *
 * Handles argument generation patterns:
 * - Local variables get & (address-of) in C mode
 * - Member access (cursor.x) gets & (address-of)
 * - Array access (arr[i]) gets & (address-of)
 * - Parameters are passed as-is (already pointers)
 * - Arrays are passed as-is (naturally decay to pointers)
 * - Literals use compound literals for pointer params: &(type){value}
 * - Complex expressions are passed as-is
 */

import CppModeHelper from "./CppModeHelper";
import TYPE_MAP from "../types/TYPE_MAP";
import IArgumentGeneratorCallbacks from "./types/IArgumentGeneratorCallbacks";
import type TranspileState from "../../../TranspileState";
import type TTypeInfo from "../../../../transpiler/types/TTypeInfo";

/**
 * Generates function arguments with proper pass-by-reference semantics.
 */
class ArgumentGenerator {
  /**
   * Handle simple identifier argument (parameter, array, pointer, or variable).
   * This is a pure function that only reads from state.
   *
   * @param id the name as written, which is how parameters are keyed
   * @param emitted the C name the one binder gives it (#1760 review):
   *   a shadowing local's ADR-057 name, or a scope member's qualified name.
   *   This used to be decided here from `getScopeMembers().has(id)` or the
   *   bare `id`, so a local shadowing a global or a member was passed as the
   *   global or the member, and a scope member array as its bare name.
   */
  static handleIdentifierArg(
    id: string,
    emitted: string,
    declared: TTypeInfo | undefined,
    state: TranspileState,
  ): string {
    // Parameters are already pointers
    if (state.currentParameters.get(id)) {
      return id;
    }

    // Arrays decay to pointers, local or not, strings included (#1668: the
    // declaration's answer, which the `localArrays` set only duplicated): a
    // `char[N]` decays to `char*`
    // exactly like any other array, and a `string<N>` parameter is generated as
    // `char*`. Taking its address instead yields `char (*)[N]`, an incompatible
    // pointer type -- the defect `e3dff5f4` fixed by deleting the `isString`
    // exception this comment used to argue for.
    const typeInfo = declared;
    if (typeInfo?.isArray) {
      return emitted;
    }

    // Issue #895 Bug B: Inferred pointers are already pointers, don't add &
    if (typeInfo?.isPointer) {
      return emitted;
    }

    // A variable - add & (except in C++ mode)
    return CppModeHelper.maybeAddressOf(emitted, state);
  }

  /**
   * Handle rvalue argument (literals or complex expressions).
   * Issue #872: Sets expectedType for MISRA 7.2 U suffix on unsigned literals.
   */
  static handleRvalueArg(
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    // Issue #872: Early return when no target type - no state management needed
    if (!targetParamBaseType) {
      return callbacks.generateExpression();
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (!cType || cType === "void") {
      // Issue #872: Suppress bare enum resolution in function args (requires ADR to change)
      return state.withExpectedType(
        targetParamBaseType,
        () => callbacks.generateExpression(),
        true, // suppressEnumResolution
      );
    }

    // Issue #872: Suppress bare enum resolution in function args (requires ADR to change)
    const value = state.withExpectedType(
      targetParamBaseType,
      () => callbacks.generateExpression(),
      true, // suppressEnumResolution
    );

    // C++ mode: rvalues can bind to const T&
    if (state.cppMode) {
      return value;
    }

    // C mode: Use compound literal syntax
    return `&(${cType}){${value}}`;
  }

  /**
   * Create temp variable for C++ member conversion.
   */
  static createCppMemberConversionTemp(
    targetParamBaseType: string,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    const cType = TYPE_MAP[targetParamBaseType] || "uint8_t";
    const value = callbacks.generateExpression();
    // Issue #1131: one temporary namer for every family. This site previously
    // incremented the shared counter itself and spelled the name a third way
    // (`_cnx_tmp_<N>` alongside `_tmp<N>`), so the two families agreed only by
    // coincidence of drawing from the same counter.
    const tempName = state.getNextTempVarName();
    const castExpr = CppModeHelper.cast(cType, value, state);
    state.pendingTempDeclarations.push(`${cType} ${tempName} = ${castExpr};`);
    return CppModeHelper.maybeAddressOf(tempName, state);
  }

  /**
   * Maybe cast string subscript access for integer pointer parameters.
   */
  static maybeCastStringSubscript(
    expr: string,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    if (!targetParamBaseType || !callbacks.isStringSubscriptAccess()) {
      return expr;
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (cType && !["float", "double", "bool", "void"].includes(cType)) {
      return CppModeHelper.reinterpretCast(`${cType}*`, expr, state);
    }

    return expr;
  }

  /**
   * Handle member access argument - may need special handling for arrays or C++ conversions.
   * Returns null if default lvalue handling should be used.
   */
  static handleMemberAccessArg(
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string | null {
    const arrayStatus = callbacks.getMemberAccessArrayStatus();

    // Array member - no address-of needed
    if (arrayStatus === "array") {
      return callbacks.generateExpression();
    }

    // C++ mode may need temp variable for type conversion
    if (
      arrayStatus === "not-array" &&
      targetParamBaseType &&
      callbacks.isCppMemberConversionRequired(targetParamBaseType)
    ) {
      return ArgumentGenerator.createCppMemberConversionTemp(
        targetParamBaseType,
        callbacks,
        state,
      );
    }

    return null; // Fall through to default lvalue handling
  }

  /**
   * Handle lvalue argument (member access or array access).
   */
  static handleLvalueArg(
    lvalueType: "member" | "array",
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    // Member access to array field - arrays decay to pointers
    if (lvalueType === "member") {
      const memberResult = ArgumentGenerator.handleMemberAccessArg(
        targetParamBaseType,
        callbacks,
        state,
      );
      if (memberResult) return memberResult;
    }

    // Generate expression with address-of
    const generatedExpr = callbacks.generateExpression();
    const expr = CppModeHelper.maybeAddressOf(generatedExpr, state);

    // String subscript access may need cast
    if (lvalueType === "array") {
      return ArgumentGenerator.maybeCastStringSubscript(
        expr,
        targetParamBaseType,
        callbacks,
        state,
      );
    }

    return expr;
  }

  /**
   * Main entry point: Generate a function argument with proper ADR-006 semantics.
   *
   * @param simpleId - The simple identifier as written, and the C name it binds to
   * @param targetParamBaseType - The target parameter's base type
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static generateArg(
    simpleId: { readonly id: string; readonly emitted: string } | null,
    declared: TTypeInfo | undefined,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    // Handle simple identifiers
    if (simpleId) {
      return ArgumentGenerator.handleIdentifierArg(
        simpleId.id,
        simpleId.emitted,
        declared,
        state,
      );
    }

    // Check if expression is an lvalue
    const lvalueType = callbacks.getLvalueType();
    if (lvalueType) {
      return ArgumentGenerator.handleLvalueArg(
        lvalueType,
        targetParamBaseType,
        callbacks,
        state,
      );
    }

    // Handle rvalue (literals or complex expressions)
    return ArgumentGenerator.handleRvalueArg(
      targetParamBaseType,
      callbacks,
      state,
    );
  }
}

export default ArgumentGenerator;
