/**
 * Type Registration Engine
 * Issue #791: Extracted from CodeGenerator to reduce file size
 *
 * Registers variable types from AST before code generation.
 * This ensures type information is available for .length and
 * other type-dependent operations regardless of declaration order.
 */

import * as Parser from "../parser/grammar/CNextParser.js";
import TIncludeHeader from "../../output/codegen/generators/TIncludeHeader.js";

/**
 * Callbacks required for type registration.
 * Minimizes coupling to CodeGenerator.
 */
interface ITypeRegistrationCallbacks {
  /** Evaluate a compile-time constant expression */
  tryEvaluateConstant: (ctx: Parser.ExpressionContext) => number | undefined;
  /** Request an include header */
  requireInclude: (header: TIncludeHeader) => void;
}

/**
 * Static class that registers variable types from the AST.
 * Called during Stage 2 of code generation, before generating any code.
 */
class TypeRegistrationEngine {
  /**
   * Entry point: Register all variable types from the program tree.
   */
  static register(
    _tree: Parser.ProgramContext,
    _callbacks: ITypeRegistrationCallbacks,
  ): void {
    // TODO: Implement
  }

  /**
   * Parse array dimension from arrayType context.
   * Returns the numeric size, or undefined if not a simple integer literal.
   */
  static parseArrayTypeDimension(
    arrayTypeCtx: Parser.ArrayTypeContext,
  ): number | undefined {
    const dims = arrayTypeCtx.arrayTypeDimension();
    if (dims.length === 0) {
      return undefined;
    }
    const sizeExpr = dims[0].expression();
    if (!sizeExpr) {
      return undefined;
    }
    const size = Number.parseInt(sizeExpr.getText(), 10);
    return Number.isNaN(size) ? undefined : size;
  }

  /**
   * Resolve base type name from a type context.
   * Handles primitive, scoped (this.Type), global, qualified, and user types.
   * Returns null for special types like string<N> that need separate handling.
   */
  static resolveBaseType(
    typeCtx: Parser.TypeContext,
    currentScope: string | null,
  ): string | null {
    if (typeCtx.primitiveType()) {
      return typeCtx.primitiveType()!.getText();
    }

    if (typeCtx.scopedType()) {
      // ADR-016: Handle this.Type for scoped types (e.g., this.State -> Motor_State)
      const typeName = typeCtx.scopedType()!.IDENTIFIER().getText();
      return currentScope ? `${currentScope}_${typeName}` : typeName;
    }

    if (typeCtx.globalType()) {
      // Issue #478: Handle global.Type for global types inside scope
      return typeCtx.globalType()!.IDENTIFIER().getText();
    }

    if (typeCtx.qualifiedType()) {
      // ADR-016: Handle Scope.Type from outside scope
      const identifiers = typeCtx.qualifiedType()!.IDENTIFIER();
      return identifiers.map((id) => id.getText()).join("_");
    }

    if (typeCtx.userType()) {
      return typeCtx.userType()!.getText();
    }

    // String types and array types are handled separately
    return null;
  }
}

export default TypeRegistrationEngine;
