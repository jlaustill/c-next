/**
 * Issue #579: Shared subscript classifier for array vs bit access
 *
 * This utility unifies the classification logic used by:
 * - AssignmentClassifier (assignment path)
 * - CodeGenerator._generatePostfixExpr (expression path)
 *
 * The classification rule is:
 * 1. If isArray or isString -> array access
 * 2. If isParameter && !isArray -> array access (parameter becomes pointer in C, ADR-006)
 * 3. Otherwise -> bit manipulation
 */
import TSubscriptKind from "./TSubscriptKind";
import TTypeInfo from "../types/TTypeInfo";

/**
 * Context needed for subscript classification
 */
interface ISubscriptContext {
  /** Type information for the variable being subscripted, null if unknown */
  typeInfo: TTypeInfo | null;
  /** Number of subscript expressions (1 for single index, 2 for range/slice) */
  subscriptCount: number;
  /** Whether this is a register access (registers always use bit manipulation) */
  isRegisterAccess?: boolean;
}

/**
 * Classifies subscript operations as array or bit access.
 *
 * This class provides a single source of truth for determining whether
 * a subscript operation like `x[i]` or `x[a, b]` should be treated as
 * array element access or bit manipulation.
 */
class SubscriptClassifier {
  /**
   * Classify a subscript operation.
   *
   * @param ctx - Classification context with type info and subscript count
   * @returns The kind of subscript operation (array or bit access)
   */
  static classify(ctx: ISubscriptContext): TSubscriptKind {
    const { typeInfo, subscriptCount, isRegisterAccess } = ctx;

    // Registers always use bit manipulation
    if (isRegisterAccess) {
      return subscriptCount === 2 ? "bit_range" : "bit_single";
    }

    // Check if this should be array access
    const isArrayAccess = SubscriptClassifier.isArrayAccess(typeInfo);

    if (isArrayAccess) {
      // Slice vs element access
      return subscriptCount === 2 ? "array_slice" : "array_element";
    }

    // Default: bit manipulation
    return subscriptCount === 2 ? "bit_range" : "bit_single";
  }

  /**
   * Determine if a type should use array access semantics.
   *
   * Array access is used when:
   * - Type is explicitly an array (isArray: true)
   * - Type is a string (strings are char arrays)
   * - Type is a non-array parameter (becomes pointer in C, ADR-006)
   *
   * @param typeInfo - Type information, or null if unknown
   * @returns true if subscript should be treated as array access
   */
  static isArrayAccess(typeInfo: TTypeInfo | null): boolean {
    if (!typeInfo) {
      // Unknown type - default to array access for safety
      // This matches the expression path's fallback behavior
      return true;
    }

    // Explicit array or string -> array access
    if (typeInfo.isArray || typeInfo.isString) {
      return true;
    }

    // Issue #579: Non-array parameter becomes pointer in C (ADR-006)
    // So buf[i] is array access, not bit access
    if (typeInfo.isParameter) {
      return true;
    }

    // Otherwise it's a scalar - use bit access
    return false;
  }
}

export default SubscriptClassifier;
