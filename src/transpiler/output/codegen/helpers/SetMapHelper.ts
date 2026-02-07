/**
 * SetMapHelper
 *
 * Helper class for Set and Map manipulation utilities.
 * Used for const inference and parameter tracking operations.
 */

class SetMapHelper {
  /**
   * Find items that are in source set but not in target set.
   * Useful for finding new modifications not yet in cross-file data.
   */
  static findNewItems<T>(source: Set<T>, target: ReadonlySet<T>): Set<T> {
    const newItems = new Set<T>();
    for (const item of source) {
      if (!target.has(item)) {
        newItems.add(item);
      }
    }
    return newItems;
  }

  /**
   * Restore a map's state by clearing and repopulating from saved data.
   * Used for rollback scenarios in code generation.
   */
  static restoreMapState<K, V>(target: Map<K, V>, saved: Map<K, V>): void {
    target.clear();
    for (const [k, v] of saved) {
      target.set(k, v);
    }
  }

  /**
   * Filter map entries to only include keys not present in exclude map.
   * Returns new map with filtered entries.
   */
  static filterExclude<K, V>(
    source: Map<K, V>,
    exclude: ReadonlyMap<K, unknown> | undefined,
  ): Map<K, V> {
    const result = new Map<K, V>();
    for (const [key, value] of source) {
      if (!exclude?.has(key)) {
        result.set(key, value);
      }
    }
    return result;
  }

  /**
   * Convert map values that are arrays to new arrays (defensive copy).
   */
  static copyArrayValues<K, V>(source: Map<K, V[]>): Map<K, V[]> {
    const result = new Map<K, V[]>();
    for (const [key, value] of source) {
      result.set(key, [...value]);
    }
    return result;
  }
}

export default SetMapHelper;
