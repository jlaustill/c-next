/**
 * Options for header file generation
 */
interface IHeaderOptions {
  /** Guard prefix (default: derived from filename) */
  guardPrefix?: string;

  /** Include system headers in the output */
  includeSystemHeaders?: boolean;

  /** Only generate declarations for exported symbols */
  exportedOnly?: boolean;
}

export default IHeaderOptions;
