/**
 * Interface that CodeGenerator implements to orchestrate generators.
 *
 * Provides:
 * - Access to read-only input and current state
 * - Effect processing to update mutable state
 * - Utility methods needed by generators
 * - Code generation delegation methods
 *
 * This abstraction enables:
 * - Testing generators with mock orchestrators
 * - Gradual migration via "strangler fig" pattern
 */
import IGeneratorInput from "./IGeneratorInput";
import IGeneratorState from "./IGeneratorState";
import TGeneratorEffect from "./TGeneratorEffect";
import * as Parser from "../../parser/grammar/CNextParser";

interface IOrchestrator {
  // === State Access ===

  /** Get the immutable input context */
  getInput(): IGeneratorInput;

  /** Get a snapshot of the current generation state */
  getState(): IGeneratorState;

  // === Effect Processing ===

  /** Process effects returned by a generator, updating internal state */
  applyEffects(effects: readonly TGeneratorEffect[]): void;

  // === Utilities ===

  /** Get the current indentation string */
  getIndent(): string;

  /** Resolve an identifier to its fully-scoped name */
  resolveIdentifier(name: string): string;

  // === Code Generation Delegation ===
  // These methods delegate to CodeGenerator or registry for child node generation

  /** Generate C type from a type context */
  generateType(ctx: Parser.TypeContext): string;

  /** Generate C expression from an expression context */
  generateExpression(ctx: Parser.ExpressionContext): string;

  /** Generate C block (statements in braces) from a block context */
  generateBlock(ctx: Parser.BlockContext): string;

  /** Get the raw type name without C conversion */
  getTypeName(ctx: Parser.TypeContext): string;

  /** Generate array dimension suffix (e.g., "[10]" or "[10][20]") */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string;

  /** Generate single array dimension */
  generateArrayDimension(dim: Parser.ArrayDimensionContext): string;

  /** Generate parameter list for function signature */
  generateParameterList(ctx: Parser.ParameterListContext): string;

  // === Type Helpers ===

  /** Check if a type name is an integer type */
  isIntegerType(typeName: string): boolean;

  /** Check if a type name is a float type */
  isFloatType(typeName: string): boolean;

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined;

  /** Get zero initializer for a type (e.g., "0", "{0}", "false") */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string;

  // === Validation ===

  /** Validate that a literal value fits in the target type */
  validateLiteralFitsType(literal: string, typeName: string): void;

  /** Validate type conversion is allowed */
  validateTypeConversion(targetType: string, sourceType: string | null): void;

  // === String Helpers ===

  /** Get the length of a string literal (excluding quotes and null terminator) */
  getStringLiteralLength(literal: string): number;

  /** Get string concatenation operands if expression is a concat */
  getStringConcatOperands(ctx: Parser.ExpressionContext): {
    left: string;
    right: string;
    leftCapacity: number;
    rightCapacity: number;
  } | null;

  /** Get substring operands if expression is a substring call */
  getSubstringOperands(ctx: Parser.ExpressionContext): {
    source: string;
    start: string;
    length: string;
    sourceCapacity: number;
  } | null;

  /** Get the capacity of a string expression (for validation) */
  getStringExprCapacity(exprCode: string): number | null;

  /** Check if expression is an integer expression */
  isIntegerExpression(ctx: Parser.ExpressionContext): boolean;

  // === Parameter Management ===

  /** Set current function parameters for pointer semantics (ADR-006) */
  setParameters(paramList: Parser.ParameterListContext | null): void;

  /** Clear current function parameters */
  clearParameters(): void;

  /** Check if a callback type is used as a struct field type */
  isCallbackTypeUsedAsFieldType(funcName: string): boolean;

  // === Scope Management ===

  /** Set the current scope name for prefixing */
  setCurrentScope(name: string | null): void;

  // === Function Body Management ===

  /** Enter function body - clears local variables and sets inFunctionBody flag */
  enterFunctionBody(): void;

  /** Exit function body - clears local variables and inFunctionBody flag */
  exitFunctionBody(): void;

  /** Set the main function args parameter name for translation */
  setMainArgsName(name: string | null): void;

  /** Generate parameter list string */
  generateParameterList(ctx: Parser.ParameterListContext): string;

  /** Check if this is main function with args parameter */
  isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean;

  /** Generate callback typedef for a function */
  generateCallbackTypedef(funcName: string): string | null;
}

export default IOrchestrator;
