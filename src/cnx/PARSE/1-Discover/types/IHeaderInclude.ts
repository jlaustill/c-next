import type ISourceSite from "../../../types/ISourceSite";

/**
 * #1844: a `.cnx` file's include of a C/C++ header, at its first occurrence in
 * that file. E0507 and E0517 are reported there.
 */
interface IHeaderInclude {
  /** The header, by the path discovery resolved it to */
  readonly header: string;
  readonly site: ISourceSite;
}

export default IHeaderInclude;
