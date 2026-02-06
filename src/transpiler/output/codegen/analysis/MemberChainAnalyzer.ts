/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 * Refactored to delegate to buildMemberAccessChain to eliminate code duplication.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - point.x[3, 4] - detects bit range access on integer field
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TTypeInfo from "../types/TTypeInfo.js";
import memberAccessChain from "../memberAccessChain.js";

/**
 * Result of analyzing a member chain for bit access.
 */
interface IBitAccessAnalysisResult {
  /** True if the last subscript is bit access on an integer */
  isBitAccess: boolean;
  /** The base target expression (without bit index) */
  baseTarget?: string;
  /** The bit index expression */
  bitIndex?: string;
  /** The base type of the target */
  baseType?: string;
}

/**
 * Dependencies required for member chain analysis.
 */
interface IMemberChainAnalyzerDeps {
  /** Type registry for looking up variable types */
  typeRegistry: ReadonlyMap<string, TTypeInfo>;
  /** Struct field types by struct name */
  structFields: ReadonlyMap<string, ReadonlyMap<string, string>>;
  /** Struct field array flags by struct name */
  structFieldArrays: ReadonlyMap<string, ReadonlySet<string>>;
  /** Function to check if a type name is a known struct */
  isKnownStruct: (name: string) => boolean;
  /** Function to generate expression code */
  generateExpression: (ctx: Parser.ExpressionContext) => string;
}

/**
 * Analyzes member access chains to detect bit access patterns.
 *
 * Delegates to buildMemberAccessChain with type tracking and bit access
 * detection callbacks to determine if the final subscript is bit access.
 */
class MemberChainAnalyzer {
  private readonly deps: IMemberChainAnalyzerDeps;

  constructor(deps: IMemberChainAnalyzerDeps) {
    this.deps = deps;
  }

  /**
   * Analyze a member chain target to detect bit access at the end.
   *
   * For patterns like grid[2][3].flags[0], detects that [0] is bit access.
   * Delegates to buildMemberAccessChain which handles the tree-walking and
   * type tracking logic.
   *
   * @param targetCtx - The assignment target context to analyze
   * @returns Analysis result with bit access information
   */
  analyze(targetCtx: Parser.AssignmentTargetContext): IBitAccessAnalysisResult {
    const memberAccessCtx = targetCtx.memberAccess();
    if (!memberAccessCtx) {
      return { isBitAccess: false };
    }

    const parts = memberAccessCtx.IDENTIFIER().map((id) => id.getText());
    const expressions = memberAccessCtx.expression();
    const children = memberAccessCtx.children;

    if (!children || parts.length < 1 || expressions.length === 0) {
      return { isBitAccess: false };
    }

    const firstPart = parts[0];
    const firstTypeInfo = this.deps.typeRegistry.get(firstPart);

    // Track bit access result via callback
    let bitAccessResult: IBitAccessAnalysisResult | null = null;

    memberAccessChain.buildMemberAccessChain({
      firstId: firstPart,
      identifiers: parts,
      expressions,
      children,
      separatorOptions: {
        isStructParam: false,
        isCrossScope: false,
      },
      generateExpression: this.deps.generateExpression,
      initialTypeInfo: firstTypeInfo
        ? { isArray: firstTypeInfo.isArray, baseType: firstTypeInfo.baseType }
        : undefined,
      typeTracking: {
        getStructFields: (structType) => this.deps.structFields.get(structType),
        getStructArrayFields: (structType) =>
          this.deps.structFieldArrays.get(structType),
        isKnownStruct: this.deps.isKnownStruct,
      },
      onBitAccess: (baseTarget, bitIndex, memberType) => {
        bitAccessResult = {
          isBitAccess: true,
          baseTarget,
          bitIndex,
          baseType: memberType,
        };
        // Return non-null to signal early exit from buildMemberAccessChain
        return baseTarget;
      },
    });

    return bitAccessResult ?? { isBitAccess: false };
  }
}

export default MemberChainAnalyzer;
