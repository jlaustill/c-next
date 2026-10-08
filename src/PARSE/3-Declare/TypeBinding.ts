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
 * Lives in 1.3 Declare so both the symbols layer and codegen can reach it, and
 * the predicates are injected rather than read from CodeGenState so nothing
 * here depends on codegen state.
 */

import ITypeAccessors from "../../types/ITypeAccessors";
import type INamedTypeResolution from "../../types/INamedTypeResolution";
import type ITypeBindingDeps from "../../types/ITypeBindingDeps";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import * as Parser from "../2-Parse/grammar/CNextParser";

/**
 * Static utility class resolving a type context to its C name.
 */
/** The four spellings a named type is written in */
type TNamedTypeSpelling =
  | { readonly kind: "scoped" | "global" | "user"; readonly name: string }
  | { readonly kind: "qualified"; readonly path: readonly string[] };

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
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): string | null {
    const direct = TypeBinding.resolveNamedOrPrimitiveType(
      accessors,
      scopePath,
      deps,
    );
    if (direct !== null) {
      return direct;
    }

    // Arrays carry their element type; recurse rather than re-deriving it.
    const array = accessors.arrayType?.();
    if (array) {
      return TypeBinding.resolveName(array, scopePath, deps);
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
   * did (deleted with the registry, #1668 C8). Asking `resolveNamedType` there dropped every primitive on the floor:
   * its caller treats a falsy base type as "not registerable" and returns, so
   * `u32 counter` registered no type info at all and the ADR-044 overflow
   * helpers stopped being emitted across 478 fixtures. Naming the pair the
   * caller accepts keeps that an allow-list rather than reinstating the
   * grammar-tracking exclusion list it replaced.
   */
  static resolveNamedOrPrimitiveType(
    accessors: ITypeAccessors,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): string | null {
    const named = TypeBinding.resolveNamedType(accessors, scopePath, deps);
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
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): string | null {
    return (
      TypeBinding.classifyNamedType(accessors, scopePath, deps)?.name ?? null
    );
  }

  /**
   * The same ladder, reporting WHICH branch answered and what was written.
   *
   * 1.3 Declare needs both. `resolveNamedType` returns a name, and by then a
   * bare `Mode` that stayed bare is indistinguishable from `global.Mode` --
   * ADR-057's whole reason for qualifying at the parse tree. Only the bare
   * branch can be unsettled, and only when it did not qualify, so a caller
   * that must defer needs to see the branch and the written identifier rather
   * than infer them from a string that no longer carries either.
   *
   * This is the ladder; `resolveNamedType` is a view over it. Two ladders is
   * what #1285 collapsed, and the point of routing the string version through
   * here is that a branch cannot be added to one and forgotten in the other.
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
    let spelling: TNamedTypeSpelling | null = null;
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
    return spelling && TypeBinding.classifyNamed(spelling, scopePath, deps);
  }

  /**
   * The ladder itself, over a written type's plain data: a lowered
   * `TTypeSyntax` is one, so a pass that holds no parse tree asks the same
   * question. Null for a type that is not a named one.
   */
  static classifyNamed(
    type: TNamedTypeSpelling | { readonly kind: string },
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): INamedTypeResolution | null {
    const named = type as TNamedTypeSpelling;
    switch (named.kind) {
      // this.T -- the scope is stated, so qualify against the chain unconditionally
      case "scoped":
        return {
          branch: "this",
          written: named.name,
          name: ScopeUtils.qualifyInScope(named.name, scopePath),
        };
      // global.T -- explicitly opts out of scope qualification
      case "global":
        return { branch: "global", written: named.name, name: named.name };
      // Scope.T -- the path is stated in full
      case "qualified":
        return {
          branch: "qualified",
          written: named.path.join("."),
          name: deps?.resolveQualifiedType
            ? deps.resolveQualifiedType([...named.path])
            : QualifiedCName.fromParts([...named.path]),
        };
      // Bare T -- the ONLY branch that resolves local -> scope -> global
      case "user":
        return {
          branch: "bare",
          written: named.name,
          name: deps?.isScopeType
            ? ScopeUtils.qualifyScopeType(
                named.name,
                scopePath,
                deps.isScopeType,
              )
            : named.name,
        };
      default:
        return null;
    }
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
