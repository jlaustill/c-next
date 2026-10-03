import type ITargetCatalogEntry from "./ITargetCatalogEntry";

/**
 * The target catalog as read by 1.2 Parse: its structs, its constants and what
 * could not be read. Plain data, so the validator never holds a parse tree.
 */
interface ITargetCatalogSource {
  /** Struct name -> member name -> the member's C-Next type, as written */
  readonly structs: ReadonlyMap<string, ReadonlyMap<string, string>>;
  readonly entries: readonly ITargetCatalogEntry[];
  /** `line N: message` for each syntax error and each non-literal value */
  readonly errors: readonly string[];
}

export default ITargetCatalogSource;
