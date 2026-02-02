/**
 * MockFileSystem
 * In-memory file system implementation for unit testing.
 *
 * Allows tests to set up virtual files and verify write operations
 * without touching the actual file system.
 */

import { dirname, basename } from "node:path";
import IFileSystem from "../types/IFileSystem";

/**
 * Mock file system for testing
 */
class MockFileSystem implements IFileSystem {
  /** In-memory file storage: path -> content */
  private files = new Map<string, string>();

  /** In-memory file mtime storage: path -> mtimeMs */
  private fileMtimes = new Map<string, number>();

  /** In-memory directory storage */
  private directories = new Set<string>();

  /** Track write operations for assertions */
  private writeLog: Array<{ path: string; content: string }> = [];

  /** Track mkdir operations for assertions */
  private mkdirLog: Array<{ path: string; recursive?: boolean }> = [];

  /**
   * Add a virtual file to the mock file system.
   * Also adds parent directories automatically.
   * @param path File path
   * @param content File content
   * @param mtime Optional modification time in milliseconds (defaults to Date.now())
   */
  addFile(path: string, content: string, mtime?: number): this {
    this.files.set(path, content);
    this.fileMtimes.set(path, mtime ?? Date.now());
    // Auto-create parent directories
    let dir = dirname(path);
    while (dir && dir !== "/" && dir !== ".") {
      this.directories.add(dir);
      dir = dirname(dir);
    }
    return this;
  }

  /**
   * Add a virtual directory to the mock file system.
   * Also adds parent directories automatically.
   */
  addDirectory(path: string): this {
    this.directories.add(path);
    // Auto-create parent directories
    let dir = dirname(path);
    while (dir && dir !== "/" && dir !== ".") {
      this.directories.add(dir);
      dir = dirname(dir);
    }
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
    this.fileMtimes.clear();
    this.directories.clear();
    this.writeLog = [];
    this.mkdirLog = [];
  }

  /**
   * Set/update the modification time for a file (for cache testing)
   */
  setMtime(path: string, mtime: number): void {
    if (this.files.has(path)) {
      this.fileMtimes.set(path, mtime);
    }
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

  readdir(path: string): string[] {
    if (!this.directories.has(path)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    const entries: string[] = [];

    // Find all files in this directory
    for (const filePath of this.files.keys()) {
      if (dirname(filePath) === path) {
        entries.push(basename(filePath));
      }
    }

    // Find all immediate subdirectories
    for (const dirPath of this.directories) {
      if (dirname(dirPath) === path && dirPath !== path) {
        entries.push(basename(dirPath));
      }
    }

    return entries;
  }

  stat(path: string): { mtimeMs: number } {
    const mtime = this.fileMtimes.get(path);
    if (mtime === undefined) {
      throw new Error(`ENOENT: no such file or directory, stat '${path}'`);
    }
    return { mtimeMs: mtime };
  }
}

export default MockFileSystem;
