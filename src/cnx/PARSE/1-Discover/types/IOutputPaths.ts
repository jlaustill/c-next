/**
 * Where one C-Next file's output goes, as 1.1 Discover names it (#1991). The
 * passes carry it to 3.1 Write, which writes there and decides nothing.
 */
interface IOutputPaths {
  /** The file's path below its input directory, which its banner names */
  readonly sourceRelativePath: string;
  /** The generated `.c`/`.cpp` */
  readonly source: string;
  /** The generated `.h`/`.hpp` */
  readonly header: string;
}

export default IOutputPaths;
