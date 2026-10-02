import type EFileType from "../../../transpiler/data/types/EFileType";

/**
 * ADR-010 facts about the file under analysis: 1.1 Discover's answers, read
 * rather than re-derived (#1672).
 *
 * Every map is keyed by `IncludeDirectiveText.join`. #1322 and #1435
 * handed this pass discovery's INPUTS instead -- the search path, the
 * quoted-include directory and a file-exists oracle -- and it made its own
 * decision with them, along its own branch between the two forms. That
 * decision missed an absolute angle include discovery resolves, and asked the
 * file system a second time, so the two could answer differently.
 */
interface IIncludeContext {
  /** The file each directive resolved to, or null: E0506's question. */
  readonly resolutions: ReadonlyMap<string, string | null>;

  /**
   * For each include of a header whose C-Next source the same form of include
   * would find, that source's spelling: E0504's question. An include with no
   * entry has none.
   */
  readonly cnextAlternatives: ReadonlyMap<string, string>;

  /**
   * The kind of file each directive's spelling names (#1444, owner ruling 1):
   * E0503's question and half of E0506's. 2.1 kept its own extension list for
   * E0503 and asked discovery's classifier for E0506; the list had already
   * diverged from discovery on `.c++` (#1840).
   */
  readonly kinds: ReadonlyMap<string, EFileType>;
}

export default IIncludeContext;
