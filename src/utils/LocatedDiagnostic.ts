import type ISourceSite from "../types/ISourceSite";

/**
 * #1844: a diagnostic thrown before any file has a result to carry it, at the
 * position it is about. `message` keeps the `E<NNNN>: ` shape that marks a
 * deliberate diagnostic, and the orchestrator reports it at `site` with
 * `helpText` under it, not as `1:0 Pipeline failed:`.
 */
class LocatedDiagnostic extends Error {
  constructor(
    readonly code: string,
    readonly text: string,
    readonly site: ISourceSite,
    readonly helpText: string,
  ) {
    super(`${code}: ${text}`);
    this.name = "LocatedDiagnostic";
  }
}

export default LocatedDiagnostic;
