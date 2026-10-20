/**
 * Where one C-Next file's output goes, as 1.1 Discover names it (#1991). The
 * passes carry it to 3.1 Write, which writes there and decides nothing.
 */
interface IOutputPaths {
  /**
   * How the `.c`/`.cpp` names its own header: relative to where it is written
   * (#2272/#1473), the header's basename in a source run
   */
  readonly selfInclude: string;
  /** The generated `.c`/`.cpp` */
  readonly source: string;
  /** The generated `.h`/`.hpp` */
  readonly header: string;
}

export default IOutputPaths;
