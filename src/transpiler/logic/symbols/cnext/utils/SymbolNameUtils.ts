/**
 * Utility functions for symbol name manipulation.
 */

/**
 * Get the transpiled C name for a symbol (e.g., "Geometry_Point" for Point in Geometry scope).
 * Use only at the output layer for C code generation, not for input-side logic.
 *
 * @param symbol Object with name and scope.name properties
 * @returns The C output name (e.g., "Motor_init") or bare name if global scope
 */
function getTranspiledCName(symbol: {
  name: string;
  scope: { name: string };
}): string {
  const scopeName = symbol.scope.name;
  if (scopeName === "") {
    return symbol.name;
  }
  return `${scopeName}_${symbol.name}`;
}

class SymbolNameUtils {
  static readonly getTranspiledCName = getTranspiledCName;
}

export default SymbolNameUtils;
