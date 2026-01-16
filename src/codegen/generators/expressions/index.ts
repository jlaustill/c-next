/**
 * Expression Generators (ADR-053 A2)
 *
 * Modular expression generation extracted from CodeGenerator.ts.
 * Uses the "strangler fig" pattern for incremental migration.
 *
 * Files in this directory:
 * - ExpressionGenerator.ts - Entry point + ternary
 * - BinaryExprGenerator.ts - Binary operators chain
 * - UnaryExprGenerator.ts - Unary operators
 * - AccessExprGenerator.ts - Member/array access, .length
 * - CallExprGenerator.ts - Function calls
 * - LiteralGenerator.ts - Literals, sizeof, cast
 */

import generateLiteral from "./LiteralGenerator";

// Export all generators as a single object
const generators = {
  generateLiteral,
};

export default generators;
