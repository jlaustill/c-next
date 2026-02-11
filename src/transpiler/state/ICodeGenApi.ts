/**
 * Interface for CodeGenerator methods accessible via CodeGenState.generator.
 *
 * This interface breaks the circular dependency between CodeGenState and CodeGenerator
 * by defining only the method signatures needed by handlers and helpers.
 */
import type TTypeInfo from "../output/codegen/types/TTypeInfo";

interface ICodeGenApi {
  /** Generate C expression from AST context */
  generateExpression(ctx: unknown): string;

  /** Generate assignment target (lvalue) from AST context */
  generateAssignmentTarget(ctx: unknown): string;

  /** Try to evaluate expression as compile-time constant */
  tryEvaluateConstant(ctx: unknown): number | undefined;

  /** Generate atomic read-modify-write operation */
  generateAtomicRMW(
    target: string,
    op: string,
    value: string,
    typeInfo: TTypeInfo,
  ): string;

  /** Generate float bit write operation (returns null if not applicable) */
  generateFloatBitWrite(
    name: string,
    typeInfo: TTypeInfo,
    bitIndex: string,
    width: string | null,
    value: string,
  ): string | null;

  /** Validate cross-scope member visibility */
  validateCrossScopeVisibility(scopeName: string, memberName: string): void;

  /** Analyze member chain for bit access patterns */
  analyzeMemberChainForBitAccess(ctx: unknown): {
    isBitAccess: boolean;
    baseTarget?: string;
    bitIndex?: string;
    baseType?: string;
  };

  /** Get type info for struct member */
  getMemberTypeInfo(structType: string, fieldName: string): TTypeInfo | null;

  /** Check if name is a known scope */
  isKnownScope(name: string): boolean;

  /** Check if name is a known struct */
  isKnownStruct(name: string): boolean;
}

export default ICodeGenApi;
