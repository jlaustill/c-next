/**
 * The extension a generated translation unit gets.
 *
 * Issue #1319 review: a literal union rather than `string`. Handing sites the
 * extension instead of the mode gave `PathResolver.getOutputPath` and
 * `getHeaderOutputPath` identical signatures carrying different facts, so
 * `getOutputPath(file, extensions.header)` typechecked and emitted a `.hpp`
 * translation unit. The boolean signature had no such hazard, because both
 * methods consumed the same fact.
 *
 * Requiring the argument closed "the caller forgot to pass it". This closes
 * "the caller passed the wrong one" -- the same move as `null` in
 * IncludeResolver: make the wrong answer unrepresentable rather than unlikely.
 */
type TSourceExtension = ".c" | ".cpp";

export default TSourceExtension;
