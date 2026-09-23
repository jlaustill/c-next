/**
 * The declared-type sets a name is classified against.
 *
 * A structural subset of `ICodeGenSymbols`, so both the per-file symbol view
 * and `CodeGenState`'s accessors satisfy it without either side converting.
 */
interface IDeclaredTypeSets {
  /**
   * Widened for `DeclaredTypeFacts.isStruct` (#1656). Every supplier is an
   * `ICodeGenSymbols` or a structural stand-in for one, and all of them already
   * carry this set, so the widening costs no caller a field.
   */
  readonly knownStructs: ReadonlySet<string>;
  readonly knownEnums: ReadonlySet<string>;
  readonly knownBitmaps: ReadonlySet<string>;
  readonly bitmapBitWidth: ReadonlyMap<string, number>;
}

export default IDeclaredTypeSets;
