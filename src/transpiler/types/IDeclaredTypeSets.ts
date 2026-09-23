/**
 * The declared-type sets a name is classified against.
 *
 * A structural subset of `ICodeGenSymbols`, so both the per-file symbol view
 * and `CodeGenState`'s accessors satisfy it without either side converting.
 */
interface IDeclaredTypeSets {
  readonly knownEnums: ReadonlySet<string>;
  readonly knownBitmaps: ReadonlySet<string>;
  readonly bitmapBitWidth: ReadonlyMap<string, number>;
}

export default IDeclaredTypeSets;
