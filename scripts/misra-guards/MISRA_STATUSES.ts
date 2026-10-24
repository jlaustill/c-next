/** Status buckets a guideline row can carry, longest-first for prefix matching. */
const MISRA_STATUSES = [
  "Not Enforced",
  "By Design",
  "Deviation",
  "Enforced",
  "Planned",
  "Partial",
  "N/A",
] as const;

export default MISRA_STATUSES;
