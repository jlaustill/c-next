import type ISourceSpan from "../../../../types/ISourceSpan";
import type TSymbolKindCNext from "../../../../types/symbol-kinds/TSymbolKindCNext";
import type TVisibility from "../../../../types/TVisibility";
import ESourceLanguage from "../../../../../utils/types/ESourceLanguage";
import ParserUtils from "../../../../../utils/ParserUtils";
import ScopeUtils from "../../../../../utils/ScopeUtils";

interface IMemberSymbolInput<K extends TSymbolKindCNext> {
  readonly kind: K;

  /** The member's own name, as the source spells it. */
  readonly name: string;

  /**
   * The DECLARING TYPE's `cnxScopedName` -- `EColor`, `SPoint`, or
   * `Motor.EMode` for a scope-declared one. Not the enclosing scope's path:
   * a member hangs off its type, not off the scope the type sits in.
   */
  readonly parentScopedName: string;

  /** The member's own parse context, so it gets its own span. */
  readonly memberCtx: {
    start?: { line?: number; column?: number } | null;
    stop?: { line?: number; column?: number; text?: string | null } | null;
  };

  readonly sourceFile: string;

  /** The declaring type's visibility, which the member inherits. */
  readonly visibility: TVisibility;
}

/**
 * The `IBaseSymbol` half of a member symbol, built one way for all four kinds.
 *
 * Enum members, struct fields, bitmap fields and register members became
 * symbols in #1318, and each collector would otherwise spell the same nine
 * fields itself. Four copies of "how is a member identified and positioned" is
 * the duplicate code path CLAUDE.md calls the project's worst anti-pattern:
 * they would agree today and diverge the first time one is edited, and the
 * divergence would be invisible because each collector's tests only ever look
 * at its own kind.
 *
 * The two facts it owns:
 *
 * - **Position is the MEMBER's.** Handing a member its parent's span is the
 *   defect this card exists to remove -- `parseWithSymbols` did exactly that
 *   for enum members, so an IDE jumping to `Color.Blue` landed on `enum Color`.
 * - **Identity comes from `ScopeUtils.identityOf`,** never a hand-built join
 *   (#1285). For `enum_member` the result is real generated C -- `EColor__RED`,
 *   `Motor__EMode__HIGH`, both in committed `.expected.h` fixtures. For the
 *   other three it is an INDEX KEY ONLY: a struct field is emitted `p.x`, so
 *   `SPoint__x` distinguishes it from `SOther__x` in the table and appears in
 *   no generated file. See `IBaseSymbol.fullyQualifiedCName`.
 */
class MemberSymbolBase {
  static of<K extends TSymbolKindCNext>(
    input: IMemberSymbolInput<K>,
  ): {
    kind: K;
    name: string;
    scopePath: string;
    fullyQualifiedCName: string;
    cnxScopedName: string;
    sourceFile: string;
    span: ISourceSpan;
    sourceLanguage: ESourceLanguage;
    visibility: TVisibility;
  } {
    return {
      kind: input.kind,
      name: input.name,
      scopePath: input.parentScopedName,
      ...ScopeUtils.identityOf({
        name: input.name,
        scopePath: input.parentScopedName,
      }),
      sourceFile: input.sourceFile,
      span: ParserUtils.getSpan(input.memberCtx),
      sourceLanguage: ESourceLanguage.CNext,
      visibility: input.visibility,
    };
  }
}

export default MemberSymbolBase;
