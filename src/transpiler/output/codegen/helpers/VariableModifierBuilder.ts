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

/**
 * Result from building variable modifiers.
 */
interface IVariableModifiers {
  /** "const " or "" */
  const: string;
  /** "volatile " for atomic modifier or "" */
  atomic: string;
  /** "volatile " for volatile modifier or "" */
  volatile: string;
  /** "extern " for top-level const in C++ or "" */
  extern: string;
}

/**
 * Context interface for variable declarations that have modifiers.
 * This allows the builder to work with different parser contexts.
 * Uses unknown since we only check truthiness of modifier methods.
 * constModifier is optional because ForVarDeclContext doesn't have it.
 */
interface IModifierContext {
  constModifier?: () => unknown;
  atomicModifier(): unknown;
  volatileModifier(): unknown;
  start?: { line?: number } | null;
}

/**
 * Builds and validates variable modifiers from parser context.
 */
class VariableModifierBuilder {
  /**
   * Build modifiers for a variable declaration.
   *
   * @param ctx - Parser context with modifier methods
   * @param inFunctionBody - Whether we're inside a function body (affects extern)
   * @param hasInitializer - Whether the variable has an initializer (affects extern in C mode)
   * @param cppMode - Whether we're generating C++ code (affects extern behavior)
   * @returns Modifier strings ready for use in generated code
   * @throws Error if both atomic and volatile are specified
   */
  static build(
    ctx: IModifierContext,
    inFunctionBody: boolean,
    hasInitializer: boolean = false,
    cppMode: boolean = false,
  ): IVariableModifiers {
    const hasConst = ctx.constModifier?.() ?? false;
    const constMod = hasConst ? "const " : "";
    const atomicMod = ctx.atomicModifier() ? "volatile " : "";
    const volatileMod = ctx.volatileModifier() ? "volatile " : "";

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
      hasConst && !inFunctionBody && (cppMode || !hasInitializer);
    const externMod = needsExtern ? "extern " : "";

    // Validate: cannot use both atomic and volatile
    if (ctx.atomicModifier() && ctx.volatileModifier()) {
      const line = ctx.start?.line ?? 0;
      throw new Error(
        `Error at line ${line}: Cannot use both 'atomic' and 'volatile' modifiers. ` +
          `Use 'atomic' for ISR-shared variables (includes volatile + atomicity), ` +
          `or 'volatile' for hardware registers and delay loops.`,
      );
    }

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
   * @param ctx - Parser context with modifier methods
   * @returns Modifier strings (just atomic and volatile)
   */
  static buildSimple(
    ctx: IModifierContext,
  ): Pick<IVariableModifiers, "atomic" | "volatile"> {
    return {
      atomic: ctx.atomicModifier() ? "volatile " : "",
      volatile: ctx.volatileModifier() ? "volatile " : "",
    };
  }

  /**
   * Build the combined modifier prefix string.
   *
   * @param modifiers - The modifier object
   * @returns Combined string like "extern const volatile "
   */
  static toPrefix(modifiers: IVariableModifiers): string {
    return `${modifiers.extern}${modifiers.const}${modifiers.atomic}${modifiers.volatile}`;
  }
}

export default VariableModifierBuilder;
