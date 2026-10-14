import type IAnalyzedFile from "../../types/IAnalyzedFile";
import invariant from "../../utils/invariant";
import type IAnalysis from "./types/IAnalysis";

/**
 * 2.1's per-file lookup, for the passes after it and the host (#2074 review).
 * It stays in 2.1 so `FileFacts`, which every pass may import, names no pass
 * after 1.1.
 */
class AnalyzedFiles {
  /** What 2.1 kept of one file that produces output */
  static fileOf(analysis: IAnalysis, sourcePath: string): IAnalyzedFile {
    const analyzed = analysis.files.get(sourcePath);
    invariant(
      analyzed !== undefined,
      `2.1 Analyze keeps every file that produces output (missing ${sourcePath})`,
    );
    return analyzed;
  }
}

export default AnalyzedFiles;
