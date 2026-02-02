/**
 * IFileSystem
 * Abstraction over file system operations for testability.
 *
 * This interface allows the Transpiler to be tested with a mock file system
 * instead of requiring actual file I/O during unit tests.
 *
 * Design notes:
 * - All methods are synchronous (matching current Node.js fs usage patterns)
 * - File deletion (unlink/rmSync) intentionally omitted - not needed for transpilation
 * - Add async variants if performance optimization requires it in the future
 */

interface IFileSystem {
  /**
   * Read a file's contents as UTF-8 string.
   * @throws Error if file doesn't exist or can't be read
   */
  readFile(path: string): string;

  /**
   * Write content to a file (creates directories if needed).
   */
  writeFile(path: string, content: string): void;

  /**
   * Check if a path exists (file or directory).
   */
  exists(path: string): boolean;

  /**
   * Check if a path is a directory.
   * @returns false if path doesn't exist or is a file
   */
  isDirectory(path: string): boolean;

  /**
   * Check if a path is a file.
   * @returns false if path doesn't exist or is a directory
   */
  isFile(path: string): boolean;

  /**
   * Create a directory (and parent directories if recursive is true).
   */
  mkdir(path: string, options?: { recursive?: boolean }): void;

  /**
   * Read directory contents.
   * @returns Array of entry names (not full paths)
   * @throws Error if directory doesn't exist or can't be read
   */
  readdir(path: string): string[];

  /**
   * Get file stats (for cache key generation).
   * @returns Object with at least mtimeMs (modification time in milliseconds)
   * @throws Error if file doesn't exist or can't be read
   */
  stat(path: string): { mtimeMs: number };
}

export default IFileSystem;
