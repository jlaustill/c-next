/**
 * ArgumentGenerator - Generates function arguments with proper ADR-006 semantics
 *
 * Issue #794: Extracted from CodeGenerator to reduce file size.
 * Uses CodeGenState for state access and callbacks for CodeGenerator methods.
 *
 * Handles argument generation patterns:
 * - Local variables get & (address-of) in C mode
 * - Member access (cursor.x) gets & (address-of)
 * - Array access (arr[i]) gets & (address-of)
 * - Parameters are passed as-is (already pointers)
 * - Arrays are passed as-is (naturally decay to pointers)
 * - Literals use compound literals for pointer params: &(type){value}
 * - Complex expressions are passed as-is
 */

import CppModeHelper from "./CppModeHelper";
import TYPE_MAP from "../types/TYPE_MAP";
import IArgumentGeneratorCallbacks from "./types/IArgumentGeneratorCallbacks";
import type TranspileState from "../../../TranspileState";
import type TTypeInfo from "../../../../types/TTypeInfo";
import type TParameterInfo from "../../../../types/TParameterInfo";
import type TArgumentForm from "./types/TArgumentForm";
import invariant from "../../../../utils/invariant";

/** What decides an argument's form, read off the argument without rendering it */
type TArgumentShape = Omit<IArgumentGeneratorCallbacks, "generateExpression">;

/** Parameter types a string's element is not cast to a pointer of */
const NOT_CAST_TO = new Set(["float", "double", "bool", "void"]);

/**
 * Generates function arguments with proper pass-by-reference semantics.
 */
class ArgumentGenerator {
  /**
   * Handle simple identifier argument (parameter, array, pointer, or variable).
   * This is a pure function that only reads from state.
   *
   * @param emitted the C name the one binder gives the identifier (#1760
   *   review), a parameter's too (#1290 review: a moved parameter passed
   *   under the name as written was the global it shadows):
   *   a shadowing local's ADR-057 name, or a scope member's qualified name.
   *   This used to be decided here from `getScopeMembers().has(id)` or the
   *   bare `id`, so a local shadowing a global or a member was passed as the
   *   global or the member, and a scope member array as its bare name.
   */
  static handleIdentifierArg(
    emitted: string,
    parameter: TParameterInfo | undefined,
    declared: TTypeInfo | undefined,
    state: TranspileState,
  ): string {
    // Parameters are already pointers (#1969: the parameter the name binds to
    // where it is passed, not a block-local that shadows it)
    if (parameter) {
      return emitted;
    }

    // Arrays decay to pointers, local or not, strings included (#1668: the
    // declaration's answer, which the `localArrays` set only duplicated): a
    // `char[N]` decays to `char*`
    // exactly like any other array, and a `string<N>` parameter is generated as
    // `char*`. Taking its address instead yields `char (*)[N]`, an incompatible
    // pointer type -- the defect `e3dff5f4` fixed by deleting the `isString`
    // exception this comment used to argue for.
    const typeInfo = declared;
    if (typeInfo?.isArray) {
      return emitted;
    }

    // Issue #895 Bug B: Inferred pointers are already pointers, don't add &
    if (typeInfo?.isPointer) {
      return emitted;
    }

    // A variable - add & (except in C++ mode)
    return CppModeHelper.maybeAddressOf(emitted, state);
  }

  /**
   * How an argument passed by reference is written (#1991): the one decision
   * 2.3 writes it by and 2.2 plans its C type from.
   */
  static formOf(
    isIdentifier: boolean,
    targetParamBaseType: string | undefined,
    shape: TArgumentShape,
    cppMode: boolean,
  ): TArgumentForm {
    if (isIdentifier) return { kind: "identifier" };

    const lvalueType = shape.getLvalueType();
    if (lvalueType === null) {
      const cType = targetParamBaseType
        ? TYPE_MAP[targetParamBaseType]
        : undefined;
      // C++: an rvalue binds to const T&
      return {
        kind: "rvalue",
        compoundLiteral: !cType || cType === "void" || cppMode ? null : cType,
      };
    }

    if (lvalueType === "member") {
      const arrayStatus = shape.getMemberAccessArrayStatus();
      if (arrayStatus === "array") return { kind: "array-member" };
      if (
        arrayStatus === "not-array" &&
        targetParamBaseType &&
        shape.isCppMemberConversionRequired(targetParamBaseType)
      ) {
        return {
          kind: "member-temp",
          cType: TYPE_MAP[targetParamBaseType] || "uint8_t",
        };
      }
      return { kind: "lvalue", cast: null };
    }

    // A string's element goes to an integer pointer parameter cast
    const cType =
      targetParamBaseType && shape.isStringSubscriptAccess()
        ? TYPE_MAP[targetParamBaseType]
        : undefined;
    return {
      kind: "lvalue",
      cast: cType && !NOT_CAST_TO.has(cType) ? cType : null,
    };
  }

  /** The C type `form` writes, or null */
  static cTypeOf(form: TArgumentForm): string | null {
    switch (form.kind) {
      case "member-temp":
        return form.cType;
      case "lvalue":
        return form.cast;
      case "rvalue":
        return form.compoundLiteral;
      default:
        return null;
    }
  }

  /** A value: in C, a compound literal the pointer parameter can point at */
  static handleRvalueArg(
    compoundLiteral: string | null,
    callbacks: IArgumentGeneratorCallbacks,
  ): string {
    const value = callbacks.generateExpression();
    return compoundLiteral === null ? value : `&(${compoundLiteral}){${value}}`;
  }

  /** C++: a member converted to the parameter's type through a temporary */
  static createCppMemberConversionTemp(
    cType: string,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    const value = callbacks.generateExpression();
    // Issue #1131: one temporary namer for every family. This site previously
    // incremented the shared counter itself and spelled the name a third way
    // (`_cnx_tmp_<N>` alongside `_tmp<N>`), so the two families agreed only by
    // coincidence of drawing from the same counter.
    const tempName = state.getNextTempVarName();
    const castExpr = CppModeHelper.cast(cType, value, state);
    state.pendingTempDeclarations.push(`${cType} ${tempName} = ${castExpr};`);
    return CppModeHelper.maybeAddressOf(tempName, state);
  }

  /** An lvalue by address, cast to `cast*` when `cast` is not null */
  static handleLvalueArg(
    cast: string | null,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    const expr = CppModeHelper.maybeAddressOf(
      callbacks.generateExpression(),
      state,
    );
    if (cast === null) return expr;
    return CppModeHelper.reinterpretCast(`${cast}*`, expr, state);
  }

  static generateArg(
    simpleId: {
      readonly emitted: string;
      readonly parameter: TParameterInfo | undefined;
    } | null,
    declared: TTypeInfo | undefined,
    targetParamBaseType: string | undefined,
    callbacks: IArgumentGeneratorCallbacks,
    state: TranspileState,
  ): string {
    const form = ArgumentGenerator.formOf(
      simpleId !== null,
      targetParamBaseType,
      callbacks,
      state.cppMode,
    );
    switch (form.kind) {
      case "identifier":
        invariant(simpleId !== null, "an identifier argument is a bare name");
        return ArgumentGenerator.handleIdentifierArg(
          simpleId.emitted,
          simpleId.parameter,
          declared,
          state,
        );
      case "array-member":
        return callbacks.generateExpression();
      case "member-temp":
        return ArgumentGenerator.createCppMemberConversionTemp(
          form.cType,
          callbacks,
          state,
        );
      case "lvalue":
        return ArgumentGenerator.handleLvalueArg(form.cast, callbacks, state);
      case "rvalue":
        return ArgumentGenerator.handleRvalueArg(
          form.compoundLiteral,
          callbacks,
        );
    }
  }
}

export default ArgumentGenerator;
