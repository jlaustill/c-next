import type TSymbolKindCNext from "../symbol-kinds/TSymbolKindCNext";
import type IScopeSymbol from "./IScopeSymbol";
import type ESourceLanguage from "../../../utils/types/ESourceLanguage";
import type TVisibility from "../TVisibility";

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

  /**
   * Visibility as the source declares it (ADR-016), on every symbol kind.
   *
   * This is a fact about the declaration, not a decision about the output.
   * Whether a symbol reaches the generated header is a separate question --
   * `visibility`, minus ADR-030's `main` exemption, minus "a scope is a
   * container, not a declaration", plus the private types a public declaration
   * makes reachable. `PublicInterface` owns that computation; nothing else may
   * re-derive it.
   *
   * Four kinds used to carry no visibility at all, so their collectors hardcoded
   * an exported flag while `ScopeCollector` recorded the real answer beside them.
   * Two places held one fact, they disagreed, and the header believed the wrong
   * one -- every `private` struct, enum and bitmap was emitted into the public
   * interface (#1300).
   */
  readonly visibility: TVisibility;
}

export default IBaseSymbol;
