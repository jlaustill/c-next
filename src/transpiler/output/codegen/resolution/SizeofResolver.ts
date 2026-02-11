/**
 * SizeofResolver - Handles sizeof expression generation
 *
 * Extracted from CodeGenerator to reduce complexity.
 * Uses CodeGenState for all state access.
 *
 * ADR-023: sizeof expression handling with safety checks:
 * - E0601: sizeof on array parameter is error (returns pointer size)
 * - E0602: Side effects in sizeof are error (MISRA C:2012 Rule 13.6)
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../../state/CodeGenState";
import ExpressionUnwrapper from "../utils/ExpressionUnwrapper";

/**
 * Callbacks for operations that require CodeGenerator context.
 * These are the minimal dependencies that can't be replaced with CodeGenState.
 */
interface ISizeofCallbacks {
  generateType: (ctx: Parser.TypeContext) => string;
  generateExpression: (ctx: Parser.ExpressionContext) => string;
  hasSideEffects: (ctx: Parser.ExpressionContext) => boolean;
}

/**
 * Resolves sizeof expressions to C code.
 */
export default class SizeofResolver {
  /**
   * Generate sizeof expression.
   * sizeof(type) -> sizeof(c_type)
   * sizeof(variable) -> sizeof(variable)
   */
  static generate(
    ctx: Parser.SizeofExpressionContext,
    callbacks: ISizeofCallbacks,
  ): string {
    // Check if it's sizeof(type) or sizeof(expression)
    // Note: Due to grammar ambiguity, sizeof(variable) may parse as sizeof(type)
    // when the variable name matches userType (just an identifier)
    if (ctx.type()) {
      return this.sizeofType(ctx.type()!, callbacks);
    }
    return this.sizeofExpression(ctx.expression()!, callbacks);
  }

  /**
   * Handle sizeof(type) - may actually be sizeof(variable) due to grammar ambiguity
   */
  private static sizeofType(
    typeCtx: Parser.TypeContext,
    callbacks: ISizeofCallbacks,
  ): string {
    // qualifiedType matches IDENTIFIER.IDENTIFIER, could be struct.member
    if (typeCtx.qualifiedType()) {
      const result = this.sizeofQualifiedType(typeCtx.qualifiedType()!);
      if (result) return result;
      // Fall through to generateType for actual type references (Scope.Type)
    }

    // userType is just IDENTIFIER, could be a variable reference
    if (typeCtx.userType()) {
      return this.sizeofUserType(typeCtx.getText());
    }

    // It's a primitive or other type - generate normally
    return `sizeof(${callbacks.generateType(typeCtx)})`;
  }

  /**
   * Handle sizeof(qualified.type) - may be struct.member access
   * Returns null if this is actually a type reference (Scope.Type)
   */
  private static sizeofQualifiedType(
    qualifiedCtx: Parser.QualifiedTypeContext,
  ): string | null {
    const identifiers = qualifiedCtx.IDENTIFIER();
    const firstName = identifiers[0].getText();
    const memberName = identifiers[1].getText();

    // Check if first identifier is a local variable (struct instance)
    if (CodeGenState.localVariables.has(firstName)) {
      return `sizeof(${firstName}.${memberName})`;
    }

    // Check if first identifier is a parameter (struct parameter)
    const paramInfo = CodeGenState.currentParameters.get(firstName);
    if (paramInfo) {
      const sep = paramInfo.isStruct ? "->" : ".";
      return `sizeof(${firstName}${sep}${memberName})`;
    }

    // Check if first identifier is a global variable
    // If not a scope or enum, it's likely a global struct variable
    if (
      !CodeGenState.isKnownScope(firstName) &&
      !CodeGenState.isKnownEnum(firstName)
    ) {
      return `sizeof(${firstName}.${memberName})`;
    }

    // It's an actual type reference (Scope.Type), return null to fall through
    return null;
  }

  /**
   * Handle sizeof(identifier) - could be variable or type name
   */
  private static sizeofUserType(varName: string): string {
    // Check if it's a known parameter
    const paramInfo = CodeGenState.currentParameters.get(varName);
    if (paramInfo) {
      return this.sizeofParameter(varName, paramInfo);
    }

    // Check if it's a known local variable, struct type, or enum type
    // For all these cases, generate sizeof(name) directly
    // Unknown identifiers are also treated as variables for safety
    return `sizeof(${varName})`;
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
   * Throw E0601 error for sizeof on array parameter
   */
  private static throwArrayParamSizeofError(varName: string): never {
    throw new Error(
      `Error[E0601]: sizeof() on array parameter '${varName}' returns pointer size. ` +
        `Use ${varName}.length for element count or sizeof(elementType) * ${varName}.length for bytes`,
    );
  }

  /**
   * Handle sizeof(expression) with validation
   */
  private static sizeofExpression(
    expr: Parser.ExpressionContext,
    callbacks: ISizeofCallbacks,
  ): string {
    // E0601: Check if expression is an array parameter
    const varName = ExpressionUnwrapper.getSimpleIdentifier(expr);
    if (varName) {
      const paramInfo = CodeGenState.currentParameters.get(varName);
      if (paramInfo?.isArray) {
        this.throwArrayParamSizeofError(varName);
      }
    }

    // E0602: Check for side effects
    if (callbacks.hasSideEffects(expr)) {
      throw new Error(
        `Error[E0602]: sizeof() operand must not have side effects (MISRA C:2012 Rule 13.6)`,
      );
    }

    return `sizeof(${callbacks.generateExpression(expr)})`;
  }
}
