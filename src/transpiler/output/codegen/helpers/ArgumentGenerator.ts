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

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import CodeGenState from "../../../state/CodeGenState.js";
import CppModeHelper from "./CppModeHelper.js";
import TYPE_MAP from "../types/TYPE_MAP.js";
import IArgumentGeneratorCallbacks from "./types/IArgumentGeneratorCallbacks.js";

/**
 * Generates function arguments with proper pass-by-reference semantics.
 */
class ArgumentGenerator {
  /**
   * Handle simple identifier argument (parameter, local array, scope member, or variable).
   * This is a pure function that only reads from CodeGenState.
   */
  static handleIdentifierArg(id: string): string {
    // Parameters are already pointers
    if (CodeGenState.currentParameters.get(id)) {
      return id;
    }

    // Local arrays decay to pointers
    if (CodeGenState.localArrays.has(id)) {
      return id;
    }

    // Global arrays also decay to pointers (check typeRegistry)
    // But NOT strings - strings need & (they're char arrays but passed by reference)
    const typeInfo = CodeGenState.getVariableTypeInfo(id);
    if (typeInfo?.isArray && !typeInfo.isString) {
      return id;
    }

    // Issue #895 Bug B: Inferred pointers are already pointers, don't add &
    if (typeInfo?.isPointer) {
      return id;
    }

    // Scope member - may need prefixing
    if (CodeGenState.currentScope) {
      const members = CodeGenState.getScopeMembers(CodeGenState.currentScope);
      if (members?.has(id)) {
        const scopedName = `${CodeGenState.currentScope}_${id}`;
        return CppModeHelper.maybeAddressOf(scopedName);
      }
    }

    // Local variable - add & (except in C++ mode)
    return CppModeHelper.maybeAddressOf(id);
  }

  /**
   * Handle rvalue argument (literals or complex expressions).
   */
  static handleRvalueArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    if (!targetParamBaseType) {
      return callbacks.generateExpression(ctx);
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (!cType || cType === "void") {
      return callbacks.generateExpression(ctx);
    }

    const value = callbacks.generateExpression(ctx);

    // C++ mode: rvalues can bind to const T&
    if (CodeGenState.cppMode) {
      return value;
    }

    // C mode: Use compound literal syntax
    return `&(${cType}){${value}}`;
  }

  /**
   * Create temp variable for C++ member conversion.
   */
  static createCppMemberConversionTemp(
    ctx: Parser.ExpressionContext,
    targetParamBaseType: string,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    const cType = TYPE_MAP[targetParamBaseType] || "uint8_t";
    const value = callbacks.generateExpression(ctx);
    const tempName = `_cnx_tmp_${CodeGenState.tempVarCounter++}`;
    const castExpr = CppModeHelper.cast(cType, value);
    CodeGenState.pendingTempDeclarations.push(
      `${cType} ${tempName} = ${castExpr};`,
    );
    return CppModeHelper.maybeAddressOf(tempName);
  }

  /**
   * Maybe cast string subscript access for integer pointer parameters.
   */
  static maybeCastStringSubscript(
    ctx: Parser.ExpressionContext,
    expr: string,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    if (!targetParamBaseType || !callbacks.isStringSubscriptAccess(ctx)) {
      return expr;
    }

    const cType = TYPE_MAP[targetParamBaseType];
    if (cType && !["float", "double", "bool", "void"].includes(cType)) {
      return CppModeHelper.reinterpretCast(`${cType}*`, expr);
    }

    return expr;
  }

  /**
   * Handle member access argument - may need special handling for arrays or C++ conversions.
   * Returns null if default lvalue handling should be used.
   */
  static handleMemberAccessArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
  ): string | null {
    const arrayStatus = callbacks.getMemberAccessArrayStatus(ctx);

    // Array member - no address-of needed
    if (arrayStatus === "array") {
      return callbacks.generateExpression(ctx);
    }

    // C++ mode may need temp variable for type conversion
    if (
      arrayStatus === "not-array" &&
      targetParamBaseType &&
      callbacks.needsCppMemberConversion(ctx, targetParamBaseType)
    ) {
      return ArgumentGenerator.createCppMemberConversionTemp(
        ctx,
        targetParamBaseType,
        callbacks,
      );
    }

    return null; // Fall through to default lvalue handling
  }

  /**
   * Handle lvalue argument (member access or array access).
   */
  static handleLvalueArg(
    ctx: Parser.ExpressionContext,
    lvalueType: "member" | "array",
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    // Member access to array field - arrays decay to pointers
    if (lvalueType === "member") {
      const memberResult = ArgumentGenerator.handleMemberAccessArg(
        ctx,
        targetParamBaseType,
        callbacks,
      );
      if (memberResult) return memberResult;
    }

    // Generate expression with address-of
    const generatedExpr = callbacks.generateExpression(ctx);
    const expr = CppModeHelper.maybeAddressOf(generatedExpr);

    // String subscript access may need cast
    if (lvalueType === "array") {
      return ArgumentGenerator.maybeCastStringSubscript(
        ctx,
        expr,
        targetParamBaseType,
        callbacks,
      );
    }

    return expr;
  }

  /**
   * Main entry point: Generate a function argument with proper ADR-006 semantics.
   *
   * @param ctx - The expression context
   * @param simpleId - The simple identifier if known (optimization to avoid re-parsing)
   * @param targetParamBaseType - The target parameter's base type
   * @param callbacks - Callbacks to CodeGenerator methods
   */
  static generateArg(
    ctx: Parser.ExpressionContext,
    simpleId: string | null,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    // Handle simple identifiers
    if (simpleId) {
      return ArgumentGenerator.handleIdentifierArg(simpleId);
    }

    // Check if expression is an lvalue
    const lvalueType = callbacks.getLvalueType(ctx);
    if (lvalueType) {
      return ArgumentGenerator.handleLvalueArg(
        ctx,
        lvalueType,
        targetParamBaseType,
        callbacks,
      );
    }

    // Handle rvalue (literals or complex expressions)
    return ArgumentGenerator.handleRvalueArg(
      ctx,
      targetParamBaseType,
      callbacks,
    );
  }
}

export default ArgumentGenerator;
