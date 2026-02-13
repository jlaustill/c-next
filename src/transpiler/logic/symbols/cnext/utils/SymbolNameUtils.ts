/**
 * Utility functions for symbol name manipulation.
 */

/**
 * Get the C-mangled name for a symbol (e.g., "Geometry_Point" for Point in Geometry scope).
 * Works with any symbol that has a name and scope reference.
 *
 * @param symbol Object with name and scope.name properties
 * @returns The mangled name (e.g., "Motor_init") or bare name if global scope
 */
function getMangledName(symbol: {
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
  static getMangledName = getMangledName;
}

export default SymbolNameUtils;
