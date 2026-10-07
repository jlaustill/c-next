/**
 * ADR-049: the target catalog shipped with this compiler.
 *
 * Found by walking up from this module to `targets/targets.cnx`, which reaches
 * it from the TypeScript source (tsx, vitest), from the `dist/` bundle, and
 * from an installed package alike -- the catalog sits at the package root in
 * all three. Read through the port the run is handed, like every other file
 * (#1653): a port models the whole filesystem, the compiler's installation
 * included, so a test double that stands in for one seeds the catalog, as
 * `MockFileSystem` does.
 *
 * Read and validated on each call. #1444 moved this module under a pass root,
 * where #1452 box 4 forbids mutable state, and it held a per-port `WeakMap`
 * cache written on first use. The cache is gone rather than moved, since moving
 * it would only put the same state somewhere no guard scans. A cold parse costs
 * about 2.6 ms (measured 2026-10-02, 20 cold reads), and a run makes one.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import TargetCatalogParser from "../PARSE/2-Parse/TargetCatalogParser";
import TargetDescriptions from "../PARSE/4-Resolve/TargetDescriptions";
import type ITargetDescription from "../types/ITargetDescription";
import type IFileSystem from "../types/IFileSystem";

const CATALOG = join("targets", "targets.cnx");

class TargetCatalogFile {
  /**
   * Every target name, aliases included, to the description it denotes.
   * The catalog is an installation file, so a port that models the filesystem
   * models the installation too.
   */
  static targets(fs: IFileSystem): ReadonlyMap<string, ITargetDescription> {
    const path = TargetCatalogFile.locate(fs);
    return TargetDescriptions.catalog(
      TargetCatalogParser.parse(fs.readFile(path)),
      path,
    );
  }

  /** The catalog's path; throws if the installation has none */
  static locate(fs: IFileSystem): string {
    let dir = dirname(fileURLToPath(import.meta.url));
    while (true) {
      const candidate = join(dir, CATALOG);
      if (fs.exists(candidate)) {
        return candidate;
      }
      const parent = dirname(dir);
      if (parent === dir) {
        throw new Error(
          `The target catalog ${CATALOG} was not found above ${fileURLToPath(import.meta.url)}; the compiler installation is broken`,
        );
      }
      dir = parent;
    }
  }
}

export default TargetCatalogFile;
