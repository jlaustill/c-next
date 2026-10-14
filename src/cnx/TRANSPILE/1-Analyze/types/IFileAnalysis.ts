import type ITranspileError from "../../../types/ITranspileError";
import type IValuePositions from "../../../types/IValuePositions";

/** What 2.1 finds in one file, and the value positions it hands on (#1991) */
interface IFileAnalysis {
  readonly errors: ITranspileError[];
  /** Where each value stands; null when an error stopped the analysis */
  readonly valuePositions: IValuePositions | null;
}

export default IFileAnalysis;
