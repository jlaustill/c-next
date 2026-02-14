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
}

export default TypeRegistrationEngine;
