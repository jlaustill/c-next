/**
 * Helper module for building member access chains with proper separators.
 *
 * This module extracts the shared logic for building member access chains
 * like `conf->tempInputs[idx].assignedSpn` from both read and write contexts.
 *
 * ADR-006: Struct parameters need -> access (passed by pointer in C)
 * ADR-016: Cross-scope access uses _ separator
 */

import { ParseTree } from "antlr4ng";

/**
 * Options for determining the separator between the first identifier and
 * the first member in a member access chain.
 */
interface SeparatorOptions {
  /** Whether the first identifier is a struct parameter (needs -> in C) */
  isStructParam: boolean;
  /** Whether the first identifier is a cross-scope access (needs _ in C) */
  isCrossScope: boolean;
}

/**
 * Determines the separator to use between the first identifier and the first member.
 *
 * @param options - The separator options
 * @param idIndex - The current identifier index (1 = first member after base)
 * @returns The separator string: "->" for struct params, "_" for cross-scope, "." otherwise
 */
function determineSeparator(
  options: SeparatorOptions,
  idIndex: number,
): string {
  // Only the first separator (idIndex === 1) can be special
  if (idIndex !== 1) {
    return ".";
  }

  // ADR-006: Struct parameters are passed as pointers, need -> access
  if (options.isStructParam) {
    return "->";
  }

  // ADR-016: Cross-scope access uses underscore (scope_member)
  if (options.isCrossScope) {
    return "_";
  }

  return ".";
}

/**
 * Result of building a member access chain.
 */
interface MemberAccessChainResult {
  /** The generated C code for the member access chain */
  code: string;
  /** Number of identifiers consumed */
  identifiersConsumed: number;
  /** Number of expressions (subscripts) consumed */
  expressionsConsumed: number;
}

/**
 * Callback type for generating expression code from subscript expressions.
 */
type ExpressionGenerator<TExpr> = (expr: TExpr) => string;

/**
 * Callback type for checking if a type is a known struct.
 */
type StructChecker = (typeName: string) => boolean;

/**
 * Type tracking state while walking a member access chain.
 */
interface TypeTrackingState {
  /** Current struct type being accessed (undefined if not in a struct) */
  currentStructType: string | undefined;
  /** Type of the last accessed member */
  lastMemberType: string | undefined;
  /** Whether the last accessed member is an array field */
  lastMemberIsArray: boolean;
}

/**
 * Callbacks for type tracking while building the chain.
 */
interface TypeTrackingCallbacks {
  /** Get the fields map for a struct type */
  getStructFields: (structType: string) => Map<string, string> | undefined;
  /** Get the array fields set for a struct type */
  getStructArrayFields: (structType: string) => Set<string> | undefined;
  /** Check if a type name is a known struct */
  isKnownStruct: StructChecker;
}

/**
 * Options for building a member access chain.
 */
interface BuildChainOptions<TExpr> {
  /** The first identifier (base of the chain) */
  firstId: string;
  /** All identifier names in the chain */
  identifiers: string[];
  /** Subscript expressions */
  expressions: TExpr[];
  /** Parse tree children for walking */
  children: ParseTree[];
  /** Separator options (struct param, cross-scope) */
  separatorOptions: SeparatorOptions;
  /** Function to generate code from an expression */
  generateExpression: ExpressionGenerator<TExpr>;
  /** Optional: Initial type info for type tracking */
  initialTypeInfo?: {
    isArray: boolean;
    baseType: string;
  };
  /** Optional: Type tracking callbacks for bit access detection */
  typeTracking?: TypeTrackingCallbacks;
  /** Optional: Callback when bit access is detected on last subscript */
  onBitAccess?: (
    result: string,
    bitIndex: string,
    memberType: string,
  ) => string | null;
}

/**
 * Builds a member access chain with proper separators and subscripts.
 *
 * This function walks through the parse tree children in order, building
 * the C code string incrementally. It handles:
 * - Struct parameter access (-> separator)
 * - Cross-scope access (_ separator)
 * - Array subscripts
 * - Optional type tracking for bit access detection
 *
 * @param options - The build options
 * @returns The result containing the generated code and consumption counts
 */
function buildMemberAccessChain<TExpr>(
  options: BuildChainOptions<TExpr>,
): MemberAccessChainResult {
  const {
    firstId,
    identifiers,
    expressions,
    children,
    separatorOptions,
    generateExpression,
    initialTypeInfo,
    typeTracking,
    onBitAccess,
  } = options;

  let result = firstId;
  let idIndex = 1; // Start at 1 since we already have firstId
  let exprIndex = 0;

  // Initialize type tracking state
  let typeState: TypeTrackingState | undefined;
  if (typeTracking && initialTypeInfo) {
    typeState = {
      currentStructType: typeTracking.isKnownStruct(initialTypeInfo.baseType)
        ? initialTypeInfo.baseType
        : undefined,
      lastMemberType: undefined,
      lastMemberIsArray: false,
    };
  }

  let i = 1;
  while (i < children.length) {
    const childText = children[i].getText();

    if (childText === ".") {
      // Dot found - consume it, then get the next identifier
      i++;
      if (i < children.length && idIndex < identifiers.length) {
        const memberName = identifiers[idIndex];
        const separator = determineSeparator(separatorOptions, idIndex);
        result += `${separator}${memberName}`;
        idIndex++;

        // Update type tracking for the member we just accessed
        if (typeState && typeTracking && typeState.currentStructType) {
          const fields = typeTracking.getStructFields(
            typeState.currentStructType,
          );
          typeState.lastMemberType = fields?.get(memberName);

          const arrayFields = typeTracking.getStructArrayFields(
            typeState.currentStructType,
          );
          typeState.lastMemberIsArray = arrayFields?.has(memberName) ?? false;

          // Check if this member is itself a struct
          if (
            typeState.lastMemberType &&
            typeTracking.isKnownStruct(typeState.lastMemberType)
          ) {
            typeState.currentStructType = typeState.lastMemberType;
          } else {
            typeState.currentStructType = undefined;
          }
        }
      }
    } else if (childText === "[") {
      // Opening bracket - handle subscript

      // Check for bit access on primitive integer (if type tracking enabled)
      if (typeState && onBitAccess) {
        const isPrimitiveInt =
          typeState.lastMemberType &&
          !typeState.lastMemberIsArray &&
          ["u8", "u16", "u32", "u64", "i8", "i16", "i32", "i64"].includes(
            typeState.lastMemberType,
          );
        const isLastExpr = exprIndex === expressions.length - 1;

        if (isPrimitiveInt && isLastExpr && exprIndex < expressions.length) {
          const bitIndex = generateExpression(expressions[exprIndex]);
          const bitResult = onBitAccess(
            result,
            bitIndex,
            typeState.lastMemberType!,
          );
          if (bitResult !== null) {
            return {
              code: bitResult,
              identifiersConsumed: idIndex,
              expressionsConsumed: exprIndex + 1,
            };
          }
        }
      }

      // Normal array subscript
      if (exprIndex < expressions.length) {
        const expr = generateExpression(expressions[exprIndex]);
        result += `[${expr}]`;
        exprIndex++;

        // After subscripting an array, update type tracking
        if (
          typeState &&
          typeTracking &&
          initialTypeInfo?.isArray &&
          exprIndex === 1
        ) {
          // First subscript on array - element type might be a struct
          if (typeTracking.isKnownStruct(initialTypeInfo.baseType)) {
            typeState.currentStructType = initialTypeInfo.baseType;
          }
        }
      }

      // Skip forward to find and pass the closing bracket
      while (i < children.length && children[i].getText() !== "]") {
        i++;
      }

      // Reset lastMemberType after subscript (no longer on a member)
      if (typeState) {
        typeState.lastMemberType = undefined;
      }
    }
    i++;
  }

  return {
    code: result,
    identifiersConsumed: idIndex,
    expressionsConsumed: exprIndex,
  };
}

export default { determineSeparator, buildMemberAccessChain };
