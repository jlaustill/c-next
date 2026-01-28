/**
 * Dependencies provided to assignment handlers (ADR-109).
 *
 * Handlers need access to various CodeGenerator capabilities without
 * taking a direct dependency on the full CodeGenerator class. This
 * interface defines the subset of functionality handlers need.
 */
import * as Parser from "../../../antlr_parser/grammar/CNextParser";
import ISymbolInfo from "../../generators/ISymbolInfo";
import TTypeInfo from "../../types/TTypeInfo";
import ITargetCapabilities from "../../types/ITargetCapabilities";

/**
 * Dependencies for assignment handlers.
 *
 * These are provided by CodeGenerator to enable handlers to:
 * - Look up type information
 * - Access symbol tables
 * - Generate expressions
 * - Track side effects (needsString, clampOps)
 */
interface IHandlerDeps {
  // === Symbol information ===

  /** Read-only symbol info (registers, bitmaps, structs, etc.) */
  readonly symbols: ISymbolInfo;

  /** Type registry: variable name -> type info */
  readonly typeRegistry: ReadonlyMap<string, TTypeInfo>;

  /** Current scope name (for this.* resolution), null if not in scope */
  readonly currentScope: string | null;

  /** Parameters of current function */
  readonly currentParameters: ReadonlyMap<
    string,
    { isStruct?: boolean; isArray?: boolean }
  >;

  /** Target platform capabilities */
  readonly targetCapabilities: ITargetCapabilities;

  // === Expression generation ===

  /**
   * Generate C code for an expression.
   */
  generateExpression(ctx: Parser.ExpressionContext): string;

  /**
   * Try to evaluate an expression as a compile-time constant.
   * Returns undefined if not a constant.
   */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined;

  /**
   * Generate the C target string for an assignment target.
   */
  generateAssignmentTarget(ctx: Parser.AssignmentTargetContext): string;

  // === Type checking ===

  /**
   * Check if a type name is a known struct.
   */
  isKnownStruct(typeName: string): boolean;

  /**
   * Check if a name is a known scope.
   */
  isKnownScope(name: string): boolean;

  /**
   * Get member type info for a struct field.
   */
  getMemberTypeInfo(structType: string, memberName: string): TTypeInfo | null;

  // === Validation ===

  /**
   * Validate bitmap field literal fits in field width.
   */
  validateBitmapFieldLiteral(
    expr: Parser.ExpressionContext,
    width: number,
    fieldName: string,
  ): void;

  /**
   * Validate cross-scope visibility for member access.
   */
  validateCrossScopeVisibility(scopeName: string, memberName: string): void;

  /**
   * Check array bounds for compile-time constant indices.
   */
  checkArrayBounds(
    arrayName: string,
    dimensions: readonly number[],
    indexExprs: readonly Parser.ExpressionContext[],
    line: number,
  ): void;

  /**
   * Analyze a member chain target for bit access.
   * Returns { isBitAccess: false } if not bit access.
   * Returns { isBitAccess: true, baseTarget, bitIndex, baseType } if bit access detected.
   */
  analyzeMemberChainForBitAccess(targetCtx: Parser.AssignmentTargetContext): {
    isBitAccess: boolean;
    baseTarget?: string;
    bitIndex?: string;
    baseType?: string;
  };

  // === Side effects ===

  /**
   * Mark that string.h is needed (for strncpy, memcpy).
   */
  markNeedsString(): void;

  /**
   * Mark that a clamp operation helper is used.
   */
  markClampOpUsed(op: string, typeName: string): void;

  // === Atomic operations ===

  /**
   * Generate atomic read-modify-write operation.
   */
  generateAtomicRMW(
    target: string,
    cOp: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string;
}

export default IHandlerDeps;
