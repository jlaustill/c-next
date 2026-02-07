/**
 * Map utilities for deep copying and manipulation.
 * Pure functions for working with Map collections.
 */
class MapUtils {
  /**
   * Deep copy a Map<string, Set<string>>.
   * Creates new Map and new Set instances to ensure complete isolation.
   * Accepts ReadonlyMap/ReadonlySet for flexibility with immutable sources.
   *
   * @param source - The source Map to copy (can be readonly)
   * @returns A new mutable Map with cloned Set values
   */
  static deepCopyStringSetMap(
    source: ReadonlyMap<string, ReadonlySet<string>>,
  ): Map<string, Set<string>> {
    const copy = new Map<string, Set<string>>();
    for (const [key, value] of source) {
      copy.set(key, new Set(value));
    }
    return copy;
  }
}

export default MapUtils;
