/**
 * IFileSystem
 * Abstraction over file system operations for testability.
 *
 * This interface allows the Transpiler to be tested with a mock file system
 * instead of requiring actual file I/O during unit tests.
 *
 * Design notes:
 * - All methods are synchronous (matching current Node.js fs usage patterns)
 * - Deletion and rename are here because the host routes through the port too
 *   (#1653, carrying #1451 box 3): only `NodeFileSystem` imports `node:fs`
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
   * Delete a file.
   * @throws Error if the file doesn't exist or can't be deleted
   */
  unlink(path: string): void;

  /**
   * Move a file to a new path.
   * @throws Error if the source doesn't exist or the move fails
   */
  rename(from: string, to: string): void;

  /**
   * Run `use` on a file holding `content`, named `name`, in a fresh directory
   * under the system's temporary directory. The directory is removed when `use`
   * settles, whether it resolves or throws, and a failure to remove it is
   * ignored.
   *
   * For a file an external tool must read from disk (#1653). The directory holds
   * nothing else, which matters: a C preprocessor searches the including file's
   * own directory first for a quoted include, so an empty directory adds nothing
   * to that search. Reading the same content on stdin would search the process's
   * working directory instead, which was measured on gcc and clang (#1653).
   * This is scratch, not output: 3.1 Write owns output, and this directory is
   * gone before the call returns.
   */
  withTempFile<T>(
    name: string,
    content: string,
    use: (path: string) => Promise<T>,
  ): Promise<T>;

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

  /**
   * Resolve symlinks to get the real path.
   * Optional - if not provided, symlink loop detection is skipped.
   * @returns The resolved real path
   * @throws Error if path doesn't exist
   */
  realpath?(path: string): string;
}

export default IFileSystem;
