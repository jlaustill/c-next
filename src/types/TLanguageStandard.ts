/**
 * Issue #1143: Language-standard axis of a toolchain requirement.
 *
 * C and C++ values are never ordered against each other -- compare only within
 * a family, using LANGUAGE_STANDARD_FAMILY to establish which family a value
 * belongs to and LANGUAGE_STANDARD_ORDER to rank it.
 */
type TLanguageStandard = "C99" | "C11" | "C++11" | "C++14" | "C++20";

export default TLanguageStandard;
