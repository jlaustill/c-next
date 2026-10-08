import type ISyntaxNode from "./ISyntaxNode";
import type TExpression from "./TExpression";
import type TTemplateArgumentSyntax from "./TTemplateArgumentSyntax";

/**
 * A type as written, lowered from the grammar's `type` by 1.2 Parse (#1932).
 *
 * `text` is the tokens joined (`getText()`), which is how a type is spelled
 * wherever one is named in output or a message today (`string<8>`,
 * `Scope.Type`, `u8[4]`), so it stays for byte-identical output. It lexes back
 * as written only for a kind that holds no expression and no nested template.
 * An `array`'s dimensions are expressions (`u8[N - -1]` joins to `u8[N--1]`)
 * and a nested template's `> >` joins to `>>`, so the `array` and `template`
 * `text` must not be re-lexed or emitted as source (#1940); read their parts,
 * or `written`.
 */
type TTypeSyntax = ISyntaxNode & { readonly text: string } & (
    | { readonly kind: "primitive"; readonly name: string }
    | {
        readonly kind: "string";
        /** `string<8>`'s `8` as written; null for a bare `string` */
        readonly capacity: string | null;
      }
    /** `this.Type` */
    | { readonly kind: "scoped"; readonly name: string }
    /** `global.Type` */
    | { readonly kind: "global"; readonly name: string }
    /** `Scope.Type`, `ns.sub.Type` */
    | { readonly kind: "qualified"; readonly path: readonly string[] }
    | {
        readonly kind: "template";
        readonly name: string;
        readonly arguments: readonly TTemplateArgumentSyntax[];
      }
    | { readonly kind: "user"; readonly name: string }
    | {
        readonly kind: "array";
        readonly element: TTypeSyntax;
        /** One per `[...]`; null for an unsized `[]` */
        readonly dimensions: ReadonlyArray<TExpression | null>;
      }
    | { readonly kind: "void" }
    /** Where the parser recovered from an error; see `TExpression`'s */
    | { readonly kind: "missing" }
  );

export default TTypeSyntax;
