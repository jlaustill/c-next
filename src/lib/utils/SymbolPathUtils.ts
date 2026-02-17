/**
 * Utility functions for building dot-path identifiers for symbols.
 * Used by parseWithSymbols and parseCHeader to generate unique symbol IDs.
 */

import IScopeSymbol from "../../transpiler/types/symbols/IScopeSymbol";

/**
 * Build the dot-path for a scope by walking up the parent chain.
 * Returns empty string for global scope.
 *
 * @example
 * // For scope "GPIO7" with parent "Teensy4":
 * buildScopePath(gpio7Scope) // => "Teensy4.GPIO7"
 */
function buildScopePath(scope: { name: string; parent?: unknown }): string {
  if (scope.name === "") {
    return "";
  }

  const parts: string[] = [scope.name];
  let current = scope.parent as IScopeSymbol | undefined;

  // Walk up the parent chain, stopping at global scope or circular reference
  while (current && current.name !== "" && current !== current.parent) {
    parts.unshift(current.name);
    current = current.parent as IScopeSymbol | undefined;
  }

  return parts.join(".");
}

/**
 * Get the dot-path ID for a symbol (e.g., "LED.toggle", "Color.Red").
 * For top-level symbols, returns just the name.
 *
 * @example
 * getDotPathId({ name: "toggle", scope: { name: "LED" } }) // => "LED.toggle"
 * getDotPathId({ name: "setup", scope: { name: "" } })     // => "setup"
 */
function getDotPathId(symbol: {
  name: string;
  scope: { name: string; parent?: unknown };
}): string {
  const scopePath = buildScopePath(symbol.scope);
  if (scopePath === "") {
    return symbol.name;
  }
  return `${scopePath}.${symbol.name}`;
}

/**
 * Get the parentId for a symbol (the dot-path of its parent scope).
 * Returns undefined for top-level symbols.
 *
 * @example
 * getParentId({ name: "LED" })  // => "LED"
 * getParentId({ name: "" })     // => undefined (global scope)
 */
function getParentId(scope: {
  name: string;
  parent?: unknown;
}): string | undefined {
  const scopePath = buildScopePath(scope);
  return scopePath === "" ? undefined : scopePath;
}

/**
 * Build a simple dot-path from parent and name.
 * Used for C headers where there's no scope chain.
 *
 * @example
 * buildSimpleDotPath("Color", "RED") // => "Color.RED"
 * buildSimpleDotPath(undefined, "myFunc") // => "myFunc"
 */
function buildSimpleDotPath(parent: string | undefined, name: string): string {
  return parent ? `${parent}.${name}` : name;
}

class SymbolPathUtils {
  static readonly buildScopePath = buildScopePath;
  static readonly getDotPathId = getDotPathId;
  static readonly getParentId = getParentId;
  static readonly buildSimpleDotPath = buildSimpleDotPath;
}

export default SymbolPathUtils;
