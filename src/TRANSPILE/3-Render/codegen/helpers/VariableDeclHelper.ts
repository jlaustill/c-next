/**
 * VariableDeclHelper - Renders variable declarations
 *
 * Issue #792: Extracted from CodeGenerator to reduce file size.
 *
 * Handles:
 * - Variable declarations with initializers
 * - Array declarations with dimension placement
 * - C++ constructor declarations
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * This module used to take a `VariableDeclarationContext` and ask it the same
 * questions repeatedly -- is there an initializer, is there an arrayType, what
 * are the trailing dimensions -- across four helpers behind FOUR callback
 * interfaces, each naming its own subset of grammar types. The questions are
 * answered once now, by `CodeGenerator.planVariableDecl`, and what crosses is
 * `TPlannedVariableDecl`.
 *
 * ## The planner writes state, and that is not an accident
 *
 * Building the plan registers the variable's type info, marks it as a pointer
 * when its type was inferred as one, and resolves its emitted name -- in that
 * order, because `emittedLocalName` is only correct after registration and
 * ADR-045's string discrimination reads the registry that registration filled.
 * The plan is therefore built immediately before it is rendered, in the same
 * call. What is left here is assembly: prefixes, dimension placement, the
 * MISRA Rule 10.3 cast, and the C++ assignment queue.
 */

import invariant from "../../../../utils/invariant";
import ArrayInitHelper from "./ArrayInitHelper";
import CppModeHelper from "./CppModeHelper";
import NarrowingCastHelper from "./NarrowingCastHelper";
import StringDeclHelper from "./StringDeclHelper";
import IPlannedArrayDeclaration from "../types/IPlannedArrayDeclaration";
import TPlannedVariableDecl from "../types/TPlannedVariableDecl";
import TPlannedVariableInitializer from "../types/TPlannedVariableInitializer";
import TYPE_MAP from "../types/TYPE_MAP";
import type RenderState from "../../RenderState";

/**
 * Result from rendering the array half of a declaration.
 */
interface IArrayDeclResult {
  /** Whether array init was fully handled (early return) */
  handled: boolean;
  /** Generated code if handled */
  code: string;
  /** Updated declaration string */
  decl: string;
  /** Whether this is an array type */
  isArray: boolean;
}

/**
 * Renders variable declarations in C.
 */
class VariableDeclHelper {
  // ========================================================================
  // Tier 1: Pure Operations (CodeGenState only)
  // ========================================================================

  /**
   * Handle pending C++ class field assignments.
   * In function body, generates assignments after declaration.
   *
   * #1322: the rejection that stood at the end of this method is E0508 in pass
   * 2.1, and it is not a transcription of what was here. This method DRAINS a
   * queue another node filled, so the declaration it was reported against was
   * not necessarily the one that filled it: a scope member pushed and was never
   * drained (the initializer vanished at exit 0), and an unrelated global after
   * one reported `C++ class 'u32' with constructor`. `CppClassInitializerAnalyzer`
   * decides at the initializer itself.
   *
   * The queue can therefore no longer be non-empty here outside a function
   * body, which is what the assertion says.
   *
   * @param name - Variable name
   * @param decl - Current declaration string
   * @returns Final declaration with semicolon and any pending assignments
   */
  static finalizeCppClassAssignments(
    name: string,
    decl: string,
    state: RenderState,
  ): string {
    if (state.pendingCppClassAssignments.length === 0) {
      return `${decl};`;
    }

    invariant(
      state.inFunctionBody,
      "E0508 rejects this in pass 2.1, before this runs",
    );
    const assignments = state.pendingCppClassAssignments
      .map((a) => `${name}.${a}`)
      .join("\n");
    state.pendingCppClassAssignments = [];
    return `${decl};\n${assignments}`;
  }

  // ========================================================================
  // Tier 2: Rendering one half of a declaration
  // ========================================================================

  /**
   * Render the array half: dimensions, or a complete ADR-035 initializer.
   */
  static renderArrayDeclaration(
    plan: IPlannedArrayDeclaration,
    sourceName: string,
    decl: string,
    state: RenderState,
  ): IArrayDeclResult {
    if (!plan.isArray) {
      return { handled: false, code: "", decl, isArray: false };
    }

    // ADR-035: Handle array initializers with size inference
    if (plan.init) {
      // MISRA C:2012 Rule 9.3: an array declaration initializer is a declaration
      // initializer for its ELEMENTS too, so it takes withDeclarationInit exactly
      // as the scalar path below does. Without it a struct element formatted as a
      // compound literal -- `Point pair[2] = {(Point){ .x = 1 }, ...}` -- which
      // cppcheck reads as a partially initialized array, while the scalar
      // `Point single = { .x = 1 }` on the next line was already plain. One
      // declaration-initializer decision, previously made in two places.
      const init = plan.init;
      const arrayInitResult = state.withDeclarationInit(() =>
        ArrayInitHelper.processArrayInit(
          sourceName,
          plan.hasEmptyDimension,
          plan.declaredSize,
          {
            state,
            // Lazy, not pre-generated: each must run inside the
            // `withExpectedType` window the helper opens.
            generateExpression: init.renderExpression,
            getTypeName: init.renderTypeName,
            generateArrayDimensions: init.renderDimensions,
          },
          state,
        ),
      );
      if (arrayInitResult) {
        // Track as local array for type resolution
        state.localArrays.add(sourceName);
        // When size inference happens and the empty dim is in arrayType,
        // dimensionSuffix already contains the inferred size - don't duplicate
        const fullDimSuffix = plan.hasEmptyArrayTypeDimension
          ? arrayInitResult.dimensionSuffix
          : plan.arrayTypeDimensions + arrayInitResult.dimensionSuffix;
        return {
          handled: true,
          code: `${decl}${fullDimSuffix} = ${arrayInitResult.initValue};`,
          decl,
          isArray: true,
        };
      }
    }

    // Generate dimensions: arrayType dimension first, then arrayDimension dimensions
    const newDecl =
      decl + plan.arrayTypeDimensions + plan.renderCStyleDimensions();
    state.localArrays.add(sourceName);

    return { handled: false, code: "", decl: newDecl, isArray: true };
  }

  /**
   * Render a variable's initializer, with the MISRA Rule 10.3 cast.
   */
  static renderVariableInitializer(
    plan: TPlannedVariableInitializer,
    decl: string,
    isArray: boolean,
    state: RenderState,
  ): string {
    if (plan.kind === "zero") {
      // ADR-015: Zero initialization for uninitialized variables
      return `${decl} = ${plan.render(isArray)}`;
    }

    const typeName = plan.renderTypeName();

    // #1322: ADR-024's initializer rules are E0868/E0869 in pass 2.1.

    // Issue #872: Set expectedType for MISRA 7.2 U suffix compliance
    // MISRA 10.3: Also check for cross-type-category conversions (int <-> float)
    return state.withExpectedType(typeName, () => {
      let exprCode = state.withDeclarationInit(plan.renderExpression);

      // MISRA 10.3: Check for cross-type-category conversions (int <-> float).
      // Asked AFTER the render, and inside the window, because the question is
      // what the expression turned out to be.
      const exprType = plan.resolveExpressionType();
      if (
        exprType &&
        NarrowingCastHelper.isCrossTypeCategoryConversion(exprType, typeName)
      ) {
        // Int to float: add explicit cast
        if (
          NarrowingCastHelper.isIntegerCategory(exprType) &&
          NarrowingCastHelper.isFloatCategory(typeName)
        ) {
          exprCode = NarrowingCastHelper.wrapIntToFloat(
            exprCode,
            typeName,
            state,
          );
        }
        // Float to int: add explicit cast for MISRA compliance
        // Note: For safety, users should use explicit cast in C-Next source: (i32)float
        // which generates a clamping expression. This implicit cast is just for
        // MISRA 10.3 compliance when user omits explicit cast.
        if (
          NarrowingCastHelper.isFloatCategory(exprType) &&
          NarrowingCastHelper.isIntegerCategory(typeName)
        ) {
          const cType = TYPE_MAP[typeName] ?? typeName;
          exprCode = CppModeHelper.cast(cType, exprCode, state);
        }
      }

      return `${decl} = ${exprCode}`;
    });
  }

  // ========================================================================
  // Tier 3: Orchestrator
  // ========================================================================

  /**
   * Render the declaration a plan describes.
   */
  static renderVariableDecl(
    plan: TPlannedVariableDecl,
    state: RenderState,
  ): string {
    switch (plan.kind) {
      // Issue #375: C++ constructor syntax.
      //
      // ADR-057: emitted under the name registration decided on, not the
      // source one -- the planner did the registering.
      case "constructor":
        return `${plan.type} ${plan.emittedName}(${plan.args.join(", ")});`;

      // ADR-045: string types have their own three forms.
      case "string":
        return StringDeclHelper.generateStringDecl(
          plan.string,
          plan.emittedName,
          plan.modifiers,
          plan.isConst,
          state,
        );

      case "plain":
        return VariableDeclHelper.renderPlainDecl(plan, state);
    }
  }

  /**
   * Render everything that is neither a constructor nor a string.
   */
  private static renderPlainDecl(
    plan: Extract<TPlannedVariableDecl, { kind: "plain" }>,
    state: RenderState,
  ): string {
    // ADR-057: the DECLARED identifier is the emitted one -- a local shadowing a
    // file-scope name carries a distinct C name so `global.x` still reaches
    // past it. Every registry stays keyed on the bare source name, which is
    // what references in the source actually say; only the text moves.
    const base = `${plan.modifierPrefix}${plan.type} ${plan.emittedName}`;

    // Array declarations can complete the whole declaration themselves.
    const arrayResult = VariableDeclHelper.renderArrayDeclaration(
      plan.array,
      plan.sourceName,
      base,
      state,
    );
    if (arrayResult.handled) {
      return arrayResult.code;
    }

    const decl = VariableDeclHelper.renderVariableInitializer(
      plan.initializer,
      arrayResult.decl,
      arrayResult.isArray,
      state,
    );

    // Handle pending C++ class field assignments
    return VariableDeclHelper.finalizeCppClassAssignments(
      plan.sourceName,
      decl,
      state,
    );
  }
}

export default VariableDeclHelper;
