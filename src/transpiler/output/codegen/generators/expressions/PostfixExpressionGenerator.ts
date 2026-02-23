/**
 * Postfix Expression Generator (Issue #644)
 *
 * Handles postfix expressions including:
 * - Member access (obj.field)
 * - Array subscripts (arr[i])
 * - Bit access (value[3] or value[0, 8])
 * - Function calls (func())
 * - Property access (.length, .capacity, .size)
 *
 * This generator was extracted from CodeGenerator._generatePostfixExpr
 * to reduce the size and complexity of CodeGenerator.ts.
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorOutput from "../IGeneratorOutput";
import TGeneratorEffect from "../TGeneratorEffect";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IOrchestrator from "../IOrchestrator";
import accessGenerators from "./AccessExprGenerator";
import generateFunctionCall from "./CallExprGenerator";
import memberAccessChain from "../../memberAccessChain";
import MemberAccessValidator from "../../helpers/MemberAccessValidator";
import BitmapAccessHelper from "./BitmapAccessHelper";
import NarrowingCastHelper from "../../helpers/NarrowingCastHelper";
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import SubscriptClassifier from "../../subscript/SubscriptClassifier";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import C_TYPE_WIDTH from "../../types/C_TYPE_WIDTH";
import TTypeInfo from "../../types/TTypeInfo";
import CodeGenState from "../../../../state/CodeGenState";

// ========================================================================
// Tracking State
// ========================================================================

/**
 * Mutable tracking state threaded through the postfix op loop.
 */
interface ITrackingState {
  result: string;
  isRegisterChain: boolean;
  currentMemberIsArray: boolean;
  currentStructType: string | undefined;
  previousStructType: string | undefined;
  previousMemberName: string | undefined;
  resolvedIdentifier: string | undefined;
  remainingArrayDims: number;
  subscriptDepth: number;
  isGlobalAccess: boolean;
  isCppAccessChain: boolean;
}

/**
 * Initialize tracking state from the primary expression.
 */
const initializeTrackingState = (
  rootIdentifier: string | undefined,
  result: string,
  primaryTypeInfo:
    | { baseType: string; arrayDimensions?: (number | string)[] }
    | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): ITrackingState => {
  const isRegisterChain = rootIdentifier
    ? input.symbols!.knownRegisters.has(rootIdentifier)
    : false;

  const primaryBaseType = rootIdentifier
    ? CodeGenState.getVariableTypeInfo(rootIdentifier)?.baseType
    : undefined;
  const currentStructType =
    primaryBaseType && orchestrator.isKnownStruct(primaryBaseType)
      ? primaryBaseType
      : undefined;

  const primaryParamInfo = rootIdentifier
    ? state.currentParameters.get(rootIdentifier)
    : undefined;
  const remainingArrayDims =
    primaryTypeInfo?.arrayDimensions?.length ??
    (primaryParamInfo?.isArray ? 1 : 0);

  let isCppAccessChain = false;
  if (rootIdentifier && orchestrator.isCppScopeSymbol(rootIdentifier)) {
    isCppAccessChain = true;
  }

  return {
    result,
    isRegisterChain,
    currentMemberIsArray: false,
    currentStructType,
    previousStructType: undefined,
    previousMemberName: undefined,
    resolvedIdentifier: rootIdentifier,
    remainingArrayDims,
    subscriptDepth: 0,
    isGlobalAccess: false,
    isCppAccessChain,
  };
};

/**
 * Context for the postfix expression being processed.
 * Bundles values that don't change during the postfix op loop,
 * except for `effects` which accumulates side effects via push().
 */
interface IPostfixContext {
  rootIdentifier: string | undefined;
  isStructParam: boolean;
  /** Issue #895: Force pointer semantics for callback-compatible params */
  forcePointerSemantics: boolean;
  input: IGeneratorInput;
  state: IGeneratorState;
  orchestrator: IOrchestrator;
  effects: TGeneratorEffect[];
}

// ========================================================================
// Main Entry Point
// ========================================================================

/**
 * Generate C code for a postfix expression.
 *
 * A postfix expression consists of a primary expression followed by
 * zero or more postfix operations (member access, subscripts, function calls).
 *
 * @param ctx - The postfix expression context
 * @param input - Generator input (type registry, symbols, etc.)
 * @param state - Generator state (current scope, parameters, etc.)
 * @param orchestrator - Orchestrator for callbacks into CodeGenerator
 * @returns Generated code and effects
 */
const generatePostfixExpression = (
  ctx: Parser.PostfixExpressionContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const effects: TGeneratorEffect[] = [];

  const primary = ctx.primaryExpression();
  const ops = ctx.postfixOp();

  // Check if this is a struct parameter - we may need to handle -> access
  const rootIdentifier = primary.IDENTIFIER()?.getText();
  const paramInfo = rootIdentifier
    ? state.currentParameters.get(rootIdentifier)
    : null;
  const isStructParam = paramInfo?.isStruct ?? false;
  // Issue #895: Callback-compatible params need pointer semantics even in C++ mode
  const forcePointerSemantics = paramInfo?.forcePointerSemantics ?? false;

  // Issue #579: Check if we have subscript access on a non-array parameter
  const hasSubscriptOps = ops.some((op) => op.expression().length > 0);
  const isNonArrayParamWithSubscript =
    paramInfo && !paramInfo.isArray && !paramInfo.isStruct && hasSubscriptOps;

  let result: string;
  if (isNonArrayParamWithSubscript) {
    result = rootIdentifier!;
  } else {
    result = orchestrator.generatePrimaryExpr(primary);
  }

  const primaryTypeInfo = rootIdentifier
    ? CodeGenState.getVariableTypeInfo(rootIdentifier)
    : undefined;

  const tracking = initializeTrackingState(
    rootIdentifier,
    result,
    primaryTypeInfo,
    input,
    state,
    orchestrator,
  );

  const postfixCtx: IPostfixContext = {
    rootIdentifier,
    isStructParam,
    forcePointerSemantics,
    input,
    state,
    orchestrator,
    effects,
  };

  for (const op of ops) {
    if (op.IDENTIFIER()) {
      const memberName = op.IDENTIFIER()!.getText();
      handleMemberOp(memberName, tracking, postfixCtx);
    } else if (op.expression().length > 0) {
      const subscriptResult = generateSubscriptAccess(
        {
          result: tracking.result,
          op,
          rootIdentifier,
          primaryTypeInfo,
          resolvedIdentifier: tracking.resolvedIdentifier,
          currentStructType: tracking.currentStructType,
          currentMemberIsArray: tracking.currentMemberIsArray,
          remainingArrayDims: tracking.remainingArrayDims,
          subscriptDepth: tracking.subscriptDepth,
          isRegisterChain: tracking.isRegisterChain,
        },
        input,
        state,
        orchestrator,
        effects,
      );

      tracking.result = subscriptResult.result;
      tracking.currentStructType = subscriptResult.currentStructType;
      tracking.currentMemberIsArray =
        subscriptResult.currentMemberIsArray ?? false;
      tracking.remainingArrayDims =
        subscriptResult.remainingArrayDims ?? tracking.remainingArrayDims;
      tracking.subscriptDepth =
        subscriptResult.subscriptDepth ?? tracking.subscriptDepth;
    } else {
      const callResult = generateFunctionCall(
        tracking.result,
        op.argumentList() || null,
        input,
        state,
        orchestrator,
      );
      applyAccessEffects(callResult.effects, effects);
      tracking.result = callResult.code;
    }
  }

  // ADR-006: If a struct parameter is used as a whole value (no postfix ops)
  // This applies to both normal struct params AND callback-promoted struct params.
  // When used as a value (assignments, etc.), we need to dereference to get the struct.
  // Issue #937: For function arguments expecting pointers, CallExprGenerator handles
  // using the identifier directly instead of the dereferenced form.
  if (isStructParam && ops.length === 0) {
    return {
      code: memberAccessChain.wrapStructParamValue(result, {
        cppMode: orchestrator.isCppMode(),
      }),
      effects,
    };
  }

  return { code: tracking.result, effects };
};

// ========================================================================
// Member Operation Handling
// ========================================================================

/**
 * Handle a member access operation (the `.identifier` part of postfix).
 * Mutates `tracking` in place.
 */
const handleMemberOp = (
  memberName: string,
  tracking: ITrackingState,
  ctx: IPostfixContext,
): void => {
  // ADR-016: Handle global. prefix
  if (
    handleGlobalPrefix(
      memberName,
      tracking,
      ctx.input,
      ctx.state,
      ctx.orchestrator,
    )
  ) {
    return;
  }

  // Issue #212: Check if 'length' is a scope variable before treating as property
  if (
    handleThisScopeLength(
      memberName,
      tracking,
      ctx.input,
      ctx.state,
      ctx.orchestrator,
    )
  ) {
    return;
  }

  // Handle property access (.length, .capacity, .size)
  if (
    tryPropertyAccess(
      memberName,
      tracking,
      ctx.rootIdentifier,
      ctx.input,
      ctx.state,
      ctx.orchestrator,
      ctx.effects,
    )
  ) {
    return;
  }

  // Handle bitmap field access, scope member access, enum member access, etc.
  const memberResult = generateMemberAccess(
    {
      result: tracking.result,
      memberName,
      rootIdentifier: ctx.rootIdentifier,
      isStructParam: ctx.isStructParam,
      forcePointerSemantics: ctx.forcePointerSemantics,
      isGlobalAccess: tracking.isGlobalAccess,
      isCppAccessChain: tracking.isCppAccessChain,
      currentStructType: tracking.currentStructType,
      resolvedIdentifier: tracking.resolvedIdentifier,
      previousStructType: tracking.previousStructType,
      previousMemberName: tracking.previousMemberName,
      isRegisterChain: tracking.isRegisterChain,
    },
    ctx.input,
    ctx.state,
    ctx.orchestrator,
    ctx.effects,
  );

  tracking.result = memberResult.result;
  tracking.resolvedIdentifier =
    memberResult.resolvedIdentifier ?? tracking.resolvedIdentifier;
  tracking.currentStructType = memberResult.currentStructType;
  tracking.currentMemberIsArray =
    memberResult.currentMemberIsArray ?? tracking.currentMemberIsArray;
  tracking.isRegisterChain =
    memberResult.isRegisterChain ?? tracking.isRegisterChain;
  tracking.isCppAccessChain =
    memberResult.isCppAccessChain ?? tracking.isCppAccessChain;
  tracking.previousStructType = memberResult.previousStructType;
  tracking.previousMemberName = memberResult.previousMemberName;
};

/**
 * Handle `global.X` prefix. Returns true if handled (caller should skip).
 */
const handleGlobalPrefix = (
  memberName: string,
  tracking: ITrackingState,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): boolean => {
  if (tracking.result !== "__GLOBAL_PREFIX__") {
    return false;
  }

  tracking.result = memberName;
  tracking.resolvedIdentifier = memberName;
  tracking.isGlobalAccess = true;

  // ADR-057: Check if global variable would be shadowed by a local
  if (state.localVariables.has(memberName)) {
    throw new Error(
      `Error: Cannot use 'global.${memberName}' when local variable '${memberName}' shadows it. ` +
        `Rename the local variable to avoid shadowing.`,
    );
  }

  if (orchestrator.isCppScopeSymbol(memberName)) {
    tracking.isCppAccessChain = true;
  }
  if (input.symbols!.knownRegisters.has(memberName)) {
    tracking.isRegisterChain = true;
  }

  // Issue #612: Set currentStructType for global struct variables
  const globalTypeInfo = CodeGenState.getVariableTypeInfo(memberName);
  if (globalTypeInfo && orchestrator.isKnownStruct(globalTypeInfo.baseType)) {
    tracking.currentStructType = globalTypeInfo.baseType;
  }

  return true;
};

/**
 * Handle `this.length` when length is a scope member variable.
 * Returns true if handled (caller should skip).
 */
const handleThisScopeLength = (
  memberName: string,
  tracking: ITrackingState,
  _input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): boolean => {
  if (tracking.result !== "__THIS_SCOPE__" || memberName !== "length") {
    return false;
  }
  if (!state.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }
  const members = state.scopeMembers.get(state.currentScope);
  if (!members?.has("length")) {
    return false;
  }

  tracking.result = `${state.currentScope}_${memberName}`;
  tracking.resolvedIdentifier = tracking.result;
  const resolvedTypeInfo = CodeGenState.getVariableTypeInfo(tracking.result);
  if (
    resolvedTypeInfo &&
    orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
  ) {
    tracking.currentStructType = resolvedTypeInfo.baseType;
  }
  return true;
};

/**
 * Resolve the TTypeInfo for .capacity/.size on the current expression.
 *
 * Tries in order:
 * 1. resolvedIdentifier (tracks the resolved identifier through member chains)
 * 2. rootIdentifier (the leftmost identifier)
 * 3. Struct field lookup via previousStructType/previousMemberName
 *    (handles alice.name.capacity where resolvedIdentifier is undefined)
 */
const resolveStringTypeInfo = (
  tracking: ITrackingState,
  rootIdentifier: string | undefined,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): TTypeInfo | undefined => {
  const identifier = tracking.resolvedIdentifier ?? rootIdentifier;
  const typeInfo = identifier
    ? CodeGenState.getVariableTypeInfo(identifier)
    : undefined;
  if (typeInfo?.isString) {
    return typeInfo;
  }

  // Struct member path: look up the field type to build a synthetic TTypeInfo
  if (tracking.previousStructType && tracking.previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      tracking.previousStructType,
      tracking.previousMemberName,
    );
    if (fieldInfo && TypeCheckUtils.isString(fieldInfo.type)) {
      const capacityMatch = /^string<(\d+)>$/.exec(fieldInfo.type);
      const capacity = capacityMatch ? Number(capacityMatch[1]) : undefined;
      return {
        baseType: "char",
        bitWidth: 8,
        isArray: false,
        isConst: false,
        isString: true,
        stringCapacity: capacity,
      } as TTypeInfo;
    }
  }

  return typeInfo;
};

/**
 * Create context object for explicit length property generators.
 */
const createExplicitLengthContext = (
  tracking: ITrackingState,
  rootIdentifier: string | undefined,
): IExplicitLengthContext => ({
  result: tracking.result,
  rootIdentifier,
  resolvedIdentifier: tracking.resolvedIdentifier,
  previousStructType: tracking.previousStructType,
  previousMemberName: tracking.previousMemberName,
  subscriptDepth: tracking.subscriptDepth,
});

/**
 * Apply property result to tracking state.
 */
const applyPropertyResult = (
  tracking: ITrackingState,
  result: string,
): void => {
  tracking.result = result;
  tracking.previousStructType = undefined;
  tracking.previousMemberName = undefined;
};

/**
 * Try handling explicit length property (ADR-058).
 * Returns true if handled.
 */
const tryExplicitLengthProperty = (
  memberName: string,
  tracking: ITrackingState,
  rootIdentifier: string | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): boolean => {
  const ctx = createExplicitLengthContext(tracking, rootIdentifier);

  let result: string | null = null;
  switch (memberName) {
    case "bit_length":
      result = generateBitLengthProperty(ctx, input, state, orchestrator);
      break;
    case "byte_length":
      result = generateByteLengthProperty(ctx, input, state, orchestrator);
      break;
    case "element_count":
      result = generateElementCountProperty(ctx, input, state, orchestrator);
      break;
    case "char_count":
      result = generateCharCountProperty(
        ctx,
        input,
        state,
        orchestrator,
        effects,
      );
      break;
  }

  if (result !== null) {
    applyPropertyResult(tracking, result);
    return true;
  }
  return false;
};

/**
 * Try handling property access (.capacity, .size, .bit_length, .byte_length, .element_count, .char_count).
 * Returns true if handled.
 *
 * Note: .length was removed in favor of explicit properties (ADR-058).
 */
const tryPropertyAccess = (
  memberName: string,
  tracking: ITrackingState,
  rootIdentifier: string | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): boolean => {
  // ADR-058: .length is deprecated - use explicit properties instead
  if (memberName === "length") {
    throw new Error(
      `Error: '.length' on '${tracking.result}' is deprecated. Use explicit properties: ` +
        `.bit_length (bit width), .byte_length (byte size), ` +
        `.element_count (array size), or .char_count (string length)`,
    );
  }

  // ADR-058: Explicit length properties
  const explicitProps = new Set([
    "bit_length",
    "byte_length",
    "element_count",
    "char_count",
  ]);
  if (explicitProps.has(memberName)) {
    return tryExplicitLengthProperty(
      memberName,
      tracking,
      rootIdentifier,
      input,
      state,
      orchestrator,
      effects,
    );
  }

  if (memberName === "capacity") {
    const typeInfo = resolveStringTypeInfo(
      tracking,
      rootIdentifier,
      input,
      orchestrator,
    );
    const capResult = accessGenerators.generateCapacityProperty(typeInfo);
    applyAccessEffects(capResult.effects, effects);
    tracking.result = capResult.code;
    return true;
  }

  if (memberName === "size") {
    const typeInfo = resolveStringTypeInfo(
      tracking,
      rootIdentifier,
      input,
      orchestrator,
    );
    const sizeResult = accessGenerators.generateSizeProperty(typeInfo);
    applyAccessEffects(sizeResult.effects, effects);
    tracking.result = sizeResult.code;
    return true;
  }

  return false;
};

// ========================================================================
// ADR-058: Explicit Length Properties
// ========================================================================

/**
 * Context for explicit length property generation.
 */
interface IExplicitLengthContext {
  result: string;
  rootIdentifier: string | undefined;
  resolvedIdentifier: string | undefined;
  previousStructType: string | undefined;
  previousMemberName: string | undefined;
  subscriptDepth: number;
}

/**
 * Get the numeric bit width for a type (internal helper for ADR-058).
 * Returns 0 if type is unknown.
 *
 * Note: This differs from getTypeBitWidth() which returns a string and is
 * used for the legacy .length property. This function returns a number for
 * use in calculations (e.g., array total bits = elements * element width).
 */
const getNumericBitWidth = (
  typeName: string,
  input: IGeneratorInput,
): number => {
  let bitWidth = TYPE_WIDTH[typeName] ?? C_TYPE_WIDTH[typeName] ?? 0;
  if (bitWidth === 0 && input.symbolTable) {
    const enumWidth = input.symbolTable.getEnumBitWidth(typeName);
    if (enumWidth) bitWidth = enumWidth;
  }
  // Check if it's a known enum (default to 32 bits per ADR-017)
  if (bitWidth === 0 && input.symbols?.knownEnums?.has(typeName)) {
    bitWidth = 32;
  }
  // Check bitmap types
  if (bitWidth === 0 && input.symbols?.bitmapBitWidth) {
    const bitmapWidth = input.symbols.bitmapBitWidth.get(typeName);
    if (bitmapWidth) bitWidth = bitmapWidth;
  }
  return bitWidth;
};

/**
 * Generate .bit_length property access (ADR-058).
 * Returns the bit width of any type.
 */
const generateBitLengthProperty = (
  ctx: IExplicitLengthContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string | null => {
  // Special case: main function's args.bit_length -> not supported
  if (state.mainArgsName && ctx.rootIdentifier === state.mainArgsName) {
    throw new Error(
      `Error: .bit_length is not supported on 'args' parameter. Use .element_count for argc.`,
    );
  }

  // Check struct member access
  if (ctx.previousStructType && ctx.previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      ctx.previousStructType,
      ctx.previousMemberName,
    );
    if (fieldInfo) {
      return generateStructFieldBitLength(fieldInfo, ctx.subscriptDepth, input);
    }
  }

  // Get type info for the resolved identifier
  const typeInfo = ctx.resolvedIdentifier
    ? CodeGenState.getVariableTypeInfo(ctx.resolvedIdentifier)
    : undefined;

  if (!typeInfo) {
    throw new Error(
      `Error: Cannot determine .bit_length for '${ctx.result}' - type not found in registry.`,
    );
  }

  return generateTypeInfoBitLength(typeInfo, ctx.subscriptDepth, input);
};

/**
 * Calculate product of remaining array dimensions from subscript depth.
 * Returns null if a dynamic dimension (C macro) is encountered.
 */
const calculateRemainingDimensionsProduct = (
  dimensions: (number | string)[],
  subscriptDepth: number,
): { product: number } | { dynamicDim: string } => {
  let product = 1;
  for (let i = subscriptDepth; i < dimensions.length; i++) {
    const dim = dimensions[i];
    if (typeof dim !== "number") {
      return { dynamicDim: dim };
    }
    product *= dim;
  }
  return { product };
};

/**
 * Generate bit length for string type from type name.
 */
const generateStringBitLengthFromTypeName = (
  typeName: string,
): string | null => {
  if (!typeName.startsWith("string<")) {
    return null;
  }
  const capacityMatch = /^string<(\d+)>$/.exec(typeName);
  if (capacityMatch) {
    const capacity = Number(capacityMatch[1]);
    return String((capacity + 1) * 8);
  }
  return null;
};

/**
 * Generate .bit_length for a struct field.
 */
const generateStructFieldBitLength = (
  fieldInfo: { type: string; dimensions?: (number | string)[] },
  subscriptDepth: number,
  input: IGeneratorInput,
): string => {
  const memberType = fieldInfo.type;
  const dimensions = fieldInfo.dimensions;

  // String field: bit_length = (capacity + 1) * 8
  const stringBitLength = generateStringBitLengthFromTypeName(memberType);
  if (stringBitLength !== null) {
    return stringBitLength;
  }

  // Array field: total bits = product of dimensions * element bit width
  if (dimensions && dimensions.length > subscriptDepth) {
    const elementBitWidth = getNumericBitWidth(memberType, input);
    if (elementBitWidth > 0) {
      const dimResult = calculateRemainingDimensionsProduct(
        dimensions,
        subscriptDepth,
      );
      if ("dynamicDim" in dimResult) {
        return `/* .bit_length: dynamic dimension ${dimResult.dynamicDim} */0`;
      }
      return String(dimResult.product * elementBitWidth);
    }
  }

  // Scalar or fully subscripted: return element bit width
  const bitWidth = getNumericBitWidth(memberType, input);
  if (bitWidth > 0) {
    return String(bitWidth);
  }

  throw new Error(
    `Error: Cannot determine .bit_length for unsupported type '${memberType}'.`,
  );
};

/**
 * Generate bit length for a scalar (non-array) type.
 */
const generateScalarBitLength = (
  typeInfo: {
    isEnum?: boolean;
    baseType: string;
    bitWidth?: number;
  },
  input: IGeneratorInput,
): string => {
  // Enum type: always 32 bits
  if (typeInfo.isEnum) {
    return "32";
  }

  if (typeInfo.bitWidth) {
    return String(typeInfo.bitWidth);
  }

  // Try lookup by base type
  const bitWidth = getNumericBitWidth(typeInfo.baseType, input);
  if (bitWidth > 0) {
    return String(bitWidth);
  }
  throw new Error(
    `Error: Cannot determine .bit_length for unsupported type '${typeInfo.baseType}'.`,
  );
};

/**
 * Get element bit width for array type.
 */
const getArrayElementBitWidth = (
  typeInfo: {
    isEnum?: boolean;
    baseType: string;
    bitWidth?: number;
  },
  input: IGeneratorInput,
): number => {
  let elementBitWidth = typeInfo.bitWidth || 0;
  if (elementBitWidth === 0) {
    elementBitWidth = getNumericBitWidth(typeInfo.baseType, input);
  }
  if (elementBitWidth === 0 && typeInfo.isEnum) {
    elementBitWidth = 32;
  }
  return elementBitWidth;
};

/**
 * Generate bit length for an array type.
 */
const generateArrayBitLength = (
  typeInfo: {
    isEnum?: boolean;
    arrayDimensions?: (number | string)[];
    baseType: string;
    bitWidth?: number;
  },
  subscriptDepth: number,
  input: IGeneratorInput,
): string => {
  const dims = typeInfo.arrayDimensions;
  if (!dims || dims.length === 0) {
    throw new Error(
      `Error: Cannot determine .bit_length for array with unknown dimensions.`,
    );
  }

  const elementBitWidth = getArrayElementBitWidth(typeInfo, input);
  if (elementBitWidth === 0) {
    throw new Error(
      `Error: Cannot determine .bit_length for array with unsupported element type '${typeInfo.baseType}'.`,
    );
  }

  const dimResult = calculateRemainingDimensionsProduct(dims, subscriptDepth);
  if ("dynamicDim" in dimResult) {
    return `/* .bit_length: dynamic dimension ${dimResult.dynamicDim} */0`;
  }

  return String(dimResult.product * elementBitWidth);
};

/**
 * Generate .bit_length from type info.
 */
const generateTypeInfoBitLength = (
  typeInfo: {
    isString?: boolean;
    isArray?: boolean;
    isEnum?: boolean;
    arrayDimensions?: (number | string)[];
    baseType: string;
    bitWidth?: number;
    isBitmap?: boolean;
    bitmapTypeName?: string;
    stringCapacity?: number;
  },
  subscriptDepth: number,
  input: IGeneratorInput,
): string => {
  // String type: bit_length = (capacity + 1) * 8 (buffer size in bits)
  if (typeInfo.isString) {
    if (typeInfo.stringCapacity !== undefined) {
      return String((typeInfo.stringCapacity + 1) * 8);
    }
    throw new Error(
      `Error: Cannot determine .bit_length for string with unknown capacity.`,
    );
  }

  // Non-array scalar: return bit width
  if (!typeInfo.isArray) {
    return generateScalarBitLength(typeInfo, input);
  }

  // Array: calculate total bits
  return generateArrayBitLength(typeInfo, subscriptDepth, input);
};

/**
 * Generate .byte_length property access (ADR-058).
 * Returns the byte size of any type (bit_length / 8).
 */
const generateByteLengthProperty = (
  ctx: IExplicitLengthContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string | null => {
  // Special case: main function's args
  if (state.mainArgsName && ctx.rootIdentifier === state.mainArgsName) {
    throw new Error(
      `Error: .byte_length is not supported on 'args' parameter. Use .element_count for argc.`,
    );
  }

  // Check struct member access
  if (ctx.previousStructType && ctx.previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      ctx.previousStructType,
      ctx.previousMemberName,
    );
    if (fieldInfo) {
      const bitLength = generateStructFieldBitLength(
        fieldInfo,
        ctx.subscriptDepth,
        input,
      );
      // Parse and convert to bytes
      const bitValue = Number.parseInt(bitLength, 10);
      if (!Number.isNaN(bitValue)) {
        return String(bitValue / 8);
      }
      return bitLength.replace(".bit_length", ".byte_length");
    }
  }

  // Get type info for the resolved identifier
  const typeInfo = ctx.resolvedIdentifier
    ? CodeGenState.getVariableTypeInfo(ctx.resolvedIdentifier)
    : undefined;

  if (!typeInfo) {
    throw new Error(
      `Error: Cannot determine .byte_length for '${ctx.result}' - type not found in registry.`,
    );
  }

  const bitLength = generateTypeInfoBitLength(
    typeInfo,
    ctx.subscriptDepth,
    input,
  );
  const bitValue = Number.parseInt(bitLength, 10);
  if (!Number.isNaN(bitValue)) {
    return String(bitValue / 8);
  }
  return bitLength.replace(".bit_length", ".byte_length");
};

/**
 * Get dimension value at subscript depth as string.
 */
const getDimensionAtDepth = (
  dimensions: (number | string)[],
  subscriptDepth: number,
): string => {
  const dim = dimensions[subscriptDepth];
  return typeof dim === "number" ? String(dim) : dim;
};

/**
 * Generate element_count for struct field.
 */
const generateStructFieldElementCount = (
  ctx: IExplicitLengthContext,
  orchestrator: IOrchestrator,
): string | null => {
  if (!ctx.previousStructType || !ctx.previousMemberName) {
    return null;
  }

  const fieldInfo = orchestrator.getStructFieldInfo(
    ctx.previousStructType,
    ctx.previousMemberName,
  );

  if (
    fieldInfo?.dimensions &&
    fieldInfo.dimensions.length > ctx.subscriptDepth
  ) {
    return getDimensionAtDepth(fieldInfo.dimensions, ctx.subscriptDepth);
  }

  // Non-array field - element_count not applicable
  throw new Error(
    `Error: .element_count is only available on arrays, not on '${fieldInfo?.type || ctx.previousMemberName}'.`,
  );
};

/**
 * Generate element_count from type info.
 */
const generateTypeInfoElementCount = (
  ctx: IExplicitLengthContext,
  _input: IGeneratorInput,
): string => {
  const typeInfo = ctx.resolvedIdentifier
    ? CodeGenState.getVariableTypeInfo(ctx.resolvedIdentifier)
    : undefined;

  if (!typeInfo) {
    throw new Error(
      `Error: Cannot determine .element_count for '${ctx.result}' - type not found in registry.`,
    );
  }

  if (!typeInfo.isArray) {
    throw new Error(
      `Error: .element_count is only available on arrays, not on '${typeInfo.baseType}'.`,
    );
  }

  const dims = typeInfo.arrayDimensions;
  if (!dims || dims.length === 0) {
    throw new Error(
      `Error: Cannot determine .element_count for array with unknown dimensions.`,
    );
  }

  if (ctx.subscriptDepth < dims.length) {
    return getDimensionAtDepth(dims, ctx.subscriptDepth);
  }

  throw new Error(
    `Error: .element_count is not available on array elements. Array is fully subscripted.`,
  );
};

/**
 * Generate .element_count property access (ADR-058).
 * Returns element count for arrays or argc for args.
 */
const generateElementCountProperty = (
  ctx: IExplicitLengthContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string | null => {
  // Special case: main function's args.element_count -> argc
  if (state.mainArgsName && ctx.rootIdentifier === state.mainArgsName) {
    return "argc";
  }

  // Check struct member access for array fields
  const structResult = generateStructFieldElementCount(ctx, orchestrator);
  if (structResult !== null) {
    return structResult;
  }
  if (ctx.previousStructType) {
    // generateStructFieldElementCount threw or returned null but struct context existed
    return null;
  }

  // Get type info for variable
  return generateTypeInfoElementCount(ctx, input);
};

/**
 * Generate .char_count property access (ADR-058).
 * Returns strlen() for strings.
 */
const generateCharCountProperty = (
  ctx: IExplicitLengthContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string | null => {
  // Special case: main function's args
  if (state.mainArgsName && ctx.rootIdentifier === state.mainArgsName) {
    throw new Error(
      `Error: .char_count is only available on strings, not on 'args'. Use .element_count for argc.`,
    );
  }

  // Check struct member access for string fields
  if (ctx.previousStructType && ctx.previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      ctx.previousStructType,
      ctx.previousMemberName,
    );
    if (fieldInfo?.type.startsWith("string<")) {
      effects.push({ type: "include", header: "string" });
      return `strlen(${ctx.result})`;
    }
    // Non-string field
    throw new Error(
      `Error: .char_count is only available on strings, not on '${fieldInfo?.type || ctx.previousMemberName}'.`,
    );
  }

  // Get type info
  const typeInfo = ctx.resolvedIdentifier
    ? CodeGenState.getVariableTypeInfo(ctx.resolvedIdentifier)
    : undefined;

  if (!typeInfo) {
    throw new Error(
      `Error: Cannot determine .char_count for '${ctx.result}' - type not found in registry.`,
    );
  }

  // Must be a string type
  if (!typeInfo.isString) {
    throw new Error(
      `Error: .char_count is only available on strings, not on '${typeInfo.baseType}'.`,
    );
  }

  effects.push({ type: "include", header: "string" });

  // Check length cache first (only for simple variable access, not indexed)
  if (
    ctx.subscriptDepth === 0 &&
    ctx.resolvedIdentifier &&
    state.lengthCache?.has(ctx.resolvedIdentifier)
  ) {
    return state.lengthCache.get(ctx.resolvedIdentifier)!;
  }

  // Use ctx.result which contains the full expression including any subscripts
  // e.g., for arr[0].char_count, ctx.result is "arr[0]" not "arr"
  return `strlen(${ctx.result})`;
};

// ========================================================================
// Member Access
// ========================================================================

/**
 * Member access result.
 */
interface MemberAccessResult {
  result: string;
  resolvedIdentifier?: string;
  currentStructType?: string;
  currentMemberIsArray?: boolean;
  isRegisterChain?: boolean;
  isCppAccessChain?: boolean;
  previousStructType?: string;
  previousMemberName?: string;
}

/**
 * Context for member access generation.
 */
interface IMemberAccessContext {
  result: string;
  memberName: string;
  rootIdentifier: string | undefined;
  isStructParam: boolean;
  /** Issue #895: Force pointer semantics for callback-compatible params */
  forcePointerSemantics: boolean;
  isGlobalAccess: boolean;
  isCppAccessChain: boolean;
  currentStructType: string | undefined;
  resolvedIdentifier: string | undefined;
  previousStructType: string | undefined;
  previousMemberName: string | undefined;
  isRegisterChain: boolean;
}

/**
 * Initialize the default member access output from context.
 */
const initializeMemberOutput = (
  ctx: IMemberAccessContext,
): MemberAccessResult => ({
  result: ctx.result,
  resolvedIdentifier: ctx.resolvedIdentifier,
  currentStructType: ctx.currentStructType,
  currentMemberIsArray: false,
  isRegisterChain: ctx.isRegisterChain,
  isCppAccessChain: ctx.isCppAccessChain,
  previousStructType: ctx.currentStructType,
  previousMemberName: ctx.memberName,
});

/**
 * Generate member access (obj.field).
 * Dispatches to specialized handlers via null-coalescing chain.
 */
const generateMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): MemberAccessResult => {
  // Check for enum shadowing before dispatch - catches case where identifier
  // was resolved to a scope member that shadows a global enum
  MemberAccessValidator.validateGlobalEntityAccess(
    ctx.result,
    ctx.memberName,
    "enum",
    state.currentScope,
    ctx.isGlobalAccess,
    {
      rootIdentifier: ctx.rootIdentifier,
      knownEnums: input.symbols!.knownEnums,
    },
  );

  return (
    tryBitmapFieldAccess(ctx, input, effects) ??
    tryScopeMemberAccess(ctx, input, state, orchestrator) ??
    tryKnownScopeAccess(ctx, input, state, orchestrator) ??
    tryEnumMemberAccess(ctx, input, state, orchestrator) ??
    tryRegisterMemberAccess(ctx, input, state) ??
    tryStructParamAccess(ctx, orchestrator) ??
    tryRegisterBitmapAccess(ctx, input, effects) ??
    tryStructBitmapAccess(ctx, input, effects) ??
    generateDefaultAccess(ctx, orchestrator)
  );
};

// ========================================================================
// Member Access Handlers
// ========================================================================

/**
 * Check for primary bitmap type field access (e.g., status.Running).
 */
const tryBitmapFieldAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
): MemberAccessResult | null => {
  if (!ctx.rootIdentifier) {
    return null;
  }
  const typeInfo = CodeGenState.getVariableTypeInfo(ctx.rootIdentifier);
  if (!typeInfo?.isBitmap || !typeInfo.bitmapTypeName) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    ctx.result,
    ctx.memberName,
    typeInfo.bitmapTypeName,
    input.symbols!.bitmapFields,
    `type '${typeInfo.bitmapTypeName}'`,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Check for scope member access (this.member).
 */
const tryScopeMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (ctx.result !== "__THIS_SCOPE__") {
    return null;
  }
  if (!state.currentScope) {
    throw new Error("Error: 'this' can only be used inside a scope");
  }

  const output = initializeMemberOutput(ctx);
  const fullName = `${state.currentScope}_${ctx.memberName}`;
  const constValue = input.symbols!.scopePrivateConstValues.get(fullName);
  if (constValue === undefined) {
    output.result = fullName;
    output.resolvedIdentifier = fullName;
    if (!input.symbols!.knownEnums.has(fullName)) {
      const resolvedTypeInfo = CodeGenState.getVariableTypeInfo(fullName);
      if (
        resolvedTypeInfo &&
        orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
      ) {
        output.currentStructType = resolvedTypeInfo.baseType;
      }
    }
  } else {
    output.result = constValue;
    output.resolvedIdentifier = fullName;
  }
  return output;
};

/**
 * Check for known scope access (e.g., LED.on).
 */
const tryKnownScopeAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (!orchestrator.isKnownScope(ctx.result)) {
    return null;
  }

  if (!ctx.isGlobalAccess) {
    MemberAccessValidator.validateNotSelfScopeReference(
      ctx.result,
      ctx.memberName,
      state.currentScope,
    );
  }
  orchestrator.validateCrossScopeVisibility(
    ctx.result,
    ctx.memberName,
    ctx.isGlobalAccess,
  );

  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}${orchestrator.getScopeSeparator(ctx.isCppAccessChain)}${ctx.memberName}`;
  output.resolvedIdentifier = output.result;
  const resolvedTypeInfo = CodeGenState.getVariableTypeInfo(output.result);
  if (
    resolvedTypeInfo &&
    orchestrator.isKnownStruct(resolvedTypeInfo.baseType)
  ) {
    output.currentStructType = resolvedTypeInfo.baseType;
  }
  return output;
};

/**
 * Check for enum member access (e.g., Color.Red).
 */
const tryEnumMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (!input.symbols!.knownEnums.has(ctx.result)) {
    return null;
  }

  // Shadowing check already done in generateMemberAccess; this catches
  // direct conflicts where ctx.result is the enum name (no resolution happened)
  MemberAccessValidator.validateGlobalEntityAccess(
    ctx.result,
    ctx.memberName,
    "enum",
    state.currentScope,
    ctx.isGlobalAccess,
    { scopeMembers: state.scopeMembers },
  );

  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}${orchestrator.getScopeSeparator(ctx.isCppAccessChain)}${ctx.memberName}`;
  return output;
};

/**
 * Check for register member access (e.g., GPIO.PIN0).
 */
const tryRegisterMemberAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
): MemberAccessResult | null => {
  if (!input.symbols!.knownRegisters.has(ctx.result)) {
    return null;
  }

  MemberAccessValidator.validateGlobalEntityAccess(
    ctx.result,
    ctx.memberName,
    "register",
    state.currentScope,
    ctx.isGlobalAccess,
    { scopeMembers: state.scopeMembers },
  );

  MemberAccessValidator.validateRegisterReadAccess(
    `${ctx.result}_${ctx.memberName}`,
    ctx.memberName,
    `${ctx.result}.${ctx.memberName}`,
    input.symbols!.registerMemberAccess,
    false,
  );

  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}_${ctx.memberName}`;
  output.isRegisterChain = true;
  return output;
};

/**
 * Check for struct parameter access (e.g., point->x or point.x in C++).
 */
const tryStructParamAccess = (
  ctx: IMemberAccessContext,
  orchestrator: IOrchestrator,
): MemberAccessResult | null => {
  if (!ctx.isStructParam || ctx.result !== ctx.rootIdentifier) {
    return null;
  }

  // Issue #895: Force pointer semantics for callback-compatible params
  // even in C++ mode (use -> instead of .)
  const structParamSep = ctx.forcePointerSemantics
    ? "->"
    : memberAccessChain.getStructParamSeparator({
        cppMode: orchestrator.isCppMode(),
      });

  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}${structParamSep}${ctx.memberName}`;
  output.previousStructType = ctx.currentStructType;
  output.previousMemberName = ctx.memberName;
  if (ctx.currentStructType) {
    const memberTypeInfo = orchestrator.getMemberTypeInfo(
      ctx.currentStructType,
      ctx.memberName,
    );
    if (memberTypeInfo) {
      output.currentMemberIsArray = memberTypeInfo.isArray;
      output.currentStructType = memberTypeInfo.baseType;
    }
  }
  return output;
};

/**
 * Check for register member with bitmap type (e.g., MOTOR_CTRL.Running).
 */
const tryRegisterBitmapAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
): MemberAccessResult | null => {
  if (!input.symbols!.registerMemberTypes.has(ctx.result)) {
    return null;
  }

  const bitmapType = input.symbols!.registerMemberTypes.get(ctx.result)!;
  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    ctx.result,
    ctx.memberName,
    bitmapType,
    input.symbols!.bitmapFields,
    `register member '${ctx.result}' (bitmap type '${bitmapType}')`,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Check for struct member with bitmap type (e.g., device.flags.Active).
 */
const tryStructBitmapAccess = (
  ctx: IMemberAccessContext,
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
): MemberAccessResult | null => {
  if (
    !ctx.currentStructType ||
    !input.symbols!.bitmapFields.has(ctx.currentStructType)
  ) {
    return null;
  }

  const output = initializeMemberOutput(ctx);
  const bitmapResult = BitmapAccessHelper.generate(
    ctx.result,
    ctx.memberName,
    ctx.currentStructType,
    input.symbols!.bitmapFields,
    `struct member '${ctx.result}' (bitmap type '${ctx.currentStructType}')`,
  );
  applyAccessEffects(bitmapResult.effects, effects);
  output.result = bitmapResult.code;
  return output;
};

/**
 * Default member access (dot or :: separator with struct type tracking).
 */
const generateDefaultAccess = (
  ctx: IMemberAccessContext,
  orchestrator: IOrchestrator,
): MemberAccessResult => {
  const separator = ctx.isCppAccessChain ? "::" : ".";
  const output = initializeMemberOutput(ctx);
  output.result = `${ctx.result}${separator}${ctx.memberName}`;
  output.previousStructType = ctx.currentStructType;
  output.previousMemberName = ctx.memberName;
  if (ctx.currentStructType) {
    const memberTypeInfo = orchestrator.getMemberTypeInfo(
      ctx.currentStructType,
      ctx.memberName,
    );
    if (memberTypeInfo) {
      output.currentMemberIsArray = memberTypeInfo.isArray;
      output.currentStructType = memberTypeInfo.baseType;
      output.resolvedIdentifier = undefined;
    }
  }
  return output;
};

// ========================================================================
// Subscript Access
// ========================================================================

/**
 * Subscript access result.
 */
interface SubscriptAccessResult {
  result: string;
  currentStructType?: string;
  currentMemberIsArray?: boolean;
  remainingArrayDims?: number;
  subscriptDepth?: number;
}

/**
 * Context for subscript access generation.
 */
interface ISubscriptAccessContext {
  result: string;
  op: Parser.PostfixOpContext;
  rootIdentifier: string | undefined;
  primaryTypeInfo:
    | { baseType: string; arrayDimensions?: (number | string)[] }
    | undefined;
  resolvedIdentifier: string | undefined;
  currentStructType: string | undefined;
  currentMemberIsArray: boolean;
  remainingArrayDims: number;
  subscriptDepth: number;
  isRegisterChain: boolean;
}

/**
 * Generate subscript access (arr[i] or value[bit]).
 * Dispatches to single-index or dual-index handler.
 */
const generateSubscriptAccess = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): SubscriptAccessResult => {
  const exprs = ctx.op.expression();
  const output: SubscriptAccessResult = {
    result: ctx.result,
    currentStructType: ctx.currentStructType,
    currentMemberIsArray: false,
    remainingArrayDims: ctx.remainingArrayDims,
    subscriptDepth: ctx.subscriptDepth,
  };

  if (exprs.length === 1) {
    return handleSingleSubscript(ctx, exprs[0], input, orchestrator, output);
  } else if (exprs.length === 2) {
    return handleBitRangeSubscript(
      ctx,
      exprs,
      input,
      state,
      orchestrator,
      effects,
      output,
    );
  }

  return output;
};

/**
 * Handle single-index subscript (arr[i] or value[bit]).
 */
const handleSingleSubscript = (
  ctx: ISubscriptAccessContext,
  expr: Parser.ExpressionContext,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  const index = orchestrator.generateExpression(expr);

  // Check if result is a register member with bitmap type (throws)
  validateNotBitmapMember(ctx, input);

  const isRegisterAccess = checkRegisterAccess(ctx, input);
  const identifierTypeInfo = getIdentifierTypeInfo(ctx, input);

  // Register access: bit extraction
  if (isRegisterAccess) {
    output.result = `((${ctx.result} >> ${index}) & 1)`;
    return output;
  }

  // Member array access
  if (ctx.currentMemberIsArray) {
    output.result = `${ctx.result}[${index}]`;
    output.currentMemberIsArray = false;
    output.subscriptDepth = ctx.subscriptDepth + 1;
    return output;
  }

  // Multi-dimensional array access
  if (ctx.remainingArrayDims > 0) {
    return handleRemainingArrayDims(ctx, index, output);
  }

  // Primitive int member: bit access
  const isPrimitiveIntMember =
    ctx.currentStructType && TypeCheckUtils.isInteger(ctx.currentStructType);
  if (isPrimitiveIntMember) {
    output.result = `((${ctx.result} >> ${index}) & 1)`;
    output.currentStructType = undefined;
    return output;
  }

  // Primary array access
  if (identifierTypeInfo?.isArray) {
    return handlePrimaryArraySubscript(
      ctx,
      index,
      identifierTypeInfo,
      orchestrator,
      output,
    );
  }

  // Default: classify subscript type
  return handleDefaultSubscript(ctx, index, identifierTypeInfo, output);
};

/**
 * Validate that result is not a bitmap member (which requires named access).
 */
const validateNotBitmapMember = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
): void => {
  if (!input.symbols!.registerMemberTypes.has(ctx.result)) return;

  const bitmapType = input.symbols!.registerMemberTypes.get(ctx.result)!;
  const line = ctx.op.start?.line ?? 0;
  throw new Error(
    `Error at line ${line}: Cannot use bracket indexing on bitmap type '${bitmapType}'. ` +
      `Use named field access instead (e.g., ${ctx.result.split("_").at(-1)}.FIELD_NAME).`,
  );
};

/**
 * Check if this is a register access (bit extraction).
 */
const checkRegisterAccess = (
  ctx: ISubscriptAccessContext,
  input: IGeneratorInput,
): boolean => {
  if (ctx.isRegisterChain) return true;
  if (!ctx.rootIdentifier) return false;
  return input.symbols!.knownRegisters.has(ctx.rootIdentifier);
};

/**
 * Get type info for the identifier being subscripted.
 */
const getIdentifierTypeInfo = (
  ctx: ISubscriptAccessContext,
  _input: IGeneratorInput,
): TTypeInfo | undefined => {
  const identifierToCheck = ctx.resolvedIdentifier || ctx.rootIdentifier;
  return identifierToCheck
    ? CodeGenState.getVariableTypeInfo(identifierToCheck)
    : undefined;
};

/**
 * Handle subscript on array with remaining dimensions.
 */
const handleRemainingArrayDims = (
  ctx: ISubscriptAccessContext,
  index: string,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  output.result = `${ctx.result}[${index}]`;
  output.remainingArrayDims = ctx.remainingArrayDims - 1;
  output.subscriptDepth = ctx.subscriptDepth + 1;

  if (output.remainingArrayDims === 0 && ctx.primaryTypeInfo) {
    output.currentStructType = ctx.primaryTypeInfo.baseType;
  }
  return output;
};

/**
 * Handle subscript on a primary array.
 */
const handlePrimaryArraySubscript = (
  ctx: ISubscriptAccessContext,
  index: string,
  typeInfo: TTypeInfo,
  orchestrator: IOrchestrator,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  output.result = `${ctx.result}[${index}]`;
  output.subscriptDepth = ctx.subscriptDepth + 1;

  // Update struct type if element is a known struct
  if (!ctx.currentStructType) {
    const elementType = typeInfo.baseType;
    if (orchestrator.isKnownStruct(elementType)) {
      output.currentStructType = elementType;
    }
  }
  return output;
};

/**
 * Handle default subscript (classify and apply).
 */
const handleDefaultSubscript = (
  ctx: ISubscriptAccessContext,
  index: string,
  typeInfo: TTypeInfo | undefined,
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  const subscriptKind = SubscriptClassifier.classify({
    typeInfo: typeInfo ?? null,
    subscriptCount: 1,
    isRegisterAccess: false,
  });

  output.result =
    subscriptKind === "bit_single"
      ? `((${ctx.result} >> ${index}) & 1)`
      : `${ctx.result}[${index}]`;

  return output;
};

/**
 * Handle dual-index subscript (value[start, width] — bit range).
 */
const handleBitRangeSubscript = (
  ctx: ISubscriptAccessContext,
  exprs: Parser.ExpressionContext[],
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
  output: SubscriptAccessResult,
): SubscriptAccessResult => {
  const start = orchestrator.generateExpression(exprs[0]);
  const width = orchestrator.generateExpression(exprs[1]);

  const isFloatType =
    ctx.primaryTypeInfo?.baseType === "f32" ||
    ctx.primaryTypeInfo?.baseType === "f64";

  if (isFloatType && ctx.rootIdentifier) {
    output.result = handleFloatBitRange(
      {
        result: ctx.result,
        rootIdentifier: ctx.rootIdentifier,
        baseType: ctx.primaryTypeInfo!.baseType,
        start,
        width,
      },
      state,
      orchestrator,
      effects,
    );
  } else {
    const mask = orchestrator.generateBitMask(width);
    let expr: string;
    if (start === "0") {
      expr = `((${ctx.result}) & ${mask})`;
    } else {
      expr = `((${ctx.result} >> ${start}) & ${mask})`;
    }

    // MISRA 10.3: Add narrowing cast if expected type is known
    // Bit operations promote to int, so wrap with cast when assigning to narrower types
    const targetType = CodeGenState.expectedType;
    if (targetType && ctx.primaryTypeInfo?.baseType) {
      const promotedSourceType = NarrowingCastHelper.getPromotedType(
        ctx.primaryTypeInfo.baseType,
      );
      output.result = NarrowingCastHelper.wrap(
        expr,
        promotedSourceType,
        targetType,
      );
    } else {
      output.result = expr;
    }
  }

  return output;
};

/**
 * Context for float bit range access.
 */
interface IFloatBitRangeContext {
  result: string;
  rootIdentifier: string;
  baseType: string;
  start: string;
  width: string;
}

/**
 * Get the C float type name for a C-Next float type.
 */
const getFloatTypeName = (baseType: string): string => {
  return baseType === "f64" ? "double" : "float";
};

/**
 * Handle float bit range access with union-based type punning.
 * Uses union { float f; uint32_t u; } for MISRA C:2012 Rule 21.15 compliance.
 */
const handleFloatBitRange = (
  ctx: IFloatBitRangeContext,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string => {
  if (!state.inFunctionBody) {
    throw new Error(
      `Float bit indexing reads (${ctx.rootIdentifier}[${ctx.start}, ${ctx.width}]) cannot be used at global scope.`,
    );
  }

  effects.push({ type: "include", header: "float_static_assert" });

  const isF64 = ctx.baseType === "f64";
  const floatType = getFloatTypeName(ctx.baseType);
  const intType = isF64 ? "uint64_t" : "uint32_t";
  const shadowName = `__bits_${ctx.rootIdentifier}`;
  const mask = orchestrator.generateBitMask(ctx.width, isF64);

  const needsDeclaration = !orchestrator.hasFloatBitShadow(shadowName);
  if (needsDeclaration) {
    orchestrator.registerFloatBitShadow(shadowName);
    // Emit union declaration: union { float f; uint32_t u; } __bits_name;
    orchestrator.addPendingTempDeclaration(
      `union { ${floatType} f; ${intType} u; } ${shadowName};`,
    );
  }

  const shadowIsCurrent = orchestrator.isFloatShadowCurrent(shadowName);
  orchestrator.markFloatShadowCurrent(shadowName);

  // If shadow is not current, emit assignment: __bits_name.f = floatVar;
  if (!shadowIsCurrent) {
    orchestrator.addPendingTempDeclaration(`${shadowName}.f = ${ctx.result};`);
  }

  // Return just the bit read expression using union member .u
  if (ctx.start === "0") {
    return `(${shadowName}.u & ${mask})`;
  }
  return `((${shadowName}.u >> ${ctx.start}) & ${mask})`;
};

// ========================================================================
// Utilities
// ========================================================================

/**
 * Apply effects from access generators.
 */
const applyAccessEffects = (
  sourceEffects: readonly TGeneratorEffect[],
  targetEffects: TGeneratorEffect[],
): void => {
  for (const effect of sourceEffects) {
    targetEffects.push(effect);
  }
};

export default generatePostfixExpression;
