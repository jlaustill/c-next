import { dirname, resolve, join, isAbsolute } from "node:path";
import { existsSync, statSync, readdirSync, readFileSync } from "node:fs";

/**
 * Auto-discovery of include paths for C-Next compilation
 *
 * Implements 4-tier include path discovery:
 * 1. File's own directory (for relative #include "header.h")
 * 2. Project root (walk up to find platformio.ini, cnext.config.json, .git)
 * 3. PlatformIO library dependencies (.pio/libdeps/ and lib_extra_dirs)
 * 4. Arduino library paths (~/Arduino/libraries/ or ~/Documents/Arduino/libraries/)
 *
 * Note: System paths (compiler defaults) not included to avoid dependencies.
 * Users can add system paths via --include flag if needed.
 */
class IncludeDiscovery {
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

      // Tier 3: Issue #355 - PlatformIO library dependencies
      // When platformio.ini exists, check for .pio/libdeps/ and add all library paths
      const pioIniPath = join(projectRoot, "platformio.ini");
      if (existsSync(pioIniPath)) {
        const libDepsPath = join(projectRoot, ".pio", "libdeps");
        if (existsSync(libDepsPath) && statSync(libDepsPath).isDirectory()) {
          const pioLibPaths = this.discoverPlatformIOLibPaths(libDepsPath);
          paths.push(...pioLibPaths);
        }

        // Issue #355: Also parse lib_extra_dirs from platformio.ini
        const extraDirs = this.parsePlatformIOLibExtraDirs(
          pioIniPath,
          projectRoot,
        );
        paths.push(...extraDirs);
      }
    }

    // Tier 4: Issue #355 - Arduino library paths
    // Check for Arduino libraries in common locations
    const arduinoPaths = this.discoverArduinoLibPaths();
    paths.push(...arduinoPaths);

    // Remove duplicates
    return Array.from(new Set(paths));
  }

  /**
   * Discover Arduino library paths
   *
   * Issue #355: Arduino stores libraries in platform-specific locations:
   * - Linux: ~/Arduino/libraries/
   * - macOS: ~/Documents/Arduino/libraries/
   * - Windows: %USERPROFILE%\Documents\Arduino\libraries\
   *
   * @returns Array of library directory paths
   */
  private static discoverArduinoLibPaths(): string[] {
    const paths: string[] = [];
    const home = process.env.HOME || process.env.USERPROFILE || "";

    if (!home) return paths;

    // Common Arduino library locations
    const arduinoLibDirs = [
      join(home, "Arduino", "libraries"), // Linux
      join(home, "Documents", "Arduino", "libraries"), // macOS / Windows
    ];

    for (const libDir of arduinoLibDirs) {
      if (existsSync(libDir) && statSync(libDir).isDirectory()) {
        try {
          // Add each library directory
          const libs = readdirSync(libDir);
          for (const lib of libs) {
            const libPath = join(libDir, lib);
            if (statSync(libPath).isDirectory()) {
              paths.push(libPath);

              // Also check for common subdirectories where headers might live
              const subDirs = ["src", "include", "src/include"];
              for (const subDir of subDirs) {
                const subPath = join(libPath, subDir);
                if (existsSync(subPath) && statSync(subPath).isDirectory()) {
                  paths.push(subPath);
                }
              }
            }
          }
        } catch (_error: unknown) {
          // Silently ignore errors reading directories
        }
      }
    }

    return paths;
  }

  /**
   * Discover PlatformIO library dependency paths
   *
   * PlatformIO stores libraries in .pio/libdeps/<env>/<library>/
   * This function finds all library directories across all environments.
   *
   * @param libDepsPath - Path to .pio/libdeps/
   * @returns Array of library directory paths
   */
  private static discoverPlatformIOLibPaths(libDepsPath: string): string[] {
    const paths: string[] = [];

    try {
      // Iterate through environment directories (e.g., teensy40, teensy41, esp32)
      const envDirs = readdirSync(libDepsPath);
      for (const envDir of envDirs) {
        const envPath = join(libDepsPath, envDir);
        if (statSync(envPath).isDirectory()) {
          // Iterate through library directories within each environment
          const libDirs = readdirSync(envPath);
          for (const libDir of libDirs) {
            const libPath = join(envPath, libDir);
            if (statSync(libPath).isDirectory()) {
              // Add the library root (most headers are here)
              paths.push(libPath);

              // Also check for common subdirectories where headers might live
              const subDirs = ["src", "include", "src/include"];
              for (const subDir of subDirs) {
                const subPath = join(libPath, subDir);
                if (existsSync(subPath) && statSync(subPath).isDirectory()) {
                  paths.push(subPath);
                }
              }
            }
          }
        }
      }
    } catch (_error: unknown) {
      // Silently ignore errors reading directories
    }

    return paths;
  }

  /**
   * Parse platformio.ini for lib_extra_dirs
   *
   * Issue #355: PlatformIO allows specifying additional library directories
   * via lib_extra_dirs in platformio.ini. This parses those and returns
   * resolved absolute paths.
   *
   * @param pioIniPath - Path to platformio.ini
   * @param projectRoot - Project root directory for resolving relative paths
   * @returns Array of library directory paths
   */
  private static parsePlatformIOLibExtraDirs(
    pioIniPath: string,
    projectRoot: string,
  ): string[] {
    const paths: string[] = [];

    try {
      const content = readFileSync(pioIniPath, "utf-8");

      // Match lib_extra_dirs in any section
      // Format can be:
      //   lib_extra_dirs = path1, path2
      //   lib_extra_dirs =
      //     path1
      //     path2
      const libExtraDirsRegex =
        /^\s*lib_extra_dirs\s*=\s*(.+?)(?=^\s*\[|\s*^\w+\s*=|$)/gms;
      let match;

      while ((match = libExtraDirsRegex.exec(content)) !== null) {
        const value = match[1];

        // Split by newlines or commas, handling both single-line and multi-line formats
        const dirs = value
          .split(/[\n,]/)
          .map((d) => {
            // Strip inline comments (e.g., "path ; comment" or "path # comment")
            const semicolonIdx = d.indexOf(";");
            const hashIdx = d.indexOf("#");
            const commentIndex = Math.min(
              semicolonIdx === -1 ? Infinity : semicolonIdx,
              hashIdx === -1 ? Infinity : hashIdx,
            );
            return d.slice(0, commentIndex).trim();
          })
          .map((d) => {
            // Strip surrounding quotes (e.g., "path with spaces" or 'path')
            if (
              (d.startsWith('"') && d.endsWith('"')) ||
              (d.startsWith("'") && d.endsWith("'"))
            ) {
              return d.slice(1, -1);
            }
            return d;
          })
          .filter((d) => d.length > 0);

        for (const dir of dirs) {
          // Resolve relative to project root
          const fullPath = isAbsolute(dir) ? dir : join(projectRoot, dir);
          if (existsSync(fullPath) && statSync(fullPath).isDirectory()) {
            paths.push(fullPath);
          }
        }
      }
    } catch (_error: unknown) {
      // Silently ignore errors reading platformio.ini
    }

    return paths;
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
   * @returns Array of include paths (for backwards compatibility)
   */
  static extractIncludes(content: string): string[] {
    return this.extractIncludesWithInfo(content).map((info) => info.path);
  }

  /**
   * Extract #include directives with local/system info
   *
   * Issue #355: Returns whether each include is local ("...") or system (<...>)
   * so we can warn appropriately when local includes aren't found.
   *
   * @param content - Source file content
   * @returns Array of include info objects
   */
  static extractIncludesWithInfo(
    content: string,
  ): Array<{ path: string; isLocal: boolean }> {
    const includes: Array<{ path: string; isLocal: boolean }> = [];

    // Match #include directives, capturing the delimiter to determine local vs system
    const includeRegex = /^\s*#\s*include\s*([<"])([^>"]+)[>"]/gm;
    let match;

    while ((match = includeRegex.exec(content)) !== null) {
      const delimiter = match[1];
      const path = match[2];
      includes.push({
        path,
        isLocal: delimiter === '"',
      });
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

export default IncludeDiscovery;
