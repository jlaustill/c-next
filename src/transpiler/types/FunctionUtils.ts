/**
 * Factory functions and utilities for IFunctionSymbol.
 *
 * Provides utilities for creating, inspecting, and name-mangling C-Next functions.
 */
import type IFunctionSymbol from "./symbols/IFunctionSymbol";
import type TVisibility from "./TVisibility";
import type IScopeSymbol from "./symbols/IScopeSymbol";
import type IParameterInfo from "./symbols/IParameterInfo";
import type TType from "./TType";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import ScopeUtils from "./ScopeUtils";

/**
 * Options for creating a function symbol
 */
interface IFunctionCreateOptions {
  name: string;
  scope: IScopeSymbol;
  parameters: ReadonlyArray<IParameterInfo>;
  returnType: TType;
  visibility: TVisibility;
  body: unknown;
  sourceFile: string;
  sourceLine: number;
}

class FunctionUtils {
  // ============================================================================
  // Factory Functions
  // ============================================================================

  /**
   * Create a function symbol with the given properties.
   *
   * @param options - Function properties including bare name and scope reference
   */
  static create(options: IFunctionCreateOptions): IFunctionSymbol {
    return {
      kind: "function",
      name: options.name,
      scope: options.scope,
      parameters: options.parameters,
      returnType: options.returnType,
      visibility: options.visibility,
      body: options.body,
      sourceFile: options.sourceFile,
      sourceLine: options.sourceLine,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: options.visibility === "public",
    };
  }

  // ============================================================================
  // Name Mangling
  // ============================================================================

  /**
   * Get the C-mangled name for a function.
   *
   * For global scope functions, returns the bare name.
   * For scoped functions, returns "Scope_name" (e.g., "Test_fillData").
   * For nested scopes, returns "Outer_Inner_name".
   */
  static getCMangledName(func: IFunctionSymbol): string {
    const scopePath = ScopeUtils.getScopePath(func.scope);
    if (scopePath.length === 0) {
      return func.name;
    }
    return `${scopePath.join("_")}_${func.name}`;
  }

  // ============================================================================
  // Type Guards and Queries
  // ============================================================================

  /**
   * Check if function has public visibility.
   */
  static isPublic(func: IFunctionSymbol): boolean {
    return func.visibility === "public";
  }

  /**
   * Check if function is in the global scope.
   */
  static isInGlobalScope(func: IFunctionSymbol): boolean {
    return ScopeUtils.isGlobalScope(func.scope);
  }
}

export default FunctionUtils;
