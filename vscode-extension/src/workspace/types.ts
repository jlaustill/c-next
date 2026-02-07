/**
 * Workspace Symbol Index Types
 * Shared types for workspace-wide symbol indexing
 */

/**
 * Symbol information for IDE features
 * Local definition to avoid importing from main transpiler source
 */
export interface ISymbolInfo {
  /** Symbol name (e.g., "toggle", "DR_SET") */
  name: string;
  /** Full qualified name (e.g., "LED_toggle", "GPIO7_DR_SET") */
  fullName: string;
  /** Kind of symbol */
  kind: string;
  /** Type of the symbol (e.g., "void", "u32") */
  type?: string;
  /** Parent namespace/class/register name */
  parent?: string;
  /** Function signature (e.g., "void toggle()") */
  signature?: string;
  /** Access modifier for register members */
  accessModifier?: string;
  /** Line number in source (1-based) */
  line: number;
  /** Array size or bit width */
  size?: number;
  /** Source file path */
  sourceFile?: string;
  /** Source language */
  language?: string;
}

/**
 * Cache entry for a parsed file
 */
export interface ICacheEntry {
  /** File URI as string */
  uri: string;
  /** Symbols extracted from this file */
  symbols: ISymbolInfo[];
  /** File modification time (for staleness detection) */
  mtime: number;
  /** Files this file includes (for dependency tracking - Phase 2) */
  dependencies: string[];
  /** Whether the file had parse errors */
  hasErrors: boolean;
}

/**
 * Workspace configuration for symbol indexing
 */
export interface IWorkspaceConfig {
  /** Include paths for "header.h" resolution */
  localIncludePaths: string[];
  /** SDK include paths for system/SDK headers */
  sdkIncludePaths: string[];
  /** Patterns to exclude from indexing */
  excludePatterns: string[];
  /** Maximum file size to index (KB) */
  maxFileSizeKb: number;
  /** Whether background indexing is enabled */
  enableBackgroundIndexing: boolean;
}

/**
 * Default workspace configuration
 */
export const DEFAULT_WORKSPACE_CONFIG: IWorkspaceConfig = {
  localIncludePaths: [],
  sdkIncludePaths: [],
  excludePatterns: ["**/node_modules/**", "**/.git/**"],
  maxFileSizeKb: 500,
  enableBackgroundIndexing: true,
};

/**
 * Result of parsing a file for the workspace index
 */
export interface IFileParseResult {
  /** File URI */
  uri: string;
  /** Extracted symbols */
  symbols: ISymbolInfo[];
  /** Include directives found (Phase 2) */
  includes: string[];
  /** Whether parsing succeeded */
  success: boolean;
  /** File modification time */
  mtime: number;
}
