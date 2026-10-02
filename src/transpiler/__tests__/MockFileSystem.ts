/**
 * MockFileSystem
 * In-memory file system implementation for unit testing.
 *
 * Allows tests to set up virtual files and verify write operations
 * without touching the actual file system.
 */

import { dirname, basename } from "node:path";
import IFileSystem from "../types/IFileSystem";
import NodeFileSystem from "../../PARSE/1-Discover/NodeFileSystem";
import TargetCatalogFile from "../../PARSE/1-Discover/TargetCatalogFile";

/**
 * Mock file system for testing
 */
class MockFileSystem implements IFileSystem {
  /** In-memory file storage: path -> content */
  private readonly files = new Map<string, string>();

  /** In-memory file mtime storage: path -> mtimeMs */
  private readonly fileMtimes = new Map<string, number>();

  /** In-memory directory storage */
  private readonly directories = new Set<string>();

  /** Track write operations for assertions */
  private writeLog: Array<{ path: string; content: string }> = [];

  /** Track mkdir operations for assertions */
  private readonly mkdirLog: Array<{ path: string; recursive?: boolean }> = [];

  /**
   * A filesystem the compiler is installed on. The target catalog is an
   * installation file read through the port (#1653), so a double that lacks it
   * models a broken installation, not an empty project.
   */
  constructor() {
    try {
      const catalog = TargetCatalogFile.locate(NodeFileSystem.instance);
      this.files.set(catalog, NodeFileSystem.instance.readFile(catalog));
    } catch (err) {
      // Name the real cause rather than let "the compiler installation is
      // broken" suggest one (#1826 review).
      throw new Error(
        `MockFileSystem seeds the target catalog from the real disk and could not (${String(err)}). A test that mocks node:fs must keep existsSync and readFileSync real.`,
        { cause: err },
      );
    }
  }

  /**
   * Normalize path by removing trailing slashes (except for root "/")
   */
  private normalizePath(path: string): string {
    if (path === "/") return path;
    // Scanned rather than /\/+$/, which backtracks super-linearly on a long
    // run of '/' (S8786).
    let end = path.length;
    while (end > 0 && path[end - 1] === "/") {
      end -= 1;
    }
    return path.slice(0, end);
  }

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
   * Clear just the write log (for testing multiple runs)
   */
  clearWriteLog(): void {
    this.writeLog = [];
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
    const normalized = this.normalizePath(path);
    return this.files.has(normalized) || this.directories.has(normalized);
  }

  isDirectory(path: string): boolean {
    return this.directories.has(this.normalizePath(path));
  }

  isFile(path: string): boolean {
    return this.files.has(this.normalizePath(path));
  }

  mkdir(path: string, options?: { recursive?: boolean }): void {
    const normalized = this.normalizePath(path);
    this.directories.add(normalized);
    this.mkdirLog.push({ path: normalized, recursive: options?.recursive });
  }

  unlink(path: string): void {
    const normalized = this.normalizePath(path);
    if (!this.files.delete(normalized)) {
      throw new Error(`ENOENT: no such file or directory, unlink '${path}'`);
    }
    this.fileMtimes.delete(normalized);
  }

  rename(from: string, to: string): void {
    const source = this.normalizePath(from);
    const content = this.files.get(source);
    if (content === undefined) {
      throw new Error(`ENOENT: no such file or directory, rename '${from}'`);
    }
    this.files.delete(source);
    this.files.set(this.normalizePath(to), content);
  }

  /** Temporary directories handed out, for naming the next one */
  private tempDirCount = 0;

  async withTempFile<T>(
    name: string,
    content: string,
    use: (path: string) => Promise<T>,
  ): Promise<T> {
    this.tempDirCount += 1;
    const dir = `/tmp/cnext-mock-${this.tempDirCount}`;
    const path = `${dir}/${name}`;
    this.directories.add(dir);
    this.files.set(path, content);
    try {
      return await use(path);
    } finally {
      this.files.delete(path);
      this.directories.delete(dir);
    }
  }

  readdir(path: string): string[] {
    const normalized = this.normalizePath(path);
    if (!this.directories.has(normalized)) {
      throw new Error(`ENOENT: no such file or directory, scandir '${path}'`);
    }

    const entries: string[] = [];

    // Find all files in this directory
    for (const filePath of this.files.keys()) {
      if (dirname(filePath) === normalized) {
        entries.push(basename(filePath));
      }
    }

    // Find all immediate subdirectories
    for (const dirPath of this.directories) {
      if (dirname(dirPath) === normalized && dirPath !== normalized) {
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
