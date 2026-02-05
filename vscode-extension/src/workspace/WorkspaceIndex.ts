/**
 * Workspace Symbol Index
 * Singleton that manages workspace-wide symbol indexing for the VS Code extension
 * Supports both .cnx files and C/C++ headers via IncludeResolver
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";
import { CharStream, CommonTokenStream } from "antlr4ng";
import SymbolCache from "./SymbolCache";
import { IWorkspaceConfig, DEFAULT_WORKSPACE_CONFIG } from "./types";
import parseWithSymbols from "../../../src/lib/parseWithSymbols";
import ISymbolInfo from "../../../src/lib/types/ISymbolInfo";
import IncludeResolver from "./IncludeResolver";
import { CLexer } from "../../../src/antlr_parser/c/grammar/CLexer";
import { CParser } from "../../../src/antlr_parser/c/grammar/CParser";
import CSymbolCollector from "../../../src/symbol_resolution/CSymbolCollector";
import { CACHE_CLEANUP_INTERVAL_MS } from "../utils";

/**
 * Workspace-wide symbol index
 * Provides cross-file symbol lookup for IDE features
 */
export default class WorkspaceIndex {
  private static instance: WorkspaceIndex | null = null;

  private cache: SymbolCache;

  private headerCache: SymbolCache; // Separate cache for header files

  private config: IWorkspaceConfig;

  private workspaceFolders: vscode.WorkspaceFolder[] = [];

  private initialized: boolean = false;

  private indexing: boolean = false;

  /** Include resolver for header file paths */
  private includeResolver: IncludeResolver;

  /** Map of file -> included headers (dependency graph) */
  private includeDependencies: Map<string, string[]> = new Map();

  /** Periodic cache cleanup interval */
  private cleanupInterval: ReturnType<typeof setInterval> | null = null;

  /** Debounce timer for file changes */
  private fileChangeTimer: NodeJS.Timeout | null = null;

  private pendingChanges: Set<string> = new Set();

  /** Status bar item for showing index status */
  private statusBarItem: vscode.StatusBarItem | null = null;

  private constructor() {
    this.cache = new SymbolCache();
    this.headerCache = new SymbolCache();
    this.config = { ...DEFAULT_WORKSPACE_CONFIG };
    this.includeResolver = new IncludeResolver();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): WorkspaceIndex {
    if (!WorkspaceIndex.instance) {
      WorkspaceIndex.instance = new WorkspaceIndex();
    }
    return WorkspaceIndex.instance;
  }

  /**
   * Initialize the workspace index
   * Scans workspace folders for .cnx and header files and indexes them
   */
  async initialize(folders: vscode.WorkspaceFolder[]): Promise<void> {
    if (this.initialized) {
      return;
    }

    this.workspaceFolders = folders;
    this.initialized = true;

    // Load include resolver config for the first workspace folder
    if (folders.length > 0) {
      const includeConfig = IncludeResolver.loadConfig(folders[0].uri.fsPath);
      this.includeResolver.updateConfig(includeConfig);
    }

    // Start background indexing
    if (this.config.enableBackgroundIndexing) {
      this.indexWorkspace();
    }

    // Set up periodic cache cleanup
    this.cleanupInterval = setInterval(() => {
      this.cache.clearUnused();
      this.headerCache.clearUnused();
    }, CACHE_CLEANUP_INTERVAL_MS);
  }

  /**
   * Index all .cnx files in the workspace
   */
  private async indexWorkspace(): Promise<void> {
    if (this.indexing) {
      return;
    }

    this.indexing = true;
    this.updateStatusBar("$(sync~spin) Indexing...");

    try {
      for (const folder of this.workspaceFolders) {
        await this.indexFolder(folder.uri.fsPath);
      }

      const stats = this.getStats();
      const totalSymbols = stats.cnxSymbols + stats.headerSymbols;
      const headerInfo =
        stats.headersIndexed > 0 ? ` (+${stats.headersIndexed} headers)` : "";
      this.updateStatusBar(`$(check) ${totalSymbols} symbols${headerInfo}`);
    } catch (error) {
      console.error("Workspace indexing error:", error);
      this.updateStatusBar("$(warning) Index error");
    } finally {
      this.indexing = false;
    }
  }

  /**
   * Recursively index a folder for .cnx files
   */
  private async indexFolder(folderPath: string): Promise<void> {
    try {
      const entries = fs.readdirSync(folderPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(folderPath, entry.name);

        // Skip excluded patterns
        if (this.isExcluded(fullPath)) {
          continue;
        }

        if (entry.isDirectory()) {
          await this.indexFolder(fullPath);
        } else if (entry.isFile() && entry.name.endsWith(".cnx")) {
          await this.indexFile(vscode.Uri.file(fullPath));
        }
      }
    } catch (_error) {
      // Ignore permission errors, etc.
    }
  }

  /**
   * Index a single .cnx file
   */
  private async indexFile(uri: vscode.Uri): Promise<void> {
    // Check if already cached and not stale
    if (this.cache.has(uri) && !this.cache.isStale(uri)) {
      return;
    }

    try {
      const stat = fs.statSync(uri.fsPath);

      // Skip large files
      if (stat.size > this.config.maxFileSizeKb * 1024) {
        return;
      }

      const source = fs.readFileSync(uri.fsPath, "utf-8");
      const result = parseWithSymbols(source);

      // Add source file path to each symbol
      const symbolsWithFile = result.symbols.map((s) => ({
        ...s,
        sourceFile: uri.fsPath,
      }));

      this.cache.set(uri, symbolsWithFile, stat.mtimeMs, !result.success);

      // Extract and resolve includes, then index headers
      const includes = this.includeResolver.extractIncludes(source);
      const resolvedHeaders: string[] = [];

      for (const inc of includes) {
        const resolvedPath = this.includeResolver.resolve(
          inc.path,
          uri.fsPath,
          inc.isSystem,
        );
        if (resolvedPath) {
          resolvedHeaders.push(resolvedPath);
          // Index the header file
          await this.indexHeaderFile(vscode.Uri.file(resolvedPath));
        }
      }

      // Store dependency graph
      this.includeDependencies.set(uri.fsPath, resolvedHeaders);
    } catch (_error) {
      // File read error - skip
    }
  }

  /**
   * Index a header file (.h or .c) using the C parser
   */
  private async indexHeaderFile(uri: vscode.Uri): Promise<void> {
    // Check if already cached and not stale
    if (this.headerCache.has(uri) && !this.headerCache.isStale(uri)) {
      return;
    }

    try {
      const stat = fs.statSync(uri.fsPath);

      // Skip large files
      if (stat.size > this.config.maxFileSizeKb * 1024) {
        return;
      }

      const source = fs.readFileSync(uri.fsPath, "utf-8");

      // Parse with C parser
      const charStream = CharStream.fromString(source);
      const lexer = new CLexer(charStream);
      const tokenStream = new CommonTokenStream(lexer);
      const parser = new CParser(tokenStream);

      // Suppress error output for headers (they often have incomplete code)
      lexer.removeErrorListeners();
      parser.removeErrorListeners();

      const tree = parser.compilationUnit();
      const collector = new CSymbolCollector(uri.fsPath);
      const symbols = collector.collect(tree);

      // Convert to ISymbolInfo format
      const symbolsWithFile: ISymbolInfo[] = symbols.map((s) => ({
        name: s.name,
        fullName: s.parent ? `${s.parent}.${s.name}` : s.name,
        kind: this.mapSymbolKind(s.kind),
        type: s.type,
        line: s.sourceLine,
        sourceFile: uri.fsPath,
      }));

      this.headerCache.set(uri, symbolsWithFile, stat.mtimeMs, false);
    } catch (_error) {
      // Parse error - skip silently (headers can be complex)
    }
  }

  /**
   * Map internal symbol kind to ISymbolInfo kind string
   */
  private mapSymbolKind(kind: string | number): string {
    // Handle both string and enum values
    const kindMap: Record<string | number, string> = {
      function: "function",
      variable: "variable",
      struct: "struct",
      enum: "enum",
      type: "type",
      enumMember: "field",
      // Enum values (from ESymbolKind)
      0: "variable", // Variable
      1: "function", // Function
      2: "struct", // Struct
      3: "enum", // Enum
      4: "type", // Type
      5: "field", // EnumMember
    };
    return kindMap[kind] || "variable";
  }

  /**
   * Check if a path should be excluded from indexing
   */
  private isExcluded(filePath: string): boolean {
    for (const pattern of this.config.excludePatterns) {
      // Simple glob matching
      if (pattern.includes("**/")) {
        const suffix = pattern.replace("**/", "");
        if (filePath.includes(suffix.replace("/**", ""))) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Find a symbol definition by name
   * Returns the first matching symbol across the workspace
   * Searches .cnx files first, then included headers if fromFile is provided
   */
  findDefinition(name: string, fromFile?: vscode.Uri): ISymbolInfo | undefined {
    const allSymbols = this.cache.getAllSymbols();

    // First, look for an exact match on fullName in .cnx files
    let symbol = allSymbols.find((s) => s.fullName === name);
    if (symbol) {
      return symbol;
    }

    // Then look for a match on name in .cnx files
    symbol = allSymbols.find((s) => s.name === name);
    if (symbol) {
      return symbol;
    }

    // If we have a source file context, check its included headers
    if (fromFile) {
      const includedSymbols = this.getIncludedSymbols(fromFile);
      symbol = includedSymbols.find((s) => s.name === name);
      if (symbol) {
        return symbol;
      }
    }

    // Finally, check all header symbols
    const headerSymbols = this.headerCache.getAllSymbols();
    symbol = headerSymbols.find((s) => s.name === name);
    return symbol;
  }

  /**
   * Get all symbols from headers included by a file
   * @param uri The source file to check includes for
   */
  getIncludedSymbols(uri: vscode.Uri): ISymbolInfo[] {
    const includedHeaders = this.includeDependencies.get(uri.fsPath) || [];
    const symbols: ISymbolInfo[] = [];

    for (const headerPath of includedHeaders) {
      const headerUri = vscode.Uri.file(headerPath);
      const entry = this.headerCache.get(headerUri);
      if (entry) {
        symbols.push(...entry.symbols);
      }
    }

    return symbols;
  }

  /**
   * Get all symbols from a specific file
   */
  getSymbolsForFile(uri: vscode.Uri): ISymbolInfo[] {
    // Ensure file is indexed
    if (!this.cache.has(uri) || this.cache.isStale(uri)) {
      // Synchronous index for immediate use
      try {
        const stat = fs.statSync(uri.fsPath);
        const source = fs.readFileSync(uri.fsPath, "utf-8");
        const result = parseWithSymbols(source);

        const symbolsWithFile = result.symbols.map((s) => ({
          ...s,
          sourceFile: uri.fsPath,
        }));

        this.cache.set(uri, symbolsWithFile, stat.mtimeMs, !result.success);
      } catch {
        return [];
      }
    }

    const entry = this.cache.get(uri);
    return entry?.symbols || [];
  }

  /**
   * Get all symbols in the workspace
   */
  getAllSymbols(): ISymbolInfo[] {
    return this.cache.getAllSymbols();
  }

  /**
   * Handle file change event
   */
  onFileChanged(uri: vscode.Uri): void {
    // Debounce rapid changes
    this.pendingChanges.add(uri.toString());

    if (this.fileChangeTimer) {
      clearTimeout(this.fileChangeTimer);
    }

    this.fileChangeTimer = setTimeout(() => {
      this.processPendingChanges();
    }, 300);
  }

  /**
   * Handle file deletion
   */
  onFileDeleted(uri: vscode.Uri): void {
    const filePath = uri.fsPath;

    if (filePath.endsWith(".cnx")) {
      this.cache.invalidate(uri);
      this.includeDependencies.delete(filePath);
    } else if (filePath.endsWith(".h") || filePath.endsWith(".c")) {
      this.headerCache.invalidate(uri);
      // Invalidate any .cnx files that included this header
      this.invalidateDependentFiles(filePath);
    }
  }

  /**
   * Handle file creation
   */
  onFileCreated(uri: vscode.Uri): void {
    const filePath = uri.fsPath;

    if (filePath.endsWith(".cnx")) {
      this.indexFile(uri);
    }
    // Headers are indexed on-demand when included
  }

  /**
   * Invalidate .cnx files that include a changed header
   */
  private invalidateDependentFiles(headerPath: string): void {
    for (const [cnxPath, headers] of this.includeDependencies) {
      if (headers.includes(headerPath)) {
        this.cache.invalidate(vscode.Uri.file(cnxPath));
      }
    }
  }

  /**
   * Process pending file changes
   */
  private processPendingChanges(): void {
    for (const uriString of this.pendingChanges) {
      const uri = vscode.Uri.parse(uriString);
      const filePath = uri.fsPath;

      if (filePath.endsWith(".cnx")) {
        this.cache.invalidate(uri);
        this.indexFile(uri);
      } else if (filePath.endsWith(".h") || filePath.endsWith(".c")) {
        this.headerCache.invalidate(uri);
        // Invalidate dependent .cnx files so they re-resolve includes
        this.invalidateDependentFiles(filePath);
      }
    }

    this.pendingChanges.clear();
    this.fileChangeTimer = null;
  }

  /**
   * Set the status bar item for displaying index status
   */
  setStatusBarItem(item: vscode.StatusBarItem): void {
    this.statusBarItem = item;
  }

  /**
   * Update status bar text
   */
  private updateStatusBar(text: string): void {
    if (this.statusBarItem) {
      this.statusBarItem.text = text;
    }
  }

  /**
   * Force reindex of the workspace
   */
  reindex(): void {
    this.cache.clear();
    this.headerCache.clear();
    this.includeDependencies.clear();
    this.indexWorkspace();
  }

  /**
   * Check if a filename exists in multiple locations in the workspace
   * Used for smart path display in hover tooltips
   */
  hasFilenameConflict(fileName: string): boolean {
    const allFiles = new Set<string>();

    // Check CNX files
    const cnxSymbols = this.cache.getAllSymbols();
    for (const symbol of cnxSymbols) {
      if (symbol.sourceFile) {
        const name = path.basename(symbol.sourceFile);
        if (name === fileName) {
          allFiles.add(symbol.sourceFile);
          if (allFiles.size > 1) {
            return true;
          }
        }
      }
    }

    // Check header files
    const headerSymbols = this.headerCache.getAllSymbols();
    for (const symbol of headerSymbols) {
      if (symbol.sourceFile) {
        const name = path.basename(symbol.sourceFile);
        if (name === fileName) {
          allFiles.add(symbol.sourceFile);
          if (allFiles.size > 1) {
            return true;
          }
        }
      }
    }

    return false;
  }

  /**
   * Get statistics about the index
   */
  getStats(): {
    cnxSymbols: number;
    headerSymbols: number;
    filesIndexed: number;
    headersIndexed: number;
  } {
    const cnxStats = this.cache.getStats();
    const headerStats = this.headerCache.getStats();
    return {
      cnxSymbols: cnxStats.symbolCount,
      headerSymbols: headerStats.symbolCount,
      filesIndexed: cnxStats.fileCount,
      headersIndexed: headerStats.fileCount,
    };
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    if (this.fileChangeTimer) {
      clearTimeout(this.fileChangeTimer);
    }
    this.cache.clear();
    this.headerCache.clear();
    this.includeDependencies.clear();
    this.initialized = false;
    WorkspaceIndex.instance = null;
  }
}
