import type ICodeGenSymbols from "../transpiler/types/ICodeGenSymbols";
import ScopeUtils from "./ScopeUtils";

/**
 * What a struct's declared FIELDS say, from a per-file symbol view.
 *
 * ## Why this is not three lines at each caller (#1456)
 *
 * The lookup is not a lookup. `keyFor` falls back from a dotted source name
 * (`Scope.Thing`) to the transpiled C name (`Scope__Thing`), because a
 * scope-declared struct is recorded under the latter and named by the former.
 * That fallback is a DECISION, and it had one implementation reached only
 * through `CodeGenState` -- so an analyzer that wanted it had to read render
 * state to get it.
 *
 * Both callers share this rather than each keeping a copy: `CodeGenState`
 * delegates for codegen, and 2.1 Analyze calls it with the view its
 * `IAnalysisContext` carries. A change to how a scoped struct is keyed reaches
 * both, which is the property CLAUDE.md asks for -- the unit is the decision,
 * not the data.
 */
class StructFieldFacts {
  /**
   * The key `structFields` records this struct under, or undefined.
   *
   * Tries the name as written first, then the transpiled C name. Never spells
   * the latter by hand: `getTranspiledCName` is the single encoder, and the
   * whole PATH is the scope rather than just its last segment.
   */
  static keyFor(
    symbols: ICodeGenSymbols | null,
    structName: string,
  ): string | undefined {
    const fields = symbols?.structFields;
    if (fields === undefined) return undefined;
    if (fields.has(structName)) return structName;

    const cut = structName.lastIndexOf(".");
    if (cut === -1) return undefined;
    const key = ScopeUtils.getTranspiledCName({
      scopePath: structName.slice(0, cut),
      name: structName.slice(cut + 1),
    });
    return fields.has(key) ? key : undefined;
  }

  /** The declared type of one field, or undefined. */
  static typeOf(
    symbols: ICodeGenSymbols | null,
    structName: string,
    fieldName: string,
  ): string | undefined {
    const key = StructFieldFacts.keyFor(symbols, structName);
    return key === undefined
      ? undefined
      : symbols?.structFields.get(key)?.get(fieldName);
  }
}

export default StructFieldFacts;
