/**
 * SPIKE #1431 — THROWAWAY. Deleted before this branch merges.
 *
 * One row of the `symbol` table: the normalized form of an `IBaseSymbol`.
 *
 * `fullyQualifiedCName` is the primary key, not a convenience field. ADR-063
 * makes it injective and `IBaseSymbol.ts:26-28` already names it "this symbol's
 * canonical identity -- what `SymbolTable` indexes it by".
 *
 * `name` is kept beside it because the two are DIFFERENT KEY SPACES, and that is
 * the point. `TSymbolInfoAdapter` collapses a scope to `scope.name` (the leaf)
 * for `knownScopes` / `scopeMembers` / `scopeMemberVisibility`, and uses
 * `getTranspiledCName` for `knownStructs` / `knownEnums` / `functionReturnTypes`
 * -- two key spaces inside one interface. A view derived from this table must
 * declare which one it projects into, so the translation is a column rather than
 * an assumption.
 */
interface ISymbolRow {
  /** PRIMARY KEY. Injective per ADR-063. */
  readonly fullyQualifiedCName: string;

  /** The leaf, as the source spells it inside its scope. NOT unique. */
  readonly name: string;

  /** The name the author wrote (`Motor.init`). A third namespace, not a transform of either above. */
  readonly cnxScopedName: string;

  /** The discriminator, never erased. */
  readonly kind: string;

  /** FOREIGN KEY -> scope.id. Empty string is the global scope. A path, never an object (#1298). */
  readonly scopeId: string;

  /** FOREIGN KEY -> file.path. */
  readonly sourceFile: string;

  readonly sourceLine: number;

  /** "CNext" | "C" | "Cpp" -- the axis `NameExistence` routes on. */
  readonly sourceLanguage: string;

  /**
   * As DECLARED. Not `isExported`: the architecture doc records that `isExported`
   * is not a fact, it is visibility minus ADR-030's `main` exemption minus "a scope
   * is a container". Those rules belong downstream; this column is what was written.
   */
  readonly visibility: string;
}

export default ISymbolRow;
