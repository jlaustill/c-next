import type IRecordedRequirement from "../../../../types/IRecordedRequirement";
import type IHeaderEmissionFacts from "../../headers/types/IHeaderEmissionFacts";

/** 2.3 Render's artifact for one file: its C, its header's input and its requirements (#1991) */
interface IRenderedSource {
  readonly code: string;
  readonly headerFacts: IHeaderEmissionFacts | null;
  readonly requirements: readonly IRecordedRequirement[];
}

export default IRenderedSource;
