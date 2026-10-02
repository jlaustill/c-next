/**
 * NodeFileSystem
 * Default implementation of IFileSystem using Node.js fs module.
 *
 * This is the production implementation used when no mock is injected.
 */

import {
  readFileSync,
  writeFileSync,
  existsSync,
  statSync,
  mkdirSync,
  readdirSync,
  realpathSync,
  renameSync,
  unlinkSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import IFileSystem from "../../transpiler/types/IFileSystem";

/**
 * Node.js file system implementation
 */
class NodeFileSystem implements IFileSystem {
  readFile(path: string): string {
    return readFileSync(path, "utf-8");
  }

  writeFile(path: string, content: string): void {
    writeFileSync(path, content, "utf-8");
  }

  exists(path: string): boolean {
    return existsSync(path);
  }

  isDirectory(path: string): boolean {
    if (!existsSync(path)) {
      return false;
    }
    return statSync(path).isDirectory();
  }

  isFile(path: string): boolean {
    if (!existsSync(path)) {
      return false;
    }
    return statSync(path).isFile();
  }

  mkdir(path: string, options?: { recursive?: boolean }): void {
    mkdirSync(path, options);
  }

  unlink(path: string): void {
    unlinkSync(path);
  }

  rename(from: string, to: string): void {
    renameSync(from, to);
  }

  async withTempFile<T>(
    name: string,
    content: string,
    use: (path: string) => Promise<T>,
  ): Promise<T> {
    const dir = mkdtempSync(join(tmpdir(), "cnext-"));
    try {
      const path = join(dir, name);
      writeFileSync(path, content, "utf-8");
      return await use(path);
    } finally {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch {
        // A directory we cannot remove is left for the OS to reclaim.
      }
    }
  }

  readdir(path: string): string[] {
    return readdirSync(path);
  }

  stat(path: string): { mtimeMs: number } {
    const stats = statSync(path);
    return { mtimeMs: stats.mtimeMs };
  }

  realpath(path: string): string {
    return realpathSync(path);
  }

  /**
   * Shared singleton instance for use across all modules. Built once, at
   * module load: it holds no state, and #1452 box 4 forbids a reassignable
   * static under a pass root, which the lazy slot it replaced was (#1444).
   */
  static readonly instance = new NodeFileSystem();
}

export default NodeFileSystem;
