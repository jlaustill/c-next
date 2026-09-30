/**
 * ADR-049: a target name to its description, from the target catalog
 * (`targets/targets.cnx`), read once per process. Nothing here holds a second
 * list of targets, and nothing here decides a run's target -- 1.4 Resolve
 * settles that once, from every file's pragmas and the target option.
 */

import type ITargetDescription from "../transpiler/types/ITargetDescription";
import TargetCatalogFile from "../transpiler/data/TargetCatalogFile";
import type IFileSystem from "../transpiler/types/IFileSystem";

class TargetResolver {
  /**
   * The catalog's description for a named target, or undefined when the name
   * is unknown. Names match exactly (ADR-049): `TEENSY41` is not `teensy41`.
   */
  static byName(
    name: string | undefined,
    fs: IFileSystem,
  ): ITargetDescription | undefined {
    return name ? TargetCatalogFile.targets(fs).get(name) : undefined;
  }

  /** Every name the catalog defines, aliases included */
  static names(fs: IFileSystem): string[] {
    return [...TargetCatalogFile.targets(fs).keys()];
  }
}

export default TargetResolver;
