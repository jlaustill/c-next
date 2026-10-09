/**
 * TypeBinding — the one ladder from a type parse context to a resolved name.
 *
 * Seven independent `scopedType()/globalType()/qualifiedType()/userType()`
 * ladders existed: two in TypeRegistrationEngine, one each in TypeUtils,
 * CodeGenerator.getTypeName, FunctionContextManager, TypeGenerationHelper, and
 * CodeGenerator's parameter path. Each decided ADR-057 qualification for itself,
 * so unifying the encoder (#1285 PR3) left seven places that still had to agree
 * about WHICH branch to apply it in.
 *
 * They already disagreed about coverage: each handled a different subset of the
 * six `arrayType` element alternatives, and their fallbacks differed (null vs
 * the raw parse text). Those subsets ARE reachable, and collapsing the ladders
 * closed two of them:
 *
 *   - `CodeGenerator.getTypeName` handled only `primitiveType` and `userType`
 *     inside `arrayType`, so `const Scope.TItem[] items <- ...` fell through to
 *     `ctx.getText()` and yielded the raw parse text `Scope.TItem[]`. The field
 *     types were then unknown and the initializer literals lost their integer
 *     suffixes (tests/header-generation/const-struct-array-inferred).
 *   - `getZeroInitializer` resolved a bare `userType()` unqualified, so a
 *     scope-local enum missed `knownEnums` and got the aggregate zero brace
 *     instead of ADR-017's zero member
 *     (tests/bugs/issue-1285-scope-enum-zero-init).
 *
 * So this is a bug fix as well as a unification, and the corpus does move --
 * in exactly those two places, both verified as corrections rather than
 * regressions before their snapshots were regenerated.
 *
 * The ladder itself reads plain data and lives in `utils/TypeNameLadder`
 * (#1932), so a pass after 2.1 reaches it without importing this module,
 * which reads parse contexts. What stays here is the parse-context entry point
 * 1.3 uses. The predicates are injected rather than read from codegen state.
 */

import ITypeAccessors from "../../types/ITypeAccessors";
import type INamedTypeResolution from "../../types/INamedTypeResolution";
import type ITypeBindingDeps from "../../types/ITypeBindingDeps";
import TypeNameLadder from "../../utils/TypeNameLadder";

/**
 * Static utility class resolving a type context to its C name.
 */
class TypeBinding {
  /**
   * The ladder for a named type, reporting WHICH branch answered and what was
   * written.
   *
   * 1.3 Declare needs both. A name alone loses them: a bare `Mode` that stayed
   * bare is indistinguishable from `global.Mode` -- ADR-057's whole reason for
   * qualifying at the parse tree. Only the bare branch can be unsettled, and
   * only when it did not qualify, so a caller that must defer needs to see the
   * branch and the written identifier rather than infer them from a string
   * that no longer carries either. A caller that wants the name reads `.name`;
   * one ladder is what #1285 collapsed.
   *
   * It answers for a NAMED type -- `this.T`, `global.T`, `Scope.T` or a bare
   * `T` -- and null for every other alternative.
   *
   * This is an ALLOW-LIST, and that direction is the point. Callers that only
   * ever wanted named types previously spelled out the alternatives they would
   * NOT answer for and let everything else through to the ladder; three callers
   * did that with three different exclusion lists, each correct only as long as
   * someone remembered to update it when the grammar grew. A new `type`
   * alternative would have reached the ladder, resolved to something, and been
   * silently mistaken for a named type -- `getZeroInitializer` would emit
   * `= {0}` with no diagnostic. Asking for named types by name makes an
   * unrecognized alternative `null` by default, which is where the callers'
   * own fallbacks already handle it.
   */
  static classifyNamedType(
    accessors: ITypeAccessors,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): INamedTypeResolution | null {
    const scoped = accessors.scopedType();
    const global = accessors.globalType();
    const qualified = accessors.qualifiedType();
    const user = accessors.userType();
    let spelling: Parameters<typeof TypeNameLadder.classifyNamed>[0] | null =
      null;
    if (scoped) {
      spelling = { kind: "scoped", name: scoped.IDENTIFIER().getText() };
    } else if (global) {
      spelling = { kind: "global", name: global.IDENTIFIER().getText() };
    } else if (qualified) {
      spelling = {
        kind: "qualified",
        path: qualified.IDENTIFIER().map((id) => id.getText()),
      };
    } else if (user) {
      spelling = { kind: "user", name: user.getText() };
    }
    return spelling && TypeNameLadder.classifyNamed(spelling, scopePath, deps);
  }
}

export default TypeBinding;
