/**
 * TypeNameLadder -- the one ladder from a written type's plain data to its
 * resolved C-Next name (#1285, #1932).
 *
 * Split out of 1.3's `TypeBinding` (#1932, owner decision on #1952): that
 * module reads parse contexts through `ITypeAccessors`, so a pass after 2.1
 * that called it imported a parse-tree holder. This half reads only plain
 * data, so 1.3's symbols, 2.1, the walker and Render all ask it, and
 * `TypeBinding` keeps only the parse-context entry point, which delegates here.
 */
import type INamedTypeResolution from "../types/INamedTypeResolution";
import type ITypeBindingDeps from "../types/ITypeBindingDeps";
import QualifiedCName from "./QualifiedCName";
import ScopeUtils from "./ScopeUtils";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import type ISyntaxNode from "../types/syntax/ISyntaxNode";

/** A lowered type's four named arms */
type TNamedTypeSyntax = Extract<
  TTypeSyntax,
  { readonly kind: "scoped" | "global" | "qualified" | "user" }
>;
type TWithoutNode<T> = T extends unknown
  ? Omit<T, keyof ISyntaxNode | "text">
  : never;
/**
 * The four spellings a named type is written in: `TTypeSyntax`'s own arms
 * without their node fields, so a field renamed there is a compile error here.
 */
type TNamedTypeSpelling = TWithoutNode<TNamedTypeSyntax>;

class TypeNameLadder {
  /**
   * The ladder itself, over a written type's plain data: a lowered
   * `TTypeSyntax` is one, so a pass that holds no parse tree asks the same
   * question. Null for a type that is not a named one.
   */
  static classifyNamed(
    type: TTypeSyntax | TNamedTypeSpelling,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): INamedTypeResolution | null {
    switch (type.kind) {
      // this.T -- the scope is stated, so qualify against the chain unconditionally
      case "scoped":
        return {
          branch: "this",
          written: type.name,
          name: ScopeUtils.qualifyInScope(type.name, scopePath),
        };
      // global.T -- explicitly opts out of scope qualification
      case "global":
        return { branch: "global", written: type.name, name: type.name };
      // Scope.T -- the path is stated in full
      case "qualified":
        return {
          branch: "qualified",
          written: type.path.join("."),
          name: deps?.resolveQualifiedType
            ? deps.resolveQualifiedType([...type.path])
            : QualifiedCName.fromParts([...type.path]),
        };
      // Bare T -- the ONLY branch that resolves local -> scope -> global
      case "user":
        return {
          branch: "bare",
          written: type.name,
          name: deps?.isScopeType
            ? ScopeUtils.qualifyScopeType(
                type.name,
                scopePath,
                deps.isScopeType,
              )
            : type.name,
        };
      default:
        return null;
    }
  }

  /**
   * The C-Next name a type is written as -- a named type resolved, a primitive,
   * an array's element, `string<N>` or `string` -- or null for template and
   * `void`, which each caller answers for itself.
   *
   * The one ladder: 1.3's symbols (the `.h`, through `TypeUtils.getTypeName`)
   * and the walker (the `.c`) both ask it, so the two files cannot disagree on
   * a type's name. Its alternatives are exclusive in the grammar, so branch
   * order carries no meaning (#1285, #1932).
   */
  static resolveWrittenName(
    type: TTypeSyntax,
    scopePath: string,
    deps?: ITypeBindingDeps,
  ): string | null {
    const named = TypeNameLadder.classifyNamed(type, scopePath, deps);
    if (named !== null) {
      return named.name;
    }
    switch (type.kind) {
      case "primitive":
        return type.name;
      case "array":
        return TypeNameLadder.resolveWrittenName(type.element, scopePath, deps);
      case "string":
        return type.capacity === null ? "string" : `string<${type.capacity}>`;
      default:
        return null;
    }
  }
}

export default TypeNameLadder;
