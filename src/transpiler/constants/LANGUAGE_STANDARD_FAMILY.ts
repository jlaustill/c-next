import type TLanguageStandard from "../types/TLanguageStandard";

/**
 * Issue #1143: Which language family a standard belongs to.
 *
 * Ranks from LANGUAGE_STANDARD_ORDER are only comparable within a family --
 * "C11 > C++11" is not a meaningful statement.
 */
const LANGUAGE_STANDARD_FAMILY: Record<TLanguageStandard, "c" | "cpp"> = {
  C99: "c",
  C11: "c",
  "C++11": "cpp",
  "C++14": "cpp",
  "C++20": "cpp",
};

export default LANGUAGE_STANDARD_FAMILY;
