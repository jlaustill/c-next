import type TDiscoveryFacts from "../../../PARSE/1-Discover/types/TDiscoveryFacts";
import type IAnalyzedFile from "../../../types/IAnalyzedFile";
import type IDiagnostics from "../../../types/IDiagnostics";
import type IProgram from "../../../types/IProgram";

/** 2.1 Analyze's artifact, which 2.2 Plan takes (#1991) */
interface IAnalysis {
  readonly program: IProgram;
  readonly discovery: TDiscoveryFacts;
  readonly diagnostics: IDiagnostics;
  readonly files: ReadonlyMap<string, IAnalyzedFile>;
}

export default IAnalysis;
