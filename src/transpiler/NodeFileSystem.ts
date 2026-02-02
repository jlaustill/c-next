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
} from "node:fs";
import IFileSystem from "./types/IFileSystem";

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
}

export default NodeFileSystem;
