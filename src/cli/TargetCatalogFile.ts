/**
 * ADR-049: the target catalog shipped with this compiler.
 *
 * Found by `Installation`, which 1.1 Discover owns. Read through the port the run is handed, like every other file
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
import Installation from "../cnx/PARSE/1-Discover/Installation";
import TargetCatalogParser from "../cnx/PARSE/2-Parse/TargetCatalogParser";
import TargetDescriptions from "../cnx/PARSE/4-Resolve/TargetDescriptions";
import type ITargetDescription from "../cnx/types/ITargetDescription";
import type IFileSystem from "../cnx/types/IFileSystem";

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
    return Installation.catalog(fs);
  }
}

export default TargetCatalogFile;
