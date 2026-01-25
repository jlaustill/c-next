import { statSync } from "fs";

/**
 * Generates and validates cache keys for files.
 * Encapsulates the cache invalidation strategy for future flexibility.
 *
 * Currently: mtime-based (fast, no file reads)
 * Future: content-hash-based (more accurate, handles touch without changes)
 */
class CacheKeyGenerator {
  /**
   * Generate a cache key for a file.
   * @param filePath Absolute path to the file
   * @returns Cache key string (format: "mtime:<timestamp>")
   */
  static generate(filePath: string): string {
    const stats = statSync(filePath);
    return `mtime:${stats.mtimeMs}`;
  }

  /**
   * Check if a file's current state matches a cached key.
   * @param filePath Absolute path to the file
   * @param cachedKey The key stored in cache
   * @returns true if file is unchanged
   */
  static isValid(filePath: string, cachedKey: string): boolean {
    try {
      return CacheKeyGenerator.generate(filePath) === cachedKey;
    } catch {
      return false; // File doesn't exist or unreadable
    }
  }
}

export default CacheKeyGenerator;
