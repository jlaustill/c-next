/**
 * A `tsc` "declared but never read" diagnostic, outside generated output (#1556).
 */
interface IUnusedFinding {
  file: string;
  line: number;
  column: number;
  message: string;
}

export default IUnusedFinding;
