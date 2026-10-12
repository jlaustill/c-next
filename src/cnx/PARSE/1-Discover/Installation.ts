/**
 * The compiler's own installation, as 1.1 Discover reads it.
 *
 * Found by walking up from this module to `targets/targets.cnx`, which reaches
 * it from the TypeScript source (tsx, vitest), from the `dist/` bundle, and
 * from an installed package alike -- the catalog sits at the package root in
 * all three. Looked up through the port the run is handed, like every other
 * file (#1653): a port models the whole filesystem, the installation included.
 */
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import type IFileSystem from "../../types/IFileSystem";

const CATALOG = join("targets", "targets.cnx");

class Installation {
  /** The target catalog's path (ADR-049); throws if the installation has none */
  static catalog(fs: IFileSystem): string {
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

  /**
   * A directory that holds no header: the catalog's, which holds the catalog
   * alone (`Installation.test.ts`). The preprocessor runs a string from here,
   * since on standard input cpp searches its working directory first for a
   * quoted include (#1653, #1991).
   */
  static headerFreeDirectory(fs: IFileSystem): string {
    return dirname(Installation.catalog(fs));
  }
}

export default Installation;
