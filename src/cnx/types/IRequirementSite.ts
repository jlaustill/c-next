/**
 * Issue #1143: Where in the user's source a toolchain requirement was incurred.
 */
interface IRequirementSite {
  /** Path of the .cnx file that incurred the requirement. */
  readonly sourcePath: string;

  /** 1-based line in that file, or null when the emitter has no position. */
  readonly line: number | null;
}

export default IRequirementSite;
