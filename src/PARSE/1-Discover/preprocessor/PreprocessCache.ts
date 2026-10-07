/**
 * PreprocessCache
 *
 * #1844: the outcome of each preprocessor run, so a warm run starts none. A
 * run is keyed by everything on its command line -- the toolchain, defines,
 * include path, `-imacros` predecessors -- and, for a string, its text (a
 * #985 unit's directives). Each entry is valid while every file the compiler
 * read (its `-MD` dependency output) keeps the mtime it had: a header's
 * preprocessed text inlines what it includes, so its own mtime is not enough.
 *
 * Stored in `.cnx/cache/preprocess.json`, beside `symbols.json`.
 */

import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import IFileSystem from "../../../types/IFileSystem";
import IPreprocessCacheEntry from "./types/IPreprocessCacheEntry";
import Write from "../../../WRITE/1-Write/Write";
import packageJson from "../../../../package.json" with { type: "json" };

/** Bump when an entry's shape or meaning changes */
const FORMAT = 1;

const VERSION = `${packageJson.version}:${FORMAT}`;

class PreprocessCache {
  private readonly path: string;
  private readonly fs: IFileSystem;
  private readonly entries: Map<string, IPreprocessCacheEntry>;
  private dirty = false;

  constructor(projectRoot: string, fs: IFileSystem) {
    this.fs = fs;
    this.path = join(projectRoot, ".cnx", "cache", "preprocess.json");
    this.entries = PreprocessCache.read(this.path, fs);
  }

  /** The key of a run described by `parts`, which must be JSON */
  static keyOf(parts: readonly unknown[]): string {
    return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  }

  /** The run `key` names, if no file it read has changed since */
  lookup(key: string): IPreprocessCacheEntry | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (this.unchanged(entry)) return entry;
    this.entries.delete(key);
    this.dirty = true;
    return null;
  }

  record(key: string, entry: IPreprocessCacheEntry): void {
    this.entries.set(key, entry);
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    Write.directory(this.fs, dirname(this.path));
    Write.file(
      this.fs,
      this.path,
      JSON.stringify({
        version: VERSION,
        entries: Object.fromEntries(this.entries),
      }),
    );
    this.dirty = false;
  }

  private unchanged(entry: IPreprocessCacheEntry): boolean {
    try {
      return entry.deps.every(
        ([path, mtimeMs]) => this.fs.stat(path).mtimeMs === mtimeMs,
      );
    } catch {
      return false; // a file it read is gone
    }
  }

  /**
   * The entries the file holds, or none: a cache written by another version,
   * or one that does not parse, is re-derived, never trusted.
   */
  private static read(
    path: string,
    fs: IFileSystem,
  ): Map<string, IPreprocessCacheEntry> {
    const entries = new Map<string, IPreprocessCacheEntry>();
    if (!fs.exists(path)) return entries;
    let stored: unknown;
    try {
      stored = JSON.parse(fs.readFile(path));
    } catch {
      return entries;
    }
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("version" in stored) ||
      stored.version !== VERSION ||
      !("entries" in stored) ||
      typeof stored.entries !== "object" ||
      stored.entries === null
    ) {
      return entries;
    }
    for (const [key, entry] of Object.entries(stored.entries)) {
      if (PreprocessCache.isEntry(entry)) entries.set(key, entry);
    }
    return entries;
  }

  private static isEntry(value: unknown): value is IPreprocessCacheEntry {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
      typeof entry.stdout === "string" &&
      typeof entry.stderr === "string" &&
      (entry.error === null || typeof entry.error === "string") &&
      Array.isArray(entry.deps) &&
      entry.deps.every(
        (dep: unknown) =>
          Array.isArray(dep) &&
          dep.length === 2 &&
          typeof dep[0] === "string" &&
          typeof dep[1] === "number",
      )
    );
  }
}

export default PreprocessCache;
