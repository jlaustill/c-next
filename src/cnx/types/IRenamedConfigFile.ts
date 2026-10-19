/**
 * A config file found under a name cnx no longer reads (#2165). It is E0918
 * wherever a walk meets it: an old name is never read, and never silently
 * skipped.
 */
interface IRenamedConfigFile {
  /** The old-name file. */
  readonly path: string;

  /** The name it is read under now, in the same directory. */
  readonly successor: string;

  /** The config already in its directory under a new name, if any. */
  readonly besideConfig: string | null;
}

export default IRenamedConfigFile;
