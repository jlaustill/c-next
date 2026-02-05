/**
 * Include Resolver
 * Resolves #include directives to file paths
 * Supports both "header.h" (local) and <header.h> (system/SDK) syntax
 */

import * as vscode from "vscode";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * Parsed include directive
 */
export interface IIncludeDirective {
  /** The include path as written (e.g., "myheader.h" or "subdir/header.h") */
  path: string;
  /** Whether this is a system include (<>) vs local include ("") */
  isSystem: boolean;
  /** Line number where the include appears (1-based) */
  line: number;
}

/**
 * Configuration for include path resolution
 */
export interface IIncludeConfig {
  /** Paths for resolving "header.h" includes (relative to file) */
  localIncludePaths: string[];
  /** Paths for resolving SDK headers (user-configured) */
  sdkIncludePaths: string[];
  /** Patterns to exclude from header parsing */
  excludePatterns: string[];
  /** Workspace root path */
  workspaceRoot: string;
}

/**
 * Default include configuration
 */
export const DEFAULT_INCLUDE_CONFIG: IIncludeConfig = {
  localIncludePaths: [".", "include", "src"],
  sdkIncludePaths: [],
  excludePatterns: [
    // System headers - too complex to parse
    "stdio.h",
    "stdlib.h",
    "string.h",
    "stdint.h",
    "stdbool.h",
    "math.h",
    "time.h",
    "errno.h",
    "assert.h",
    "limits.h",
    "stddef.h",
    "stdarg.h",
    "ctype.h",
    "signal.h",
    "setjmp.h",
    // C++ standard library
    "iostream",
    "vector",
    "string",
    "map",
    "set",
    "algorithm",
  ],
  workspaceRoot: "",
};
/**
 * Include Resolver
 * Resolves include paths to actual file locations
 */
export default class IncludeResolver {
  private config: IIncludeConfig;

  constructor(config: Partial<IIncludeConfig> = {}) {
    this.config = { ...DEFAULT_INCLUDE_CONFIG, ...config };
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<IIncludeConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Extract all #include directives from source code
   */
  extractIncludes(source: string): IIncludeDirective[] {
    const includes: IIncludeDirective[] = [];
    const lines = source.split("\n");

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const match = line.match(/#include\s*([<"])([^>"]+)[>"]/);

      if (match) {
        includes.push({
          path: match[2],
          isSystem: match[1] === "<",
          line: i + 1, // 1-based line number
        });
      }
    }

    return includes;
  }

  /**
   * Resolve an include path to an absolute file path
   * @param includePath The path from the #include directive
   * @param fromFile The file containing the #include
   * @param isSystem Whether this is a <> include
   * @returns Absolute path to the header, or undefined if not found
   */
  resolve(
    includePath: string,
    fromFile: string,
    isSystem: boolean = false,
  ): string | undefined {
    // Check if this is an excluded header
    if (this.isExcluded(includePath)) {
      return undefined;
    }

    const fromDir = path.dirname(fromFile);

    // For local includes ("header.h"), try relative to the current file first
    if (!isSystem) {
      const relativePath = path.join(fromDir, includePath);
      const resolved = path.resolve(relativePath);
      if (this.isWithinBoundary(resolved) && fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // Try local include paths
    for (const searchPath of this.config.localIncludePaths) {
      const fullSearchPath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.config.workspaceRoot, searchPath);

      const candidatePath = path.join(fullSearchPath, includePath);
      const resolved = path.resolve(candidatePath);
      if (this.isWithinBoundary(resolved) && fs.existsSync(resolved)) {
        return resolved;
      }
    }

    // Try SDK include paths (for both local and system includes)
    for (const sdkPath of this.config.sdkIncludePaths) {
      const candidatePath = path.join(sdkPath, includePath);
      if (fs.existsSync(candidatePath)) {
        return path.resolve(candidatePath);
      }
    }

    return undefined;
  }

  /**
   * Resolve all includes from a source file
   * @param source The source code
   * @param fromFile The file path
   * @returns Array of resolved absolute paths
   */
  resolveAll(source: string, fromFile: string): string[] {
    const includes = this.extractIncludes(source);
    const resolved: string[] = [];

    for (const inc of includes) {
      const resolvedPath = this.resolve(inc.path, fromFile, inc.isSystem);
      if (resolvedPath) {
        resolved.push(resolvedPath);
      }
    }

    return resolved;
  }

  /**
   * Check if a resolved path stays within the workspace root or configured local include paths.
   * Prevents path traversal attacks (e.g., #include "../../../../etc/passwd").
   */
  private isWithinBoundary(resolvedPath: string): boolean {
    // Must be within workspace root
    if (this.config.workspaceRoot) {
      if (resolvedPath.startsWith(this.config.workspaceRoot)) {
        return true;
      }
    }

    // Or within a configured local include path
    for (const searchPath of this.config.localIncludePaths) {
      const absSearchPath = path.isAbsolute(searchPath)
        ? searchPath
        : path.join(this.config.workspaceRoot, searchPath);
      if (resolvedPath.startsWith(path.resolve(absSearchPath))) {
        return true;
      }
    }

    return false;
  }

  /**
   * Check if a header should be excluded from parsing
   */
  private isExcluded(includePath: string): boolean {
    const basename = path.basename(includePath);

    for (const pattern of this.config.excludePatterns) {
      if (basename === pattern || includePath === pattern) {
        return true;
      }
      // Simple glob matching for patterns like "sys/*"
      if (
        pattern.endsWith("/*") &&
        includePath.startsWith(pattern.slice(0, -1))
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Load include configuration from VS Code settings and c_cpp_properties.json
   */
  static loadConfig(workspaceRoot: string): IIncludeConfig {
    const config: IIncludeConfig = {
      ...DEFAULT_INCLUDE_CONFIG,
      workspaceRoot,
    };

    // Load from VS Code settings
    const vsConfig = vscode.workspace.getConfiguration("cnext");
    const userIncludePaths = vsConfig.get<string[]>("includePaths", []);
    const userSdkPaths = vsConfig.get<string[]>("sdkIncludePaths", []);
    const userExcludePatterns = vsConfig.get<string[]>(
      "indexing.excludePatterns",
      [],
    );

    if (userIncludePaths.length > 0) {
      config.localIncludePaths = [
        ...config.localIncludePaths,
        ...userIncludePaths,
      ];
    }

    if (userSdkPaths.length > 0) {
      config.sdkIncludePaths = userSdkPaths;
    }

    if (userExcludePatterns.length > 0) {
      config.excludePatterns = [
        ...config.excludePatterns,
        ...userExcludePatterns,
      ];
    }

    // Try to load from c_cpp_properties.json
    const cppPropertiesPath = path.join(
      workspaceRoot,
      ".vscode",
      "c_cpp_properties.json",
    );
    if (fs.existsSync(cppPropertiesPath)) {
      try {
        const cppProperties = JSON.parse(
          fs.readFileSync(cppPropertiesPath, "utf-8"),
        );
        const configurations = cppProperties.configurations || [];

        // Find a configuration (prefer the first one, or one matching the platform)
        const activeConfig = configurations[0];
        if (activeConfig?.includePath) {
          const cppIncludePaths = activeConfig.includePath
            .filter((p: string) => !p.includes("${") && !p.includes("**"))
            .map((p: string) => {
              // Resolve relative paths
              if (path.isAbsolute(p)) {
                return p;
              }
              return path.join(workspaceRoot, p);
            });

          config.sdkIncludePaths = [
            ...config.sdkIncludePaths,
            ...cppIncludePaths,
          ];
        }
      } catch {
        // Ignore parse errors in c_cpp_properties.json
      }
    }

    return config;
  }
}
