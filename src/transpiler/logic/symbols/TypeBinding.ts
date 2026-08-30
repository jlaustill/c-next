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
 * Lives in `logic/symbols/` so both the symbols layer and codegen can reach it:
 * `logic/` may not import `output/`, and the predicates are injected rather than
 * read from CodeGenState so nothing here depends on codegen state.
 */

import ITypeAccessors from "../../types/ITypeAccessors";
import IScopeSymbol from "../../types/symbols/IScopeSymbol";
import QualifiedCName from "../../../utils/QualifiedCName";
import ScopeUtils from "../../../utils/ScopeUtils";
import * as Parser from "../parser/grammar/CNextParser";

interface ITypeBindingDeps {
  /**
   * ADR-057: whether a QUALIFIED name is a type declared in the current scope.
   * Consulted only for a bare `userType()` -- `this.T`, `global.T` and `Scope.T`
   * state their answer in the syntax and must keep their own branches, because
   * once a name is a string `global.Mode` and a bare `Mode` are identical.
   */
  readonly isScopeType?: (qualifiedName: string) => boolean;

  /**
   * C++ namespace-aware resolution for `Scope.Type` (Issue #388). Injected
   * because it is a codegen concern; without it the components are joined.
   */
  readonly resolveQualifiedType?: (identifiers: string[]) => string;
}

/**
 * Static utility class resolving a type context to its C name.
 */
class TypeBinding {
  /**
   * The C name for a type context, or null when no alternative matched.
   *
   * The six alternatives are mutually exclusive in the grammar, so branch order
   * carries no meaning -- which is why seven ladders in different orders behaved
   * the same and why collapsing them is safe.
   */
  static resolveName(
    accessors: ITypeAccessors,
    scope: IScopeSymbol | null,
    deps?: ITypeBindingDeps,
  ): string | null {
    const direct = TypeBinding.resolveNamedOrPrimitiveType(
      accessors,
      scope,
      deps,
    );
    if (direct !== null) {
      return direct;
    }

    // Arrays carry their element type; recurse rather than re-deriving it.
    const array = accessors.arrayType?.();
    if (array) {
      return TypeBinding.resolveName(array, scope, deps);
    }

    const str = accessors.stringType();
    if (str) {
      return TypeBinding.resolveStringType(str);
    }

    return null;
  }

  /**
   * The C name for a type that names itself outright -- a named type or a
   * primitive -- and null for the two alternatives that WRAP another type.
   *
   * This is the allow-list a caller wants when it handles `arrayType` and
   * `stringType` itself because it needs a bit width or a capacity alongside
   * the name, which is what TypeRegistrationEngine's variable-registration path
   * does. Asking `resolveNamedType` there dropped every primitive on the floor:
   * its caller treats a falsy base type as "not registerable" and returns, so
   * `u32 counter` registered no type info at all and the ADR-044 overflow
   * helpers stopped being emitted across 478 fixtures. Naming the pair the
   * caller accepts keeps that an allow-list rather than reinstating the
   * grammar-tracking exclusion list it replaced.
   */
  static resolveNamedOrPrimitiveType(
    accessors: ITypeAccessors,
    scope: IScopeSymbol | null,
    deps?: ITypeBindingDeps,
  ): string | null {
    const named = TypeBinding.resolveNamedType(accessors, scope, deps);
    if (named !== null) {
      return named;
    }

    const primitive = accessors.primitiveType();
    return primitive ? primitive.getText() : null;
  }

  /**
   * The C name for a NAMED type -- `this.T`, `global.T`, `Scope.T` or a bare
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
  static resolveNamedType(
    accessors: ITypeAccessors,
    scope: IScopeSymbol | null,
    deps?: ITypeBindingDeps,
  ): string | null {
    // this.T -- the scope is stated, so qualify against the chain unconditionally
    const scoped = accessors.scopedType();
    if (scoped) {
      return ScopeUtils.qualifyInScope(scoped.IDENTIFIER().getText(), scope);
    }

    // global.T -- explicitly opts out of scope qualification
    const global = accessors.globalType();
    if (global) {
      return global.IDENTIFIER().getText();
    }

    // Scope.T -- the path is stated in full
    const qualified = accessors.qualifiedType();
    if (qualified) {
      const names = qualified.IDENTIFIER().map((id) => id.getText());
      return deps?.resolveQualifiedType
        ? deps.resolveQualifiedType(names)
        : QualifiedCName.fromParts(names);
    }

    // Bare T -- the ONLY branch that resolves local -> scope -> global
    const user = accessors.userType();
    if (user) {
      const typeName = user.getText();
      return deps?.isScopeType
        ? ScopeUtils.qualifyScopeType(typeName, scope, deps.isScopeType)
        : typeName;
    }

    return null;
  }

  /**
   * `string<32>` keeps its capacity; a bare `string` does not (Issue #139).
   */
  static resolveStringType(stringCtx: Parser.StringTypeContext): string {
    const intLiteral = stringCtx.INTEGER_LITERAL();
    return intLiteral ? `string<${intLiteral.getText()}>` : "string";
  }
}

export default TypeBinding;
