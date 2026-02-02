/**
 * MockFileSystem
 * In-memory file system implementation for unit testing.
 *
 * Allows tests to set up virtual files and verify write operations
 * without touching the actual file system.
 */

import IFileSystem from "../types/IFileSystem";

/**
 * Mock file system for testing
 */
class MockFileSystem implements IFileSystem {
  /** In-memory file storage: path -> content */
  private files = new Map<string, string>();

  /** In-memory directory storage */
  private directories = new Set<string>();

  /** Track write operations for assertions */
  private writeLog: Array<{ path: string; content: string }> = [];

  /** Track mkdir operations for assertions */
  private mkdirLog: Array<{ path: string; recursive?: boolean }> = [];

  /**
   * Add a virtual file to the mock file system
   */
  addFile(path: string, content: string): this {
    this.files.set(path, content);
    return this;
  }

  /**
   * Add a virtual directory to the mock file system
   */
  addDirectory(path: string): this {
    this.directories.add(path);
    return this;
  }

  /**
   * Get the content that was written to a path (for assertions)
   */
  getWrittenContent(path: string): string | undefined {
    const entry = this.writeLog.find((w) => w.path === path);
    return entry?.content;
  }

  /**
   * Get all write operations (for assertions)
   */
  getWriteLog(): ReadonlyArray<{ path: string; content: string }> {
    return this.writeLog;
  }

  /**
   * Get all mkdir operations (for assertions)
   */
  getMkdirLog(): ReadonlyArray<{ path: string; recursive?: boolean }> {
    return this.mkdirLog;
  }

  /**
   * Clear all files, directories, and logs
   */
  reset(): void {
    this.files.clear();
    this.directories.clear();
    this.writeLog = [];
    this.mkdirLog = [];
  }

  // === IFileSystem implementation ===

  readFile(path: string): string {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, open '${path}'`);
    }
    return content;
  }

  writeFile(path: string, content: string): void {
    this.files.set(path, content);
    this.writeLog.push({ path, content });
  }

  exists(path: string): boolean {
    return this.files.has(path) || this.directories.has(path);
  }

  isDirectory(path: string): boolean {
    return this.directories.has(path);
  }

  isFile(path: string): boolean {
    return this.files.has(path);
  }

  mkdir(path: string, options?: { recursive?: boolean }): void {
    this.directories.add(path);
    this.mkdirLog.push({ path, recursive: options?.recursive });
  }
}

export default MockFileSystem;
