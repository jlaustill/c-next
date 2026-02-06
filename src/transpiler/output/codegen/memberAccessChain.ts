/**
 * Helper module for building member access chains with proper separators.
 *
 * This module extracts the shared logic for building member access chains
 * like `conf->tempInputs[idx].assignedSpn` from both read and write contexts.
 *
 * ADR-006: Struct parameters need -> access (passed by pointer in C),
 *          or . access (passed by reference in C++)
 * ADR-016: Cross-scope access uses _ separator
 */

import { ParseTree } from "antlr4ng";
import TypeCheckUtils from "../../../utils/TypeCheckUtils.js";

/**
 * Options for struct parameter access helpers.
 */
interface StructParamOptions {
  /** Whether we're in C++ mode (struct params are references) */
  cppMode: boolean;
}

/**
 * Get the member access separator for struct parameters.
 * C mode: -> (pointer), C++ mode: . (reference)
 *
 * @param options - The struct param options
 * @returns "->" for C mode, "." for C++ mode
 */
function getStructParamSeparator(options: StructParamOptions): string {
  return options.cppMode ? "." : "->";
}

/**
 * Wrap a struct parameter used as a whole value (not member access).
 * C mode: (*param) - dereference the pointer
 * C++ mode: param - reference can be used directly
 *
 * @param paramName - The parameter name
 * @param options - The struct param options
 * @returns The wrapped parameter expression
 */
function wrapStructParamValue(
  paramName: string,
  options: StructParamOptions,
): string {
  return options.cppMode ? paramName : `(*${paramName})`;
}

/**
 * Build member access for a struct parameter: param->a.b or param.a.b
 *
 * @param paramName - The struct parameter name
 * @param members - Array of member names to access (can be empty)
 * @param options - The struct param options
 * @returns The complete member access expression
 */
function buildStructParamMemberAccess(
  paramName: string,
  members: string[],
  options: StructParamOptions,
): string {
  if (members.length === 0) {
    return paramName;
  }
  const separator = getStructParamSeparator(options);
  return `${paramName}${separator}${members.join(".")}`;
}

/**
 * Options for determining the separator between the first identifier and
 * the first member in a member access chain.
 */
interface SeparatorOptions {
  /** Whether the first identifier is a struct parameter (needs -> in C, . in C++) */
  isStructParam: boolean;
  /** Whether the first identifier is a cross-scope access (needs _ in C) */
  isCrossScope: boolean;
  /** Whether we're in C++ mode (struct params are references, use . instead of ->) */
  cppMode?: boolean;
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

  // ADR-006: Struct parameters are passed as pointers in C (->), references in C++ (.)
  if (options.isStructParam) {
    return options.cppMode ? "." : "->";
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
  getStructFields: (
    structType: string,
  ) => ReadonlyMap<string, string> | undefined;
  /** Get the array fields set for a struct type */
  getStructArrayFields: (structType: string) => ReadonlySet<string> | undefined;
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
 * Initialize type tracking state from initial type info.
 */
function initializeTypeState(
  typeTracking: TypeTrackingCallbacks,
  initialTypeInfo: { isArray: boolean; baseType: string },
): TypeTrackingState {
  return {
    currentStructType: typeTracking.isKnownStruct(initialTypeInfo.baseType)
      ? initialTypeInfo.baseType
      : undefined,
    lastMemberType: undefined,
    lastMemberIsArray: false,
  };
}

/**
 * Update type tracking state after accessing a struct member.
 */
function updateTypeStateForMember(
  typeState: TypeTrackingState,
  typeTracking: TypeTrackingCallbacks,
  memberName: string,
): void {
  if (!typeState.currentStructType) {
    return;
  }

  const fields = typeTracking.getStructFields(typeState.currentStructType);
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

/**
 * Check if bit access applies and return the result if so.
 * Returns null if this is not a bit access scenario.
 */
function tryBitAccess<TExpr>(
  typeState: TypeTrackingState,
  exprIndex: number,
  expressions: TExpr[],
  generateExpression: ExpressionGenerator<TExpr>,
  result: string,
  idIndex: number,
  onBitAccess: (
    result: string,
    bitIndex: string,
    memberType: string,
  ) => string | null,
): MemberAccessChainResult | null {
  const isPrimitiveInt =
    typeState.lastMemberType &&
    !typeState.lastMemberIsArray &&
    TypeCheckUtils.isInteger(typeState.lastMemberType);
  const isLastExpr = exprIndex === expressions.length - 1;

  if (!isPrimitiveInt || !isLastExpr || exprIndex >= expressions.length) {
    return null;
  }

  const bitIndex = generateExpression(expressions[exprIndex]);
  const bitResult = onBitAccess(result, bitIndex, typeState.lastMemberType!);

  if (bitResult === null) {
    return null;
  }

  return {
    code: bitResult,
    identifiersConsumed: idIndex,
    expressionsConsumed: exprIndex + 1,
  };
}

/**
 * Update type tracking after first array subscript.
 */
function updateTypeStateForArraySubscript(
  typeState: TypeTrackingState,
  typeTracking: TypeTrackingCallbacks,
  initialTypeInfo: { isArray: boolean; baseType: string },
  exprIndex: number,
): void {
  if (!initialTypeInfo.isArray || exprIndex !== 1) {
    return;
  }
  // First subscript on array - element type might be a struct
  if (typeTracking.isKnownStruct(initialTypeInfo.baseType)) {
    typeState.currentStructType = initialTypeInfo.baseType;
  }
}

/**
 * Skip to the closing bracket in children array.
 * Returns the new index position.
 */
function skipToClosingBracket(
  children: ParseTree[],
  startIndex: number,
): number {
  let i = startIndex;
  while (i < children.length && children[i].getText() !== "]") {
    i++;
  }
  return i;
}

/**
 * State passed between chain building iterations.
 */
interface ChainBuildState<TExpr> {
  result: string;
  idIndex: number;
  exprIndex: number;
  typeState: TypeTrackingState | undefined;
  options: BuildChainOptions<TExpr>;
}

/**
 * Handle dot (.) member access in the chain.
 * Returns the new child index.
 */
function handleDotAccess<TExpr>(
  state: ChainBuildState<TExpr>,
  childIndex: number,
): number {
  const { identifiers, separatorOptions, typeTracking } = state.options;
  const children = state.options.children;

  // Consume the dot
  let i = childIndex + 1;

  if (i < children.length && state.idIndex < identifiers.length) {
    const memberName = identifiers[state.idIndex];
    const separator = determineSeparator(separatorOptions, state.idIndex);
    state.result += `${separator}${memberName}`;
    state.idIndex++;

    if (state.typeState && typeTracking) {
      updateTypeStateForMember(state.typeState, typeTracking, memberName);
    }
  }

  return i;
}

/**
 * Handle bracket ([) subscript access in the chain.
 * Returns either a bit access result (early exit) or null to continue.
 */
function handleBracketAccess<TExpr>(
  state: ChainBuildState<TExpr>,
  childIndex: number,
):
  | { result: MemberAccessChainResult; newIndex: number }
  | { newIndex: number } {
  const {
    expressions,
    generateExpression,
    initialTypeInfo,
    typeTracking,
    onBitAccess,
    children,
  } = state.options;

  // Check for bit access on primitive integer (if type tracking enabled)
  if (state.typeState && onBitAccess) {
    const bitAccessResult = tryBitAccess(
      state.typeState,
      state.exprIndex,
      expressions,
      generateExpression,
      state.result,
      state.idIndex,
      onBitAccess,
    );
    if (bitAccessResult) {
      return { result: bitAccessResult, newIndex: childIndex };
    }
  }

  // Normal array subscript
  if (state.exprIndex < expressions.length) {
    const expr = generateExpression(expressions[state.exprIndex]);
    state.result += `[${expr}]`;
    state.exprIndex++;

    // After subscripting an array, update type tracking
    if (state.typeState && typeTracking && initialTypeInfo) {
      updateTypeStateForArraySubscript(
        state.typeState,
        typeTracking,
        initialTypeInfo,
        state.exprIndex,
      );
    }
  }

  // Skip forward to find and pass the closing bracket
  const newIndex = skipToClosingBracket(children, childIndex);

  // Reset lastMemberType after subscript (no longer on a member)
  if (state.typeState) {
    state.typeState.lastMemberType = undefined;
  }

  return { newIndex };
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
  const { firstId, children, initialTypeInfo, typeTracking } = options;

  const state: ChainBuildState<TExpr> = {
    result: firstId,
    idIndex: 1, // Start at 1 since we already have firstId
    exprIndex: 0,
    typeState:
      typeTracking && initialTypeInfo
        ? initializeTypeState(typeTracking, initialTypeInfo)
        : undefined,
    options,
  };

  let i = 1;
  while (i < children.length) {
    const childText = children[i].getText();

    if (childText === ".") {
      i = handleDotAccess(state, i);
    } else if (childText === "[") {
      const bracketResult = handleBracketAccess(state, i);
      if ("result" in bracketResult) {
        return bracketResult.result;
      }
      i = bracketResult.newIndex;
    }
    i++;
  }

  return {
    code: state.result,
    identifiersConsumed: state.idIndex,
    expressionsConsumed: state.exprIndex,
  };
}

export default {
  determineSeparator,
  buildMemberAccessChain,
  getStructParamSeparator,
  wrapStructParamValue,
  buildStructParamMemberAccess,
};
