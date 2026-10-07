/**
 * PreprocessCache
 *
 * #1844: the outcome of each preprocessor run, so a warm run starts none. A
 * run is keyed by everything on its command line -- the toolchain, defines,
 * include path, `-imacros` predecessors -- and, for a string, its text (a
 * #985 unit's directives). Each entry is valid while every file the compiler
 * read (its `-MD` dependency output) keeps the mtime it had: a header's
 * preprocessed text inlines what it includes, so its own mtime is not enough.
 * The dependency list names only the files found, so each entry also names
 * where a file added would be found ahead of one of those, earlier on the
 * search path; none of those may exist yet.
 *
 * Stored in `.cnx/cache/preprocess.json`, beside `symbols.json`. Each run that
 * writes it is one generation; an entry no run read or wrote in the last
 * `KEEP` of them is dropped, so a configuration given up (old defines, an old
 * include path) does not stay forever.
 */

import { createHash } from "node:crypto";
import { dirname, join } from "node:path";
import IFileSystem from "../../../types/IFileSystem";
import IPreprocessCacheEntry from "./types/IPreprocessCacheEntry";
import Write from "../../../WRITE/1-Write/Write";
import packageJson from "../../../../package.json" with { type: "json" };

/** Bump when an entry's shape or meaning changes */
const FORMAT = 2;

/** How many generations an entry nothing used survives */
const KEEP = 4;

const VERSION = `${packageJson.version}:${FORMAT}`;

class PreprocessCache {
  private readonly path: string;
  private readonly fs: IFileSystem;
  private readonly entries: Map<string, IPreprocessCacheEntry>;
  /** The generation that last read or wrote each entry */
  private readonly used: Map<string, number>;
  /** The generation on disk; this run, if it writes, is the next one */
  private readonly written: number;
  private dirty = false;
  /** Whether each `absent` path exists, asked once a run */
  private readonly exists = new Map<string, boolean>();

  constructor(projectRoot: string, fs: IFileSystem) {
    this.fs = fs;
    this.path = join(projectRoot, ".cnx", "cache", "preprocess.json");
    const stored = PreprocessCache.read(this.path, fs);
    this.entries = stored.entries;
    this.used = stored.used;
    this.written = stored.generation;
  }

  /** The key of a run described by `parts`, which must be JSON */
  static keyOf(parts: readonly unknown[]): string {
    return createHash("sha256").update(JSON.stringify(parts)).digest("hex");
  }

  /** The run `key` names, if no file it read has changed since */
  lookup(key: string): IPreprocessCacheEntry | null {
    const entry = this.entries.get(key);
    if (entry === undefined) return null;
    if (this.unchanged(entry)) {
      // Kept fresh on disk only when it would otherwise start to age
      if ((this.used.get(key) ?? 0) < this.written) this.dirty = true;
      this.used.set(key, this.written + 1);
      return entry;
    }
    this.entries.delete(key);
    this.used.delete(key);
    this.dirty = true;
    return null;
  }

  record(key: string, entry: IPreprocessCacheEntry): void {
    this.entries.set(key, entry);
    this.used.set(key, this.written + 1);
    this.dirty = true;
  }

  flush(): void {
    if (!this.dirty) return;
    const generation = this.written + 1;
    const kept: Record<string, IPreprocessCacheEntry & { used: number }> = {};
    for (const [key, entry] of this.entries) {
      const used = this.used.get(key) ?? 0;
      if (used > generation - KEEP) kept[key] = { ...entry, used };
    }
    Write.directory(this.fs, dirname(this.path));
    Write.file(
      this.fs,
      this.path,
      JSON.stringify({ version: VERSION, generation, entries: kept }),
    );
    this.dirty = false;
  }

  private unchanged(entry: IPreprocessCacheEntry): boolean {
    try {
      return (
        entry.deps.every(
          ([path, mtimeMs]) => this.fs.stat(path).mtimeMs === mtimeMs,
        ) && entry.absent.every((path) => !this.existsNow(path))
      );
    } catch {
      return false; // a file it read is gone
    }
  }

  private existsNow(path: string): boolean {
    let found = this.exists.get(path);
    if (found === undefined) {
      found = this.fs.exists(path);
      this.exists.set(path, found);
    }
    return found;
  }

  /**
   * The entries the file holds, or none: a cache written by another version,
   * or one that does not parse, is re-derived, never trusted.
   */
  private static read(
    path: string,
    fs: IFileSystem,
  ): {
    entries: Map<string, IPreprocessCacheEntry>;
    used: Map<string, number>;
    generation: number;
  } {
    const entries = new Map<string, IPreprocessCacheEntry>();
    const used = new Map<string, number>();
    const none = { entries, used, generation: 0 };
    if (!fs.exists(path)) return none;
    let stored: unknown;
    try {
      stored = JSON.parse(fs.readFile(path));
    } catch {
      return none;
    }
    if (
      typeof stored !== "object" ||
      stored === null ||
      !("version" in stored) ||
      stored.version !== VERSION ||
      !("generation" in stored) ||
      typeof stored.generation !== "number" ||
      !("entries" in stored) ||
      typeof stored.entries !== "object" ||
      stored.entries === null
    ) {
      return none;
    }
    for (const [key, entry] of Object.entries(stored.entries)) {
      if (!PreprocessCache.isEntry(entry)) continue;
      const { used: generation, ...run } = entry;
      entries.set(key, run);
      used.set(key, generation);
    }
    return { entries, used, generation: stored.generation };
  }

  private static isEntry(
    value: unknown,
  ): value is IPreprocessCacheEntry & { used: number } {
    if (typeof value !== "object" || value === null) return false;
    const entry = value as Record<string, unknown>;
    return (
      typeof entry.used === "number" &&
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
      ) &&
      Array.isArray(entry.absent) &&
      entry.absent.every((path: unknown) => typeof path === "string")
    );
  }
}

export default PreprocessCache;
