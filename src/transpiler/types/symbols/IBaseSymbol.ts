import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import type IScopeSymbol from "./IScopeSymbol";
import type ESourceLanguage from "../../../utils/types/ESourceLanguage";

/**
 * Base interface for all symbol types.
 * All concrete symbol interfaces extend this with a narrowed `kind` literal.
 */
interface IBaseSymbol {
  /** Symbol kind - discriminator for type narrowing */
  readonly kind: TSymbolKindCNext;

  /** Symbol name -- the leaf, as the source spells it inside its scope */
  readonly name: string;

  /**
   * The identifier this symbol is emitted as in generated C --
   * `Motor__init`, `Outer__Inner__process`, or the bare name when global.
   *
   * Computed ONCE, from the scope chain, when the symbol is built
   * (`ScopeUtils.identityOf`). Before this field existed every consumer
   * re-derived it, and they did not all derive it the same way: the chain-walking
   * encoder and the leaf-only ones agreed only because the grammar admits no
   * nested scopes, which is a coincidence rather than a shared decision (#1285).
   *
   * ADR-063 makes the result injective, so it is also this symbol's canonical
   * identity -- what `SymbolTable` indexes it by, and what a lookup holding a
   * generated identifier should ask for.
   */
  readonly fullyQualifiedCName: string;

  /**
   * The name a C-Next author would write -- `Motor.init`, `Outer.Inner.process`.
   *
   * A separate namespace from `fullyQualifiedCName`, not a transformation of it.
   * Diagnostics want this one: reporting the generated identifier names something
   * the author never typed (#1292).
   */
  readonly cnxScopedName: string;

  /**
   * Scope this symbol belongs to (circular reference resolved at runtime).
   *
   * Every symbol is declared in a scope — the global scope when unqualified —
   * so this is an IScopeSymbol, not a bare IBaseSymbol. Typing it loosely hid
   * the parent chain from name builders, which is what allowed a second,
   * leaf-only encoder to exist alongside ScopeUtils.getTranspiledCName.
   */
  readonly scope: IScopeSymbol;

  /** Source file where the symbol is defined */
  readonly sourceFile: string;

  /** Line number in the source file */
  readonly sourceLine: number;

  /** Source language (CNext, C, Cpp) */
  readonly sourceLanguage: ESourceLanguage;

  /** Whether this symbol is exported/public */
  readonly isExported: boolean;
}

export default IBaseSymbol;
