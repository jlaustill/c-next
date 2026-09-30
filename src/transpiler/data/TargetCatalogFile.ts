/**
 * ADR-049: the target catalog shipped with this compiler.
 *
 * Found by walking up from this module to `targets/targets.cnx`, which reaches
 * it from the TypeScript source (tsx, vitest), from the `dist/` bundle, and
 * from an installed package alike -- the catalog sits at the package root in
 * all three. Read with `node:fs` rather than the run's `IFileSystem`: the
 * catalog belongs to the compiler, not to the program being compiled, and a
 * run on an in-memory file system still needs it.
 *
 * Read and validated once per process, on first use.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import TargetCatalogParser from "../../PARSE/2-Parse/TargetCatalogParser";
import TargetDescriptions from "../../PARSE/4-Resolve/TargetDescriptions";
import type ITargetDescription from "../types/ITargetDescription";
import type IFileSystem from "../types/IFileSystem";

const CATALOG = join("targets", "targets.cnx");

class TargetCatalogFile {
  /**
   * Per port, not per process: a single slot would hand every later port the
   * first port's answer, so a run's catalog would depend on who asked first.
   */
  private static readonly loaded = new WeakMap<
    IFileSystem,
    ReadonlyMap<string, ITargetDescription>
  >();

  /**
   * Every target name, aliases included, to the description it denotes.
   * Read once per port. The catalog is an installation file, so a port that
   * models the filesystem models the installation too.
   */
  static targets(fs: IFileSystem): ReadonlyMap<string, ITargetDescription> {
    let catalog = TargetCatalogFile.loaded.get(fs);
    if (!catalog) {
      const path = TargetCatalogFile.locate(fs);
      catalog = TargetDescriptions.catalog(
        TargetCatalogParser.parse(fs.readFile(path)),
        path,
      );
      TargetCatalogFile.loaded.set(fs, catalog);
    }
    return catalog;
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
