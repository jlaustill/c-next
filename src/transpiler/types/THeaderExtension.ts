/**
 * The extension a generated header gets.
 *
 * Issue #933: `.hpp` in C++ mode, so C and C++ headers cannot overwrite each
 * other. Issue #1319 review: a literal union rather than `string`, so a header
 * extension cannot be passed where a source extension belongs, or the reverse.
 * See [TSourceExtension] for why presence alone was not enough.
 */
type THeaderExtension = ".h" | ".hpp";

export default THeaderExtension;
