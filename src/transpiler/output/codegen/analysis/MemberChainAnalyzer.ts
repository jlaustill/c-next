/**
 * MemberChainAnalyzer - Analyzes member access chains for bit access patterns
 *
 * Issue #644: Extracted from CodeGenerator to reduce file size.
 *
 * Used to detect bit access at the end of member chains, e.g.:
 * - grid[2][3].flags[0] - detects that [0] is bit access on flags
 * - point.x[3, 4] - detects bit range access on integer field
 */

import * as Parser from "../../../logic/parser/grammar/CNextParser.js";
import TypeCheckUtils from "../../../../utils/TypeCheckUtils.js";
import TTypeInfo from "../types/TTypeInfo.js";

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
 * Uses tree-walking to track types through member chains and determine
 * if the final subscript operation is array indexing or bit access.
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
   * Uses the same tree-walking approach as generateMemberAccess to correctly
   * track which expressions belong to which identifiers in the chain.
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

    // Walk the parse tree to determine if the LAST expression is bit access
    // This mirrors the logic in generateMemberAccess
    const firstPart = parts[0];
    const firstTypeInfo = this.deps.typeRegistry.get(firstPart);

    let currentStructType: string | undefined;
    if (firstTypeInfo) {
      currentStructType = this.deps.isKnownStruct(firstTypeInfo.baseType)
        ? firstTypeInfo.baseType
        : undefined;
    }

    let result = firstPart;
    let idIndex = 1;
    let exprIndex = 0;
    let lastMemberType: string | undefined;
    let lastMemberIsArray = false;

    let i = 1;
    while (i < children.length) {
      const childText = children[i].getText();

      if (childText === ".") {
        // Dot - next child is identifier
        i++;
        if (i < children.length && idIndex < parts.length) {
          const memberName = parts[idIndex];
          result += `.${memberName}`;
          idIndex++;

          // Update type tracking
          if (currentStructType) {
            const fields = this.deps.structFields.get(currentStructType);
            lastMemberType = fields?.get(memberName);
            const arrayFields =
              this.deps.structFieldArrays.get(currentStructType);
            lastMemberIsArray = arrayFields?.has(memberName) ?? false;

            if (lastMemberType && this.deps.isKnownStruct(lastMemberType)) {
              currentStructType = lastMemberType;
            } else {
              currentStructType = undefined;
            }
          }
        }
      } else if (childText === "[") {
        // Opening bracket - check if this is bit access
        const isPrimitiveInt =
          lastMemberType &&
          !lastMemberIsArray &&
          TypeCheckUtils.isInteger(lastMemberType);
        const isLastExpr = exprIndex === expressions.length - 1;

        if (isPrimitiveInt && isLastExpr && exprIndex < expressions.length) {
          // This is bit access on a struct member
          const bitIndex = this.deps.generateExpression(expressions[exprIndex]);
          return {
            isBitAccess: true,
            baseTarget: result,
            bitIndex,
            baseType: lastMemberType,
          };
        }

        // Normal array subscript
        if (exprIndex < expressions.length) {
          const expr = this.deps.generateExpression(expressions[exprIndex]);
          result += `[${expr}]`;
          exprIndex++;

          // After subscripting an array, update type tracking
          if (firstTypeInfo?.isArray && exprIndex === 1) {
            const elementType = firstTypeInfo.baseType;
            if (this.deps.isKnownStruct(elementType)) {
              currentStructType = elementType;
            }
          }
        }
        // Skip to closing bracket
        while (i < children.length && children[i].getText() !== "]") {
          i++;
        }
      }
      i++;
    }

    return { isBitAccess: false };
  }
}

export default MemberChainAnalyzer;
