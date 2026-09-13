/**
 * A line that is trying to be a test marker but is not spelled the way the
 * harness reads that marker (#1555).
 */
interface IMarkerSpelling {
  /** The marker name the line names, e.g. `test-no-warnings`. */
  marker: string;
  /** 1-based line number within the fixture. */
  line: number;
  /** The offending line, trimmed. */
  text: string;
}

export default IMarkerSpelling;
