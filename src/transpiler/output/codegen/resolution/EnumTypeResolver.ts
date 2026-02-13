/**
 * EnumTypeResolver - Handles enum type inference from expressions
 *
 * Extracted from CodeGenerator to reduce complexity.
 * Uses CodeGenState for all state access.
 *
 * ADR-017: Extract enum type from expressions for type-safe comparisons.
 * Handles patterns:
 * - Variable of enum type: `currentState` -> 'State'
 * - Enum member access: `State.IDLE` -> 'State'
 * - Scoped enum member: `Motor.State.IDLE` -> 'Motor_State'
 * - ADR-016: this.State.IDLE -> 'CurrentScope_State'
 * - ADR-016: this.variable -> enum type if variable is of enum type
 * - Function calls returning enum types
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser";
import CodeGenState from "../../../state/CodeGenState";
import TypeResolver from "../TypeResolver";
import ExpressionUnwrapper from "../utils/ExpressionUnwrapper";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";

/**
 * Resolves enum types from expressions.
 * All methods are static - uses CodeGenState for state access.
 */
export default class EnumTypeResolver {
  /**
   * Extract enum type from an expression.
   * Returns the enum type name if the expression is an enum value, null otherwise.
   */
  static resolve(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    const text = ctx.getText();

    // Check if it's a function call returning an enum
    const enumReturnType = this.getFunctionCallEnumType(text);
    if (enumReturnType) {
      return enumReturnType;
    }

    // Check if it's a simple identifier that's an enum variable
    if (/^[a-zA-Z_]\w*$/.exec(text)) {
      const typeInfo = CodeGenState.getVariableTypeInfo(text);
      if (typeInfo?.isEnum && typeInfo.enumTypeName) {
        return typeInfo.enumTypeName;
      }
    }

    // Check member access patterns: EnumType.MEMBER, Scope.EnumType.MEMBER, etc.
    const memberResult = this.getEnumTypeFromMemberAccess(text.split("."));
    if (memberResult) {
      return memberResult;
    }

    // Fallback: use TypeResolver to resolve the full expression type through
    // struct member chains (e.g. global.config.inputs[0].assignedValue -> EValueId)
    return this.resolveViaTypeResolver(ctx);
  }

  /**
   * Fallback resolution via TypeResolver for complex expressions.
   * Handles struct member chains like global.struct.field that resolve to enum types.
   */
  private static resolveViaTypeResolver(
    ctx: Parser.ExpressionContext | Parser.RelationalExpressionContext,
  ): string | null {
    // ExpressionContext has getPostfixExpression, RelationalExpressionContext does not
    if (!("ternaryExpression" in ctx)) {
      return null;
    }
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) {
      return null;
    }
    const resolvedType = TypeResolver.getPostfixExpressionType(postfix);
    if (resolvedType && CodeGenState.isKnownEnum(resolvedType)) {
      return resolvedType;
    }
    return null;
  }

  /**
   * Check if parts represent an enum member access and return the enum type.
   */
  private static getEnumTypeFromMemberAccess(parts: string[]): string | null {
    if (parts.length < 2) {
      return null;
    }

    // ADR-016: Check this.State.IDLE pattern
    const thisEnumType = this.getEnumTypeFromThisEnum(parts);
    if (thisEnumType) return thisEnumType;

    // Issue #478: Check global.Enum.Member pattern
    const globalEnumType = this.getEnumTypeFromGlobalEnum(parts);
    if (globalEnumType) return globalEnumType;

    // ADR-016: Check this.variable pattern
    const thisVarType = this.getEnumTypeFromThisVariable(parts);
    if (thisVarType) return thisVarType;

    // Check simple enum: State.IDLE
    const possibleEnum = parts[0];
    if (CodeGenState.isKnownEnum(possibleEnum)) {
      return possibleEnum;
    }

    // Check scoped enum: Motor.State.IDLE -> Motor_State
    return this.getEnumTypeFromScopedEnum(parts);
  }

  /**
   * ADR-016: Check this.State.IDLE pattern (this.Enum.Member inside scope)
   */
  private static getEnumTypeFromThisEnum(parts: string[]): string | null {
    if (parts[0] !== "this" || !CodeGenState.currentScope || parts.length < 3) {
      return null;
    }
    const enumName = parts[1];
    const scopedEnumName = `${CodeGenState.currentScope}_${enumName}`;
    return CodeGenState.isKnownEnum(scopedEnumName) ? scopedEnumName : null;
  }

  /**
   * Issue #478: Check global.Enum.Member pattern (global.ECategory.CAT_A)
   */
  private static getEnumTypeFromGlobalEnum(parts: string[]): string | null {
    if (parts[0] !== "global" || parts.length < 3) {
      return null;
    }
    const enumName = parts[1];
    return CodeGenState.isKnownEnum(enumName) ? enumName : null;
  }

  /**
   * ADR-016: Check this.variable pattern (this.varName where varName is enum type)
   */
  private static getEnumTypeFromThisVariable(parts: string[]): string | null {
    if (
      parts[0] !== "this" ||
      !CodeGenState.currentScope ||
      parts.length !== 2
    ) {
      return null;
    }
    const varName = parts[1];
    const scopedVarName = `${CodeGenState.currentScope}_${varName}`;
    const typeInfo = CodeGenState.getVariableTypeInfo(scopedVarName);
    if (typeInfo?.isEnum && typeInfo.enumTypeName) {
      return typeInfo.enumTypeName;
    }
    return null;
  }

  /**
   * Check scoped enum: Motor.State.IDLE -> Motor_State
   */
  private static getEnumTypeFromScopedEnum(parts: string[]): string | null {
    if (parts.length < 3) {
      return null;
    }
    const scopeName = parts[0];
    const enumName = parts[1];
    const scopedEnumName = QualifiedNameGenerator.forMember(
      scopeName,
      enumName,
    );
    return CodeGenState.isKnownEnum(scopedEnumName) ? scopedEnumName : null;
  }

  /**
   * Check if an expression is a function call returning an enum type.
   * Handles patterns:
   * - func() or func(args) - global function
   * - Scope.method() or Scope.method(args) - scope method from outside
   * - this.method() or this.method(args) - scope method from inside
   * - global.func() or global.func(args) - global function from inside scope
   * - global.Scope.method() or global.Scope.method(args) - scope method from inside another scope
   */
  private static getFunctionCallEnumType(text: string): string | null {
    // Check if this looks like a function call (contains parentheses)
    const parenIndex = text.indexOf("(");
    if (parenIndex === -1) {
      return null;
    }

    // Extract the function reference (everything before the opening paren)
    const funcRef = text.substring(0, parenIndex);
    const parts = funcRef.split(".");

    let fullFuncName: string | null = null;

    if (parts.length === 1) {
      // Simple function call: func()
      fullFuncName = parts[0];
    } else if (parts.length === 2) {
      if (parts[0] === "this" && CodeGenState.currentScope) {
        // this.method() -> Scope_method
        fullFuncName = `${CodeGenState.currentScope}_${parts[1]}`;
      } else if (parts[0] === "global") {
        // global.func() -> func
        fullFuncName = parts[1];
      } else if (CodeGenState.isKnownScope(parts[0])) {
        // Scope.method() -> Scope_method
        fullFuncName = `${parts[0]}_${parts[1]}`;
      }
    } else if (parts.length === 3) {
      if (parts[0] === "global" && CodeGenState.isKnownScope(parts[1])) {
        // global.Scope.method() -> Scope_method
        fullFuncName = `${parts[1]}_${parts[2]}`;
      }
    }

    if (!fullFuncName) {
      return null;
    }

    // Look up the function's return type
    const returnType = CodeGenState.getFunctionReturnType(fullFuncName);
    if (!returnType) {
      return null;
    }

    // Check if the return type is an enum
    if (CodeGenState.isKnownEnum(returnType)) {
      return returnType;
    }

    return null;
  }
}
