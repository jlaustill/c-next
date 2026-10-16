/** #1713: the compiler 1.2 reads a run's headers with, which the host runs */
interface IHeaderCompiler {
  /** A driver name, looked up on PATH, or a path */
  readonly driver: string;

  /** The target's own flags (`-mmcu=`, `-mcpu=`), on every run */
  readonly flags: readonly string[];
}

export default IHeaderCompiler;
