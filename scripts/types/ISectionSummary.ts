/**
 * Summary statistics for a section
 */
interface ISectionSummary {
  /** Section name (e.g., "1. Primitive Types") */
  name: string;

  /** Total coverage items in section */
  total: number;

  /** Items marked as tested [x] */
  tested: number;

  /** Items with test annotations */
  annotated: number;

  /** Coverage percentage */
  percentage: number;
}

export default ISectionSummary;
