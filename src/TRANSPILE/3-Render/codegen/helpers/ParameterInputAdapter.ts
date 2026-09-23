/**
 * ParameterInputAdapter - Adapts different input formats to IParameterInput
 *
 * Provides two conversion methods:
 * - fromAST(): For CodeGenerator, converts IPlannedParameter + CodeGenState
 * - fromSymbol(): For HeaderGenerator, converts IParameterSymbol
 *
 * Both produce normalized IParameterInput for use with ParameterSignatureBuilder.
 *
 * #1445: `fromAST` keeps its name and takes a record of facts now rather than
 * a `ParameterContext` and three callbacks that each took another parse node.
 * Everything those callbacks did was turn a node into a string; every decision
 * after that is about strings and `CodeGenState`, which is why this module
 * names no parse type at all.
 *
 * The two methods therefore differ in WHICH record they read, not in kind --
 * which is what makes the remaining problem tractable. They are still two
 * derivations of one parameter, from two sources, and the .c/.h divergences
 * this file keeps recording (#914, #1164, #1545) are three instances of that
 * one defect rather than three bugs. Filed as #1639.
 */

import AdrProvenance from "../../../../transpiler/AdrProvenance";
import IParameterInput from "../types/IParameterInput";
import type IPlannedParameter from "../types/IPlannedParameter";
import IParameterSymbol from "../../../../utils/types/IParameterSymbol";
import ICallbackTypeInfo from "../../../../transpiler/types/ICallbackTypeInfo";
import AutoConstRule from "../../../../utils/AutoConstRule";

/**
 * Dependencies required by fromAST() to resolve types and state.
 * These are passed in to avoid direct dependency on CodeGenState,
 * making the adapter more testable.
 */
interface IFromASTDeps {
  /** Map of callback type names to their info */
  callbackTypes: ReadonlyMap<string, ICallbackTypeInfo>;

  /** Check if type is a known struct (C-Next or C header) */
  isKnownStruct: (typeName: string) => boolean;

  /** TYPE_MAP for primitive detection */
  typeMap: Record<string, string>;

  /** Whether the parameter is modified in the current function */
  isModified: boolean;

  /** Whether the parameter should use pass-by-value (pre-computed) */
  isPassByValue: boolean;

  /** Issue #895: Whether the current function is callback-compatible */
  isCallbackCompatible: boolean;

  /**
   * Issue #895: Force pass-by-reference for callback-compatible functions
   * When the typedef signature requires a pointer, this overrides normal logic.
   */
  forcePassByReference?: boolean;

  /** Issue #958: Check if a type name is a typedef'd struct from C headers */
  isTypedefStructType: (typeName: string) => boolean;

  /**
   * #1545: Whether a type name is a known enum. ADR-013 passes enums by value,
   * so they take no auto-const. The header path already excluded them and this
   * path did not; AutoConstRule now holds that decision for both, which is why
   * the fact has to reach here.
   */
  isKnownEnum: (typeName: string) => boolean;

  /**
   * Issue #895: Force const qualifier from callback typedef signature.
   * When the C typedef has `const T*`, this preserves const on the generated param.
   */
  forceConst?: boolean;

  /**
   * Issue #995: Check if a type is an opaque handle (incomplete struct typedef).
   * Opaque handles should not get auto-const because they must be passed to
   * C APIs that expect non-const pointers.
   */
  isOpaqueType?: (typeName: string) => boolean;
}

/**
 * Dependencies required by fromSymbol() to resolve types.
 * Simpler than AST deps since IParameterSymbol already contains most info.
 *
 * The caller (BaseHeaderGenerator) pre-computes isPassByValue including
 * ISR/float/enum/passByValueSet checks. The adapter trusts this decision.
 */
interface IFromSymbolDeps {
  /** Map C-Next type to C type */
  mapType: (type: string) => string;

  /** Whether the parameter should use pass-by-value (pre-computed by caller) */
  isPassByValue: boolean;
}

/**
 * Static adapter class for converting different input formats to IParameterInput.
 */
class ParameterInputAdapter {
  /**
   * Convert AST ParameterContext to normalized IParameterInput.
   * Used by CodeGenerator.generateParameter().
   *
   * Note: Validation (C-style array rejection, unbounded dimension rejection)
   * should be done BEFORE calling this method.
   *
   * @param ctx - The parser context for the parameter
   * @param deps - Dependencies for type resolution and state lookup
   * @returns Normalized IParameterInput
   */
  static fromAST(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, mappedType, isConst } = planned;

    // Check for callback type
    const callbackInfo = deps.callbackTypes.get(typeName);
    if (callbackInfo) {
      return this._buildCallbackInput(
        name,
        typeName,
        mappedType,
        callbackInfo.typedefName,
      );
    }

    // Check for array type
    if (planned.renderDimensions) {
      return this._buildArrayInputFromAST(planned, deps);
    }

    // Check for string type (non-array)
    if (planned.isString) {
      return this._buildStringInput(planned, deps);
    }

    // Determine classification for non-array, non-string types
    const isKnownStruct = deps.isKnownStruct(typeName);
    const isKnownPrimitive = !!deps.typeMap[typeName];
    // Issue #958: C-header typedef struct types need pointer semantics
    const isTypedefStruct = deps.isTypedefStructType(typeName);
    // Issue #995: Detect opaque handles — rule applied in ParameterSignatureBuilder
    const isOpaque = deps.isOpaqueType?.(typeName) ?? false;
    if (isOpaque) {
      // ADR-030 decided here: an incomplete type can only be handled through a
      // pointer, which is why #995's `const T*` was wrong. Recorded at the
      // PARAMETER's position so the matrix sees the enclosing function's
      // context.
      //
      // #1511: this is the only thing an occupancy can be derived from for the
      // OPAQUE-HANDLE half of ADR-030, which shapes generated code and reports
      // nothing. The ADR does raise diagnostics -- E0422/E0423/E0426/E0427 --
      // and since #1582 their fixtures occupy cells here too, on their own
      // reported positions. Occupancy is per ADR, not per code, so a cell
      // occupied by one half says nothing about the other: deleting this line
      // leaves `scope method / same file` green.
      //
      // #1445: the position comes from the planned parameter now. It is the
      // same position -- `ctx.start?.line` of the parameter context -- read
      // once by the planner instead of here.
      AdrProvenance.record("030", planned.line);
    }
    const isAutoConst = this._autoConst(
      typeName,
      isConst,
      false,
      deps,
      planned.line,
    );

    // Issue #895/#958: Force pass-by-reference for callback or typedef struct types
    const isPassByReference =
      deps.forcePassByReference ||
      isKnownStruct ||
      isKnownPrimitive ||
      isTypedefStruct;

    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isAutoConst,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: deps.isPassByValue,
      isPassByReference,
      // Issue #895/#958: Force pointer syntax in C++ mode for callback-compatible
      // and typedef struct params (C types expect pointers, not C++ references)
      forcePointerSyntax:
        deps.forcePassByReference || isTypedefStruct || undefined,
      // Issue #895: Preserve const from callback typedef signature
      forceConst: deps.forceConst,
      // Issue #995: Pass through opaque handle detection — rule applied in builder
      isOpaqueHandle: isOpaque || undefined,
    };
  }

  /**
   * Convert IParameterSymbol to normalized IParameterInput.
   * Used by BaseHeaderGenerator.generateParameter().
   *
   * The caller pre-computes isPassByValue (ISR, float, enum, passByValueSet).
   * Non-PBV, non-array, non-string types use pass-by-reference.
   *
   * @param param - The parameter symbol
   * @param deps - Dependencies for type mapping
   * @returns Normalized IParameterInput
   */
  static fromSymbol(
    param: IParameterSymbol,
    deps: IFromSymbolDeps,
  ): IParameterInput {
    const mappedType = deps.mapType(param.type);

    // Array parameters
    if (
      param.isArray &&
      param.arrayDimensions &&
      param.arrayDimensions.length > 0
    ) {
      return this._buildArrayInputFromSymbol(param, mappedType);
    }

    // String type detection
    const isString =
      param.type === "string" || param.type.startsWith("string<");

    // Non-array string
    if (isString && !param.isArray) {
      return {
        name: param.name,
        baseType: param.type,
        mappedType: "char",
        isConst: param.isConst,
        isAutoConst: param.isAutoConst ?? false,
        isArray: false,
        isCallback: false,
        isString: true,
        isPassByValue: false,
        isPassByReference: false,
        // #1545: the general branch below carries this and the string branch
        // did not, so a typedef declaring `const char *` reached the .c (via
        // forceConst on the AST path) and never reached the .h -- the same
        // .c/.h disagreement as the missing callback term, in the opposite
        // direction.
        forceConst: param.isCallbackConst || undefined,
      };
    }

    // ADR-029 / #1164: a parameter whose type IS a callback function is written
    // as its typedef, with no added pointer — the typedef is already a function
    // pointer. Hardcoding isCallback false here made the header emit
    // "onReceive_fp* handler" where the .c emits "onReceive_fp handler".
    if (param.isCallback && param.callbackTypedefName) {
      return {
        name: param.name,
        baseType: param.type,
        mappedType,
        isConst: param.isConst,
        isAutoConst: false,
        isArray: false,
        isCallback: true,
        callbackTypedefName: param.callbackTypedefName,
        isString: false,
        isPassByValue: true,
        isPassByReference: false,
      };
    }

    // Issue #914: Callback typedef overrides — param carries resolved pointer/const
    // info. This is deliberately tri-state (TypedefParamParser.isParamPointer
    // returns boolean | null): true means the typedef takes a pointer, FALSE
    // means it takes the value, and undefined means there is no typedef to
    // follow. Collapsing false into undefined with `?? false` sent a by-value
    // typedef back through ADR-006 reference semantics, so `void (*)(Point)`
    // got a `Point*` prototype against a `Point` definition (#1164).
    const callbackWantsPointer = param.isCallbackPointer;
    const callbackWantsValue = callbackWantsPointer === false;

    return {
      name: param.name,
      baseType: param.type,
      mappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: false,
      isCallback: false,
      isString: false,
      isPassByValue: callbackWantsPointer
        ? false
        : callbackWantsValue || deps.isPassByValue,
      isPassByReference: callbackWantsPointer
        ? true
        : !callbackWantsValue && !deps.isPassByValue,
      forcePointerSyntax: callbackWantsPointer || undefined,
      forceConst: param.isCallbackConst || undefined,
      // Issue #995: Pass through opaque handle detection — rule applied in builder
      isOpaqueHandle: param.isOpaqueHandle || undefined,
    };
  }

  /**
   * Build IParameterInput for a callback parameter.
   */
  private static _buildCallbackInput(
    name: string,
    typeName: string,
    mappedType: string,
    typedefName: string,
  ): IParameterInput {
    return {
      name,
      baseType: typeName,
      mappedType,
      isConst: false,
      isAutoConst: false,
      isArray: false,
      isCallback: true,
      callbackTypedefName: typedefName,
      isString: false,
      isPassByValue: true, // Callbacks are function pointers, pass by value
      isPassByReference: false,
    };
  }

  /**
   * Build IParameterInput for an array parameter from AST.
   */
  private static _buildArrayInputFromAST(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, mappedType, isConst, isString } = planned;

    // Issue #1159 is decided by the planner: a dimension that is a
    // compile-time constant is folded to its value, because emitting the
    // identifier makes `u8[SIZE] buf` a VLA parameter while the matching local
    // declaration folds to `uint8_t b[6]` -- the same const rendered two ways
    // in one .c, and a construct CLAUDE.md rules out.
    const dims: string[] = [...planned.renderDimensions!()];

    // The null terminator is decided HERE, not by the planner: `string<8>[2]`
    // is two 9-byte rows, and a capacity is a language fact where a dimension
    // is a C one.
    if (isString && planned.stringCapacity !== undefined) {
      dims.push(String(planned.stringCapacity + 1));
    }

    // ADR-006: Arrays are pass-by-reference and mutable by default, so the rule
    // returns false for every array. It is asked rather than hardcoded so the
    // array policy has ONE spelling: #1602 is open on ADR-013 still listing
    // arrays as receiving auto-const, and whoever resolves it must not have to
    // find this branch as well.
    return {
      name,
      baseType: typeName,
      mappedType,
      isConst,
      isAutoConst: this._autoConst(
        typeName,
        isConst,
        true,
        deps,
        planned.arrayTypeLine,
      ),
      isArray: true,
      arrayDimensions: dims,
      isCallback: false,
      isString,
      isPassByValue: false, // Arrays are always passed by pointer
      isPassByReference: false,
      // #1545: an array parameter drops the typedef's const exactly as the
      // string branch did. A `void (*)(const uint8_t *)` typedef against
      // `void onData(u8[4] buf)` emitted `uint8_t buf[4]` in BOTH files, so the
      // two agreed with each other and neither matched the typedef --
      // an incompatible-pointer-type warning at the registration, transpiler exit 0.
      forceConst: deps.forceConst,
    };
  }

  /**
   * Build IParameterInput for an array parameter from symbol.
   */
  private static _buildArrayInputFromSymbol(
    param: IParameterSymbol,
    mappedType: string,
  ): IParameterInput {
    const isString =
      param.type === "string" || param.type.startsWith("string<");
    const isUnboundedString = param.type === "string"; // No capacity specified

    // For header generator, we need to use char for string arrays
    const actualMappedType = isString ? "char" : mappedType;

    return {
      name: param.name,
      baseType: param.type,
      mappedType: actualMappedType,
      isConst: param.isConst,
      isAutoConst: param.isAutoConst ?? false,
      isArray: true,
      arrayDimensions: param.arrayDimensions,
      isCallback: false,
      isString,
      isUnboundedString,
      isPassByValue: false,
      isPassByReference: false,
      // #1545: same as the AST array branch -- the typedef's const has to reach
      // the header too, or the .h contradicts the .c it was generated beside.
      forceConst: param.isCallbackConst || undefined,
    };
  }

  /**
   * #1545: ADR-013 auto-const for a parse-tree parameter.
   *
   * One place that translates this file's vocabulary into IAutoConstFacts, so
   * a fact added to the rule cannot reach two of the three branches and miss
   * the third -- which is how the general path, the string path and the header
   * path came to hold three different rules in the first place.
   */
  private static _autoConst(
    typeName: string,
    isConst: boolean,
    isArray: boolean,
    deps: IFromASTDeps,
    line: number | undefined,
  ): boolean {
    const applies = AutoConstRule.applies({
      baseType: typeName,
      isModified: deps.isModified,
      isExplicitlyConst: isConst,
      isCallbackCompatible: deps.isCallbackCompatible,
      isArray,
      isKnownEnum: deps.isKnownEnum(typeName),
      // #995: derived here rather than at the three call sites, so the string,
      // array and general branches cannot disagree about it the way they
      // disagreed about the callback term.
      isOpaqueHandle: deps.isOpaqueType?.(typeName) ?? false,
    });

    // Recorded where the rule FIRED, which is what #1241 derives occupancy
    // from, and the shape ADR-030 uses eleven lines up (`if (isOpaque)`). An
    // unguarded record at the top of fromAST credited ADR-013 for every
    // parameter of every function -- two of the three positions it produced
    // for this branch's own fixture were callback parameters the rule had just
    // refused. ADR-013's codegen half raises no diagnostic, so a provenance
    // site is the only thing its occupancy can be derived from.
    if (applies) {
      AdrProvenance.record("013", line);
    }
    return applies;
  }

  /**
   * Build IParameterInput for a non-array string parameter.
   */
  private static _buildStringInput(
    planned: IPlannedParameter,
    deps: IFromASTDeps,
  ): IParameterInput {
    const { name, typeName, isConst } = planned;
    const capacity = planned.stringCapacity;
    // #1545: the same rule the general path uses. This line previously omitted
    // the callback term, so a callback-compatible function's unmodified string
    // parameter took `const char*` in the .c while the .h kept `char*` -- the
    // definition contradicting its own prototype.
    const isAutoConst = this._autoConst(
      typeName,
      isConst,
      false,
      deps,
      planned.stringTypeLine,
    );

    return {
      name,
      baseType: typeName,
      mappedType: "char",
      isConst,
      isAutoConst,
      isArray: false,
      isCallback: false,
      isString: true,
      stringCapacity: capacity,
      isPassByValue: false,
      isPassByReference: false,
      // #1545: the third site that dropped the typedef's const. The general
      // branch of fromAST carries this and the string branch did not, so a
      // `const char *` typedef reached neither file once auto-const stopped
      // supplying the const by accident. Found by the fixture, not by reading.
      forceConst: deps.forceConst,
    };
  }
}

export default ParameterInputAdapter;
