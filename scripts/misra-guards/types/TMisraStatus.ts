import type MISRA_STATUSES from "../MISRA_STATUSES";

/** A guideline row's status in docs/misra-compliance.md */
type TMisraStatus = (typeof MISRA_STATUSES)[number];

export default TMisraStatus;
