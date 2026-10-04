/**
 * #1688: the object-like macros the headers define, each typed from its
 * replacement tokens (ADR-024). A `#define` never reaches the symbol model --
 * a header is parsed raw or preprocessed, and either way its directives are
 * gone -- so a macro operand had no type, and `u32 i * SCALE_F` was routed
 * into the integer clamp helper.
 *
 * Read from each header's own text, so a header served from the symbol cache,
 * or one whose preprocessing failed, is read the same way. A macro defined
 * more than once (under `#if` arms) has one type only when every definition
 * agrees; otherwise it is unreadable.
 */
import type THeaderMacro from "../../types/THeaderMacro";

type TFloatingTypeName = "f32" | "f64" | null;

type TMacroToken =
  | { readonly kind: "floating"; readonly typeName: TFloatingTypeName }
  | { readonly kind: "integer" }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "operator" }
  | { readonly kind: "other" };

/** `#define NAME body`; a function-like macro's `(` follows its name directly */
const OBJECT_LIKE_DEFINE =
  /^[ \t]*#[ \t]*define[ \t]+([A-Za-z_]\w*)(?:[ \t](.*))?$/gm;

const FLOATING_LITERAL = String.raw`0[xX][0-9a-fA-F]*\.?[0-9a-fA-F]*[pP][+-]?\d+[fFlL]?|(?:\d+\.\d*|\.\d+)(?:[eE][+-]?\d+)?[fFlL]?|\d+[eE][+-]?\d+[fFlL]?`;
const INTEGER_LITERAL = String.raw`0[xX][0-9a-fA-F]+[uUlL]*|0[bB][01]+[uUlL]*|\d+[uUlL]*`;
/** The operators an integer expansion may hold: arithmetic and bitwise */
const INTEGER_OPERATOR = "<<|>>|[-+*/%&|^~()]";

/** One token per match; `other` takes any character no other group does */
const MACRO_TOKEN = new RegExp(
  String.raw`\s+|(${FLOATING_LITERAL})|(${INTEGER_LITERAL})|([A-Za-z_]\w*)|(${INTEGER_OPERATOR})|(.)`,
  "g",
);

const UNREADABLE: THeaderMacro = { kind: "unreadable" };

class HeaderMacros {
  /** Every object-like macro the headers define, by name */
  static collect(
    headerTexts: Iterable<string>,
  ): ReadonlyMap<string, THeaderMacro> {
    const bodies = new Map<string, string[]>();
    for (const text of headerTexts) {
      for (const definition of HeaderMacros.definitions(text)) {
        const list = bodies.get(definition.name) ?? [];
        list.push(definition.body);
        bodies.set(definition.name, list);
      }
    }
    const typed = new Map<string, THeaderMacro>();
    for (const name of bodies.keys()) {
      HeaderMacros.typeOf(name, bodies, typed, new Set());
    }
    return typed;
  }

  /** A header's object-like definitions, after C's line splicing and comments */
  private static definitions(
    text: string,
  ): Array<{ name: string; body: string }> {
    const logical = text
      .replaceAll(/\\\r?\n/g, "")
      .replaceAll(/\/\*[\s\S]*?\*\//g, " ")
      .replaceAll(/\/\/[^\n]*/g, "");
    return [...logical.matchAll(OBJECT_LIKE_DEFINE)].map((match) => ({
      name: match[1],
      body: (match[2] ?? "").trim(),
    }));
  }

  /**
   * A macro's type, following the macros its expansion names. A cycle --
   * `#define stdin stdin` -- expands to a name no macro defines, so it is
   * unreadable, as is every macro on it.
   */
  private static typeOf(
    name: string,
    bodies: ReadonlyMap<string, readonly string[]>,
    typed: Map<string, THeaderMacro>,
    expanding: Set<string>,
  ): THeaderMacro {
    const known = typed.get(name);
    if (known !== undefined) return known;
    const definitions = bodies.get(name);
    if (definitions === undefined || expanding.has(name)) return UNREADABLE;
    expanding.add(name);
    const each = definitions.map((body) =>
      HeaderMacros.typeOfBody(body, bodies, typed, expanding),
    );
    expanding.delete(name);
    const result = HeaderMacros.agreed(each);
    typed.set(name, result);
    return result;
  }

  private static typeOfBody(
    body: string,
    bodies: ReadonlyMap<string, readonly string[]>,
    typed: Map<string, THeaderMacro>,
    expanding: Set<string>,
  ): THeaderMacro {
    const floating: TFloatingTypeName[] = [];
    let integerOnly = true;
    let tokenCount = 0;
    for (const token of HeaderMacros.tokens(body)) {
      tokenCount += 1;
      if (token.kind === "floating") {
        floating.push(token.typeName);
      } else if (token.kind === "name") {
        const named = HeaderMacros.typeOf(token.name, bodies, typed, expanding);
        if (named.kind === "floating") floating.push(named.typeName);
        if (named.kind !== "integer") integerOnly = false;
      } else if (token.kind === "other") {
        integerOnly = false;
      }
    }
    if (floating.length > 0) {
      return {
        kind: "floating",
        typeName: HeaderMacros.usualFloating(floating),
      };
    }
    return tokenCount > 0 && integerOnly ? { kind: "integer" } : UNREADABLE;
  }

  private static tokens(body: string): TMacroToken[] {
    const tokens: TMacroToken[] = [];
    for (const match of body.matchAll(MACRO_TOKEN)) {
      if (match[1] !== undefined) {
        tokens.push({
          kind: "floating",
          typeName: HeaderMacros.literalType(match[1]),
        });
      } else if (match[2] !== undefined) {
        tokens.push({ kind: "integer" });
      } else if (match[3] !== undefined) {
        tokens.push({ kind: "name", name: match[3] });
      } else if (match[4] !== undefined) {
        tokens.push({ kind: "operator" });
      } else if (match[5] !== undefined) {
        tokens.push({ kind: "other" });
      }
    }
    return tokens;
  }

  /** A floating literal's C type: `f` is float, `l` long double, none double */
  private static literalType(literal: string): TFloatingTypeName {
    const suffix = literal.at(-1)?.toLowerCase();
    // A hex literal's digits include `f`; only one with an exponent is floating
    if (suffix === "f" && !/[xX]/.test(literal)) return "f32";
    if (suffix === "f" && /[pP][+-]?\d+[fF]$/.test(literal)) return "f32";
    if (suffix === "l") return null;
    return "f64";
  }

  /** C's usual arithmetic conversions over the floating leaves */
  private static usualFloating(
    leaves: readonly TFloatingTypeName[],
  ): TFloatingTypeName {
    if (leaves.includes(null)) return null;
    return leaves.includes("f64") ? "f64" : "f32";
  }

  /** One type for a macro's definitions, or unreadable when they disagree */
  private static agreed(each: readonly THeaderMacro[]): THeaderMacro {
    const first = each[0];
    if (first === undefined) return UNREADABLE;
    if (each.some((t) => t.kind !== first.kind)) return UNREADABLE;
    if (first.kind !== "floating") return first;
    const names = new Set(
      each.map((t) => (t.kind === "floating" ? t.typeName : null)),
    );
    return {
      kind: "floating",
      typeName: names.size === 1 ? first.typeName : null,
    };
  }
}

export default HeaderMacros;
