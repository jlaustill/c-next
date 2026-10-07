import type IAnchorFacts from "../../../../PARSE/1-Discover/types/IAnchorFacts";
import type IFileIncludes from "../../../../PARSE/1-Discover/types/IFileIncludes";
import type ICodeGenSymbols from "../../../../types/ICodeGenSymbols";
import type IProgram from "../../../../types/IProgram";
import type TranspileState from "../../../TranspileState";

/**
 * What `HeaderEmissionCapture.capture` reads for one file: the run's artifacts
 * and the file's warm per-file state, handed in by the host rather than
 * reached for.
 */
interface IHeaderEmissionRequest {
  readonly sourcePath: string;
  readonly program: IProgram;
  /** The view `generate()` received, so the `.h` and the `.c` share one */
  readonly typeInput: ICodeGenSymbols;
  readonly state: TranspileState;
  readonly unmodifiedParams: ReadonlyMap<string, ReadonlySet<string>>;
  /** Where the include guard's path is measured from (ADR-063) */
  readonly anchor: IAnchorFacts;
  /** The run's header extension (#1319): read, never re-derived from the mode */
  readonly headerExtension: string;
  /** Every discovered file's includes, from the run's `SourceGraph` */
  readonly includes: ReadonlyMap<string, IFileIncludes>;
  /** This file's entry in `includes`, looked up once, by the host */
  readonly ownIncludes: IFileIncludes;
  readonly cppMode: boolean;
}

export default IHeaderEmissionRequest;
