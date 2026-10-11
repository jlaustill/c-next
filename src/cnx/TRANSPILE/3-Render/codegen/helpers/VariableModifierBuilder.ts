/**
 * VariableModifierBuilder - Extracts and validates variable modifiers
 *
 * Issue #696: Extracted from CodeGenerator to reduce cognitive complexity
 * and eliminate duplication across generateVariableDecl, generateParameter,
 * and ControlFlowGenerator.generateForVarDecl.
 *
 * Handles:
 * - const, atomic, volatile, extern modifiers
 * - Validation that atomic and volatile are not both specified
 */

import type TranspileState from "../../../TranspileState";
import IRenderedModifiers from "../types/IRenderedModifiers";
import invariant from "../../../../utils/invariant";
import type IVariableDeclarationSyntax from "../../../../types/syntax/IVariableDeclarationSyntax";

/** The written modifiers, as 1.2 lowered them (#1932) */
type TModifierFlags = Pick<
  IVariableDeclarationSyntax["modifiers"],
  "atomic" | "volatile" | "const"
>;

/**
 * Builds and validates variable modifiers from parser context.
 */
class VariableModifierBuilder {
  /**
   * Build modifiers for a variable declaration.
   *
   * @param modifiers - The written modifiers
   * @param inFunctionBody - Whether we're inside a function body (affects extern)
   * @param hasInitializer - Whether the variable has an initializer (affects extern in C mode)
   * @param mode - The run's mode, as `TranspileState` holds it from `Program` (#1428)
   * @returns Modifier strings ready for use in generated code
   * @throws Error if both atomic and volatile are specified
   */
  static build(
    modifiers: TModifierFlags,
    inFunctionBody: boolean,
    hasInitializer: boolean,
    mode: Pick<TranspileState, "cppMode">,
  ): IRenderedModifiers {
    const hasConst = modifiers.const;
    const constMod = hasConst ? "const " : "";
    const atomicMod = modifiers.atomic ? "volatile " : "";
    const volatileMod = modifiers.volatile ? "volatile " : "";

    // Issue #525: Add extern for top-level const in C++ for external linkage
    // In C++, const at file scope has internal linkage by default, so extern is needed.
    //
    // Issue #852 (MISRA Rule 8.5): In C mode, do NOT add extern to definitions
    // (variables with initializers). The extern declaration comes from the header.
    //
    // Summary:
    // - C mode + no initializer: extern (declaration)
    // - C mode + initializer: NO extern (definition - MISRA 8.5)
    // - C++ mode: ALWAYS extern for external linkage (both declarations and definitions)
    const needsExtern =
      hasConst && !inFunctionBody && (mode.cppMode || !hasInitializer);
    const externMod = needsExtern ? "extern " : "";

    // #1322: ADR-049's `atomic` + `volatile` rule is E0889 in pass 2.1. It is
    // purely syntactic -- two modifier tokens on one declaration -- so it did
    // not belong in the builder that also decides linkage, and its position no
    // longer has to be spelled into the message.
    invariant(
      !(modifiers.atomic && modifiers.volatile),
      "a declaration carries `atomic` or `volatile`, not both -- E0889 rejects this in pass 2.1, before this runs",
    );

    return {
      const: constMod,
      atomic: atomicMod,
      volatile: volatileMod,
      extern: externMod,
    };
  }

  /**
   * Build simple modifiers (atomic and volatile only) for contexts like for-loop vars.
   *
   * @param modifiers - The written modifiers
   * @returns Modifier strings (just atomic and volatile)
   */
  static buildSimple(
    modifiers: Pick<TModifierFlags, "atomic" | "volatile">,
  ): Pick<IRenderedModifiers, "atomic" | "volatile"> {
    return {
      atomic: modifiers.atomic ? "volatile " : "",
      volatile: modifiers.volatile ? "volatile " : "",
    };
  }

  /**
   * Build the combined modifier prefix string.
   *
   * @param modifiers - The modifier object
   * @returns Combined string like "extern const volatile "
   */
  static toPrefix(modifiers: IRenderedModifiers): string {
    return `${modifiers.extern}${modifiers.const}${modifiers.atomic}${modifiers.volatile}`;
  }
}

export default VariableModifierBuilder;
