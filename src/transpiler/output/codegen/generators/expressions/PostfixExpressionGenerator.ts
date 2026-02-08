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
import TypeCheckUtils from "../../../../../utils/TypeCheckUtils";
import SubscriptClassifier from "../../subscript/SubscriptClassifier";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import C_TYPE_WIDTH from "../../types/C_TYPE_WIDTH";
import TTypeInfo from "../../types/TTypeInfo";

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
    ? input.typeRegistry.get(rootIdentifier)?.baseType
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
    ? input.typeRegistry.get(rootIdentifier)
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
  const globalTypeInfo = input.typeRegistry.get(memberName);
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
  input: IGeneratorInput,
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
  const resolvedTypeInfo = input.typeRegistry.get(tracking.result);
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
  const typeInfo = identifier ? input.typeRegistry.get(identifier) : undefined;
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
 * Try handling property access (.length, .capacity, .size).
 * Returns true if handled.
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
  if (memberName === "length") {
    const lengthResult = generateLengthProperty(
      {
        result: tracking.result,
        rootIdentifier,
        resolvedIdentifier: tracking.resolvedIdentifier,
        previousStructType: tracking.previousStructType,
        previousMemberName: tracking.previousMemberName,
        subscriptDepth: tracking.subscriptDepth,
      },
      input,
      state,
      orchestrator,
      effects,
    );
    if (lengthResult !== null) {
      tracking.result = lengthResult;
      tracking.previousStructType = undefined;
      tracking.previousMemberName = undefined;
      return true;
    }
    return false;
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
// Length Property
// ========================================================================

/**
 * Context for .length property generation.
 */
interface ILengthContext {
  result: string;
  rootIdentifier: string | undefined;
  resolvedIdentifier: string | undefined;
  previousStructType: string | undefined;
  previousMemberName: string | undefined;
  subscriptDepth: number;
}

/**
 * Generate .length property access.
 * Returns null if not applicable (falls through to member access).
 */
const generateLengthProperty = (
  ctx: ILengthContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string | null => {
  // Special case: main function's args.length -> argc
  if (state.mainArgsName && ctx.rootIdentifier === state.mainArgsName) {
    return "argc";
  }

  // Check if we're accessing a struct member (cfg.magic.length)
  if (ctx.previousStructType && ctx.previousMemberName) {
    const fieldInfo = orchestrator.getStructFieldInfo(
      ctx.previousStructType,
      ctx.previousMemberName,
    );
    if (fieldInfo) {
      return generateStructFieldLength(
        ctx.result,
        fieldInfo,
        ctx.subscriptDepth,
        input,
        orchestrator,
        effects,
      );
    }
  }

  // Fall back to checking the current resolved identifier's type
  const typeInfo = ctx.resolvedIdentifier
    ? input.typeRegistry.get(ctx.resolvedIdentifier)
    : undefined;

  if (!typeInfo) {
    return `/* .length: unknown type for ${ctx.result} */0`;
  }

  return generateTypeInfoLength(
    ctx.result,
    typeInfo,
    ctx.subscriptDepth,
    ctx.resolvedIdentifier,
    input,
    state,
    effects,
  );
};

/**
 * Generate .length for a struct field.
 */
const generateStructFieldLength = (
  result: string,
  fieldInfo: { type: string; dimensions?: (number | string)[] },
  subscriptDepth: number,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
  effects: TGeneratorEffect[],
): string => {
  const memberType = fieldInfo.type;
  const dimensions = fieldInfo.dimensions;
  const isStringField = TypeCheckUtils.isString(memberType);

  if (dimensions?.length && dimensions.length > 1 && isStringField) {
    if (subscriptDepth === 0) {
      return String(dimensions[0]);
    } else {
      effects.push({ type: "include", header: "string" });
      return `strlen(${result})`;
    }
  } else if (dimensions?.length === 1 && isStringField) {
    effects.push({ type: "include", header: "string" });
    return `strlen(${result})`;
  } else if (
    dimensions?.length &&
    dimensions.length > 0 &&
    subscriptDepth < dimensions.length
  ) {
    return String(dimensions[subscriptDepth]);
  } else if (
    dimensions?.length &&
    dimensions.length > 0 &&
    subscriptDepth >= dimensions.length
  ) {
    return getTypeBitWidth(memberType, input);
  } else {
    return getTypeBitWidth(memberType, input);
  }
};

/**
 * Generate .length from type info.
 */
const generateTypeInfoLength = (
  result: string,
  typeInfo: {
    isString?: boolean;
    isArray?: boolean;
    isEnum?: boolean;
    arrayDimensions?: (number | string)[];
    baseType: string;
    bitWidth?: number;
    isBitmap?: boolean;
    bitmapTypeName?: string;
  },
  subscriptDepth: number,
  resolvedIdentifier: string | undefined,
  input: IGeneratorInput,
  state: IGeneratorState,
  effects: TGeneratorEffect[],
): string => {
  // ADR-045: String type handling
  if (typeInfo.isString) {
    return generateStringLength(
      result,
      typeInfo,
      subscriptDepth,
      resolvedIdentifier,
      state,
    );
  }

  // Non-string enum - always 32 bits
  if (typeInfo.isEnum && !typeInfo.isArray) {
    return "32";
  }

  // Non-string, non-enum, non-array - use bitWidth
  if (!typeInfo.isArray) {
    return String(typeInfo.bitWidth || 0);
  }

  // Array without dimensions - unknown length
  const dims = typeInfo.arrayDimensions;
  if (!dims || dims.length === 0) {
    return `/* .length unknown for ${resolvedIdentifier} */0`;
  }

  // Array with subscript within bounds - return that dimension
  if (subscriptDepth < dims.length) {
    return String(dims[subscriptDepth]);
  }

  // Subscript past array bounds - return element type's length
  return generateElementTypeLength(result, typeInfo, input, effects);
};

/**
 * Generate .length for string types.
 */
const generateStringLength = (
  result: string,
  typeInfo: {
    arrayDimensions?: (number | string)[];
  },
  subscriptDepth: number,
  resolvedIdentifier: string | undefined,
  state: IGeneratorState,
): string => {
  const dims = typeInfo.arrayDimensions;

  // String array (2D): first dimension is array size, second is string capacity
  if (dims && dims.length > 1) {
    return subscriptDepth === 0 ? String(dims[0]) : `strlen(${result})`;
  }

  // Simple string: check length cache first, then use strlen
  if (resolvedIdentifier && state.lengthCache?.has(resolvedIdentifier)) {
    return state.lengthCache.get(resolvedIdentifier)!;
  }
  return resolvedIdentifier
    ? `strlen(${resolvedIdentifier})`
    : `strlen(${result})`;
};

/**
 * Generate .length for array element types (subscript past bounds).
 */
const generateElementTypeLength = (
  result: string,
  typeInfo: {
    isEnum?: boolean;
    isString?: boolean;
    baseType: string;
    isBitmap?: boolean;
    bitmapTypeName?: string;
  },
  input: IGeneratorInput,
  effects: TGeneratorEffect[],
): string => {
  // Enum element
  if (typeInfo.isEnum) {
    return "32";
  }

  // String element
  if (TypeCheckUtils.isString(typeInfo.baseType) || typeInfo.isString) {
    effects.push({ type: "include", header: "string" });
    return `strlen(${result})`;
  }

  // Numeric/bitmap element - get bit width
  let elementBitWidth = TYPE_WIDTH[typeInfo.baseType] || 0;
  if (elementBitWidth === 0 && typeInfo.isBitmap && typeInfo.bitmapTypeName) {
    elementBitWidth =
      input.symbols!.bitmapBitWidth.get(typeInfo.bitmapTypeName) || 0;
  }

  if (elementBitWidth > 0) {
    return String(elementBitWidth);
  }
  return `/* .length: unsupported element type ${typeInfo.baseType} */0`;
};

/**
 * Get bit width for a type.
 */
const getTypeBitWidth = (typeName: string, input: IGeneratorInput): string => {
  let bitWidth = TYPE_WIDTH[typeName] || C_TYPE_WIDTH[typeName] || 0;
  if (bitWidth === 0 && input.symbolTable) {
    const enumWidth = input.symbolTable.getEnumBitWidth(typeName);
    if (enumWidth) bitWidth = enumWidth;
  }
  if (bitWidth > 0) {
    return String(bitWidth);
  } else {
    return `/* .length: unsupported type ${typeName} */0`;
  }
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
): MemberAccessResult =>
  tryBitmapFieldAccess(ctx, input, effects) ??
  tryScopeMemberAccess(ctx, input, state, orchestrator) ??
  tryKnownScopeAccess(ctx, input, state, orchestrator) ??
  tryEnumMemberAccess(ctx, input, state, orchestrator) ??
  tryRegisterMemberAccess(ctx, input, state) ??
  tryStructParamAccess(ctx, orchestrator) ??
  tryRegisterBitmapAccess(ctx, input, effects) ??
  tryStructBitmapAccess(ctx, input, effects) ??
  generateDefaultAccess(ctx, orchestrator);

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
  const typeInfo = input.typeRegistry.get(ctx.rootIdentifier);
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
      const resolvedTypeInfo = input.typeRegistry.get(fullName);
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
  const resolvedTypeInfo = input.typeRegistry.get(output.result);
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

  MemberAccessValidator.validateGlobalEntityAccess(
    ctx.result,
    ctx.memberName,
    "enum",
    state.currentScope,
    ctx.isGlobalAccess,
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

  const structParamSep = memberAccessChain.getStructParamSeparator({
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
  input: IGeneratorInput,
): TTypeInfo | undefined => {
  const identifierToCheck = ctx.resolvedIdentifier || ctx.rootIdentifier;
  return identifierToCheck
    ? input.typeRegistry.get(identifierToCheck)
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
    if (start === "0") {
      output.result = `((${ctx.result}) & ${mask})`;
    } else {
      output.result = `((${ctx.result} >> ${start}) & ${mask})`;
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
 * Handle float bit range access with memcpy shadow variable.
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

  effects.push(
    { type: "include", header: "string" },
    { type: "include", header: "float_static_assert" },
  );

  const isF64 = ctx.baseType === "f64";
  const shadowType = isF64 ? "uint64_t" : "uint32_t";
  const shadowName = `__bits_${ctx.rootIdentifier}`;
  const mask = orchestrator.generateBitMask(ctx.width, isF64);

  const needsDeclaration = !orchestrator.hasFloatBitShadow(shadowName);
  if (needsDeclaration) {
    orchestrator.registerFloatBitShadow(shadowName);
    orchestrator.addPendingTempDeclaration(`${shadowType} ${shadowName};`);
  }

  const shadowIsCurrent = orchestrator.isFloatShadowCurrent(shadowName);
  orchestrator.markFloatShadowCurrent(shadowName);

  if (shadowIsCurrent) {
    if (ctx.start === "0") {
      return `(${shadowName} & ${mask})`;
    }
    return `((${shadowName} >> ${ctx.start}) & ${mask})`;
  }
  if (ctx.start === "0") {
    return `(memcpy(&${shadowName}, &${ctx.result}, sizeof(${ctx.result})), (${shadowName} & ${mask}))`;
  }
  return `(memcpy(&${shadowName}, &${ctx.result}, sizeof(${ctx.result})), ((${shadowName} >> ${ctx.start}) & ${mask}))`;
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
