/**
 * PathNormalizer
 * Centralized path normalization for all config paths.
 * Handles tilde expansion and recursive directory search.
 */

class PathNormalizer {
  /**
   * Expand ~ at the start of a path to the home directory.
   * Only expands leading tilde (~/path or bare ~).
   * @param path - Path that may start with ~
   * @returns Path with ~ expanded to home directory
   */
  static expandTilde(path: string): string {
    if (!path.startsWith("~")) {
      return path;
    }

    const home = process.env.HOME || process.env.USERPROFILE;
    if (!home) {
      return path;
    }

    if (path === "~") {
      return home;
    }

    if (path.startsWith("~/")) {
      return home + path.slice(1);
    }

    return path;
  }
}

export default PathNormalizer;
