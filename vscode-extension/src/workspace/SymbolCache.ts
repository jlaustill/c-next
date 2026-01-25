/**
 * Symbol Cache
 * Per-file caching of parsed symbols with staleness detection
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import { ICacheEntry } from "./types";
import { ISymbolInfo } from "../../../src/lib/transpiler";

/**
 * Cache for parsed file symbols
 * Tracks file modification times to detect stale entries
 */
export default class SymbolCache {
  private cache: Map<string, ICacheEntry> = new Map();

  /** Time in ms before unused cache entries are cleared */
  private readonly CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

  /** Last access time for each cache entry */
  private lastAccess: Map<string, number> = new Map();

  /**
   * Get cached symbols for a file
   * Returns undefined if not cached or stale
   */
  get(uri: vscode.Uri): ICacheEntry | undefined {
    const key = uri.toString();
    const entry = this.cache.get(key);

    if (!entry) {
      return undefined;
    }

    // Update last access time
    this.lastAccess.set(key, Date.now());

    return entry;
  }

  /**
   * Store symbols for a file
   */
  set(
    uri: vscode.Uri,
    symbols: ISymbolInfo[],
    mtime: number,
    hasErrors: boolean = false,
  ): void {
    const key = uri.toString();

    this.cache.set(key, {
      uri: key,
      symbols,
      mtime,
      dependencies: [], // Populated in Phase 2
      hasErrors,
    });

    this.lastAccess.set(key, Date.now());
  }

  /**
   * Check if a cached entry is stale (file has been modified)
   */
  isStale(uri: vscode.Uri): boolean {
    const key = uri.toString();
    const entry = this.cache.get(key);

    if (!entry) {
      return true; // Not cached = stale
    }

    try {
      const stat = fs.statSync(uri.fsPath);
      return stat.mtimeMs > entry.mtime;
    } catch {
      // File doesn't exist or can't be accessed
      return true;
    }
  }

  /**
   * Invalidate cache for a file
   */
  invalidate(uri: vscode.Uri): void {
    const key = uri.toString();
    this.cache.delete(key);
    this.lastAccess.delete(key);
  }

  /**
   * Get all cached symbols across all files
   */
  getAllSymbols(): ISymbolInfo[] {
    const allSymbols: ISymbolInfo[] = [];
    for (const entry of this.cache.values()) {
      allSymbols.push(...entry.symbols);
    }
    return allSymbols;
  }

  /**
   * Get all cached file URIs
   */
  getCachedFiles(): string[] {
    return Array.from(this.cache.keys());
  }

  /**
   * Check if a file is cached
   */
  has(uri: vscode.Uri): boolean {
    return this.cache.has(uri.toString());
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
    this.lastAccess.clear();
  }

  /**
   * Clear stale entries that haven't been accessed recently
   */
  clearUnused(): void {
    const now = Date.now();
    const toDelete: string[] = [];

    for (const [key, lastAccess] of this.lastAccess) {
      if (now - lastAccess > this.CACHE_TTL_MS) {
        toDelete.push(key);
      }
    }

    for (const key of toDelete) {
      this.cache.delete(key);
      this.lastAccess.delete(key);
    }
  }

  /**
   * Get cache statistics
   */
  getStats(): { fileCount: number; symbolCount: number } {
    let symbolCount = 0;
    for (const entry of this.cache.values()) {
      symbolCount += entry.symbols.length;
    }
    return {
      fileCount: this.cache.size,
      symbolCount,
    };
  }
}
