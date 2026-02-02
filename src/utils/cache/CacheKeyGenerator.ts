import IFileSystem from "../../transpiler/types/IFileSystem";
import NodeFileSystem from "../../transpiler/NodeFileSystem";

/** Default file system instance (singleton for performance) */
const defaultFs = new NodeFileSystem();

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
   * @param fs File system abstraction (defaults to NodeFileSystem)
   * @returns Cache key string (format: "mtime:<timestamp>")
   */
  static generate(filePath: string, fs: IFileSystem = defaultFs): string {
    const stats = fs.stat(filePath);
    return `mtime:${stats.mtimeMs}`;
  }

  /**
   * Check if a file's current state matches a cached key.
   * @param filePath Absolute path to the file
   * @param cachedKey The key stored in cache
   * @param fs File system abstraction (defaults to NodeFileSystem)
   * @returns true if file is unchanged
   */
  static isValid(
    filePath: string,
    cachedKey: string,
    fs: IFileSystem = defaultFs,
  ): boolean {
    try {
      return CacheKeyGenerator.generate(filePath, fs) === cachedKey;
    } catch {
      return false; // File doesn't exist or unreadable
    }
  }
}

export default CacheKeyGenerator;
