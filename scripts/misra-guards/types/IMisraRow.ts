import type TMisraStatus from "./TMisraStatus";

/** One guideline row: `| 11.9 | description | **By Design** | reference |` */
interface IMisraRow {
  readonly id: string;
  readonly status: TMisraStatus;
  readonly reference: string;
}

export default IMisraRow;
