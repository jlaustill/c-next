import type TLanguageStandard from "../types/TLanguageStandard";

/**
 * Issue #1143: Ordering within a language family, so "above the baseline" is a
 * comparison rather than a hand-maintained list that drifts.
 *
 * Only compare values whose LANGUAGE_STANDARD_FAMILY matches.
 */
const LANGUAGE_STANDARD_ORDER: Record<TLanguageStandard, number> = {
  C99: 1,
  C11: 2,
  "C++11": 1,
  "C++14": 2,
  "C++20": 3,
};

export default LANGUAGE_STANDARD_ORDER;
