/**
 * Pass-by-value parameter info from CodeGenerator: function name -> the
 * parameter names that function passes by value rather than by reference.
 *
 * Extracted from two identical local declarations in `HeaderGenerator.ts` and
 * `BaseHeaderGenerator.ts` (CLAUDE.md: two interfaces needing the same fields
 * extract a shared type rather than duplicate it) when a third use appeared
 * in `IHeaderEmissionFacts`.
 */
type TPassByValueParams = ReadonlyMap<string, ReadonlySet<string>>;

export default TPassByValueParams;
