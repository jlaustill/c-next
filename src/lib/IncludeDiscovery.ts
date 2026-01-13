import { dirname, resolve, join, isAbsolute } from "path";
import { existsSync, statSync } from "fs";

/**
 * Auto-discovery of include paths for C-Next compilation
 *
 * Implements 2-tier include path discovery:
 * 1. File's own directory (for relative #include "header.h")
 * 2. Project root (walk up to find platformio.ini, cnext.config.json, .git)
 *
 * Note: System paths (compiler defaults) not included to avoid dependencies.
 * Users can add system paths via --include flag if needed.
 */
export class IncludeDiscovery {
  /**
   * Discover include paths for a file
   *
   * @param inputFile - Path to .cnx file being compiled
   * @returns Array of include directory paths
   */
  static discoverIncludePaths(inputFile: string): string[] {
    const paths: string[] = [];

    // Tier 1: File's own directory (highest priority)
    const fileDir = dirname(resolve(inputFile));
    paths.push(fileDir);

    // Tier 2: Project root detection
    const projectRoot = this.findProjectRoot(fileDir);
    if (projectRoot) {
      // Add common include directories if they exist
      const commonDirs = ["include", "src", "lib"];
      for (const dir of commonDirs) {
        const includePath = join(projectRoot, dir);
        if (existsSync(includePath) && statSync(includePath).isDirectory()) {
          paths.push(includePath);
        }
      }
    }

    // Remove duplicates
    return Array.from(new Set(paths));
  }

  /**
   * Find project root by walking up directory tree looking for markers
   *
   * Project markers (in order of preference):
   * - platformio.ini (PlatformIO project)
   * - cnext.config.json or .cnext.json (C-Next config)
   * - .git/ (Git repository root)
   *
   * @param startDir - Directory to start search from
   * @returns Project root path or null if not found
   */
  static findProjectRoot(startDir: string): string | null {
    let dir = resolve(startDir);

    const markers = [
      "platformio.ini",
      "cnext.config.json",
      ".cnext.json",
      ".cnextrc",
      ".git",
    ];

    // Walk up directory tree until marker found or filesystem root
    while (dir !== dirname(dir)) {
      for (const marker of markers) {
        const markerPath = join(dir, marker);
        if (existsSync(markerPath)) {
          return dir;
        }
      }
      dir = dirname(dir);
    }

    return null;
  }

  /**
   * Extract #include directives from source code
   *
   * Matches both:
   * - #include "header.h" (local includes)
   * - #include <header.h> (system includes)
   *
   * @param content - Source file content
   * @returns Array of include paths
   */
  static extractIncludes(content: string): string[] {
    const includes: string[] = [];

    // Match #include directives (both "..." and <...>)
    const includeRegex = /^\s*#\s*include\s*[<"]([^>"]+)[>"]/gm;
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
      includes.push(match[1]);
    }

    return includes;
  }

  /**
   * Resolve an include path using search directories
   *
   * @param includePath - The include path from #include directive
   * @param searchPaths - Directories to search in
   * @returns Resolved absolute path or null if not found
   */
  static resolveInclude(
    includePath: string,
    searchPaths: string[],
  ): string | null {
    // If already absolute, check if it exists
    if (isAbsolute(includePath)) {
      return existsSync(includePath) ? includePath : null;
    }

    // Search in each directory
    for (const searchDir of searchPaths) {
      const fullPath = join(searchDir, includePath);
      if (existsSync(fullPath) && statSync(fullPath).isFile()) {
        return fullPath;
      }
    }

    return null;
  }
}
