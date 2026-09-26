/**
 * The run-wide struct-field lookup a type classification falls back to.
 *
 * A structural subset of `SymbolTable`, so the table satisfies it without
 * naming it -- the same trick `IDeclaredTypeSets` plays on `ICodeGenSymbols`.
 *
 * `getStructFields` is REQUIRED here, deliberately. The interface this replaces
 * at one of the three call sites declared it `getStructFields?(...)` and the
 * caller wrote `symbolTable?.getStructFields?.(name)`, optional-chaining the
 * METHOD. Both chains were dead -- `CodeGenState.symbolTable` is initialized at
 * its declaration and never reassigned in production, and `SymbolTable` has
 * declared the method throughout -- but they were not equivalent: with the
 * method removed, the unconditional caller throws a `TypeError` while the
 * optional-chained one silently answers `false`. An optional method on a
 * required collaborator buys nothing and converts a loud failure into a wrong
 * answer, so the option is removed rather than propagated (#1656).
 */
interface IStructFieldLookup {
  getStructFields(name: string): unknown;
}

export default IStructFieldLookup;
