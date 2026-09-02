/**
 * Utility functions for building dot-path identifiers for symbols.
 * Used by parseWithSymbols and parseCHeader to generate unique symbol IDs.
 */

/**
 * Get the parentId for a symbol or scope, given the path of its enclosing scope.
 * Returns undefined for top-level symbols.
 *
 * The one place the symbol model's `""` (no enclosing scope) is translated into
 * the `ISymbolInfo` API's `undefined`. The two spellings mean the same thing and
 * neither side should learn the other's.
 *
 * @example
 * getParentId("LED")          // => "LED"
 * getParentId("Teensy4.GPIO7") // => "Teensy4.GPIO7"
 * getParentId("")             // => undefined (global scope)
 */
function getParentId(scopePath: string): string | undefined {
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

/**
 * #1298 removed `buildScopePath` and `getDotPathId` from this file. Both walked
 * a scope's parent chain to rebuild a dotted path -- a third encoder for it,
 * beside `ScopeUtils.getTranspiledCName` and the one on `QualifiedCName`, and
 * the only one that carried its own ad-hoc cycle guard (`current !== current.parent`).
 *
 * Neither has anything left to compute. A symbol's dotted path IS
 * `cnxScopedName`, computed once at construction; a scope's own path is the same
 * field, reachable as `ScopeUtils.pathOf(scope)`.
 */
class SymbolPathUtils {
  static readonly getParentId = getParentId;
  static readonly buildSimpleDotPath = buildSimpleDotPath;
}

export default SymbolPathUtils;
