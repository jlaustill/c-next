import CodeGenState from "../state/CodeGenState";
import ScopeUtils from "../../utils/ScopeUtils";
import QualifiedCName from "../../utils/QualifiedCName";
import ESourceLanguage from "../../utils/types/ESourceLanguage";
import createMockSymbols from "./codeGenSymbolsHelpers";
import type ICodeGenSymbols from "../types/ICodeGenSymbols";
import type IScopeSymbol from "../types/symbols/IScopeSymbol";
import type TSymbol from "../types/symbols/TSymbol";

/**
 * Build a mock symbol world and install BOTH of its representations.
 *
 * #1285: `CodeGenState.symbols` (the `known*` string sets) and
 * `CodeGenState.symbolTable` describe the same symbols, and production fills them
 * from one resolve pass -- `Transpiler.ts:429` is the only place that fills them. A test that
 * sets only the sets is in a state the transpiler never reaches, which stayed
 * invisible while `isScopeType` asked the sets and became visible the moment it
 * asked the symbol's `kind` instead.
 *
 * Assigning `CodeGenState.symbols` yourself is what leaves the table empty. Call
 * this instead, so the two cannot disagree.
 */
function installMockSymbols(
  overrides?: Partial<ICodeGenSymbols>,
): ICodeGenSymbols {
  const symbols = createMockSymbols(overrides);
  CodeGenState.symbols = symbols;

  const globalScope = ScopeUtils.createGlobalScope();
  register(symbols.knownEnums, globalScope, (base) => ({
    ...base,
    kind: "enum",
    members: new Map(),
  }));
  register(symbols.knownStructs, globalScope, (base) => ({
    ...base,
    kind: "struct",
    fields: new Map(),
  }));
  register(symbols.knownBitmaps, globalScope, (base) => ({
    ...base,
    kind: "bitmap",
    backingType: "uint8_t",
    bitWidth: 8,
    fields: new Map(),
  }));

  return symbols;
}

/**
 * The identity a mock type symbol carries.
 *
 * `fullyQualifiedCName` is the set entry verbatim -- the set already holds the
 * generated C name, and that is the key `SymbolTable` indexes by. The leaf and the
 * C-Next name are derived from it so a diagnostic reading `cnxScopedName` gets
 * something an author could have written.
 */
function register(
  names: ReadonlySet<string>,
  scope: IScopeSymbol,
  build: (base: {
    name: string;
    fullyQualifiedCName: string;
    cnxScopedName: string;
    scope: IScopeSymbol;
    sourceFile: string;
    sourceLine: number;
    sourceLanguage: ESourceLanguage;
    isExported: boolean;
  }) => unknown,
): void {
  for (const qualifiedName of names) {
    const parts = QualifiedCName.split(qualifiedName);
    const base = {
      name: parts.at(-1)!,
      fullyQualifiedCName: qualifiedName,
      cnxScopedName: parts.join(QualifiedCName.SOURCE_SEPARATOR),
      scope,
      sourceFile: "mock.cnx",
      sourceLine: 1,
      sourceLanguage: ESourceLanguage.CNext,
      isExported: true,
    };
    CodeGenState.symbolTable.addTSymbol(build(base) as TSymbol);
  }
}

export default installMockSymbols;
