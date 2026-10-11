/**
 * What a name in a constant expression is worth (#1175, #1669): one walk of
 * its chain, from the binder's answer for its head.
 *
 * - a local, or a const declared at file or scope level, is worth its folded
 *   value, typed by its declaration (ADR-044's arithmetic needs the width);
 * - a scope's member (`Scope.N`) or an enum's (`EColor.COUNT`, `this.EMode.X`,
 *   `Motor.EMode.X`) is found by C name, as everything is (ADR-063);
 * - a name an included header defines is C's to evaluate;
 * - anything else -- a variable, a parameter, a function -- has no value, and
 *   the reason says which, for the diagnostic.
 *
 * 1.4 Resolve asks this while the program's consts and enum values settle,
 * and every later pass asks it through the settled `Program`, with the same
 * facts. That is what makes `u8[N]` one size in the .c and the .h.
 */
import QualifiedCName from "../../utils/QualifiedCName";
import CNEXT_TO_C_TYPE_MAP from "../../utils/constants/TypeMappings";
import ScopeUtils from "../../utils/ScopeUtils";
import LengthProperty from "../../utils/LengthProperty";
import type TType from "../../types/TType";
import type IConstantNameFacts from "./types/IConstantNameFacts";
import type ILocalDeclaration from "../../types/ILocalDeclaration";
import type IVariableSymbol from "../../types/symbols/IVariableSymbol";
import type TConstExpr from "../../types/TConstExpr";
import type TConstResult from "../../types/TConstResult";
import ELEMENT_STEP from "../../types/ELEMENT_STEP";
import type TChainRoot from "../../types/TChainRoot";
import type TValueBinding from "../../types/TValueBinding";
import type ISourcePosition from "../../utils/types/ISourcePosition";
import type TSettledConst from "../../types/TSettledConst";

type TConstName = Extract<TConstExpr, { kind: "name" }>;
type TReason = Extract<TConstResult, { kind: "notConstant" }>["reason"];

/** A value a property measures: its type and its settled dimensions */
interface IMeasured {
  readonly type: TType;
  readonly dimensions: ReadonlyArray<number | string>;
}

/** Where the walk is, for a reason's message */
interface IWalk {
  readonly spelling: string;
  readonly at: ISourcePosition;
  readonly facts: IConstantNameFacts;
}

class ConstantNames {
  static valueOf(name: TConstName, facts: IConstantNameFacts): TConstResult {
    const walk: IWalk = {
      spelling: ConstantNames.spell(name),
      at: name.at,
      facts,
    };
    const head = name.path[0];
    const rest = name.path.slice(1);
    if (head === undefined) return ConstantNames.without("unknown", walk);
    const binding = facts.bind(name.root, head, name.at);
    return binding === null
      ? ConstantNames.ofTypeHead(name.root, head, rest, walk)
      : ConstantNames.ofBound(binding, rest, walk);
  }

  /**
   * What a name the binder has already bound is worth, by itself --
   * `program.constantOf`'s answer, from the same walk
   */
  static ofBinding(
    binding: TValueBinding,
    spelling: string,
    at: ISourcePosition,
    facts: IConstantNameFacts,
  ): TConstResult {
    return ConstantNames.ofBound(binding, [], { spelling, at, facts });
  }

  private static ofBound(
    binding: TValueBinding,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    switch (binding.kind) {
      case "local":
        return ConstantNames.ofLocal(binding.declaration, rest, walk);
      case "variable":
        return ConstantNames.ofVariable(binding.symbol, rest, walk);
      case "function":
        return ConstantNames.without("function", walk);
      case "scope":
        return ConstantNames.ofScopeMember(binding.scopePath, rest, walk);
      case "foreign":
        return ConstantNames.ofForeign(binding.name, rest, walk);
    }
  }

  /**
   * #1863 review: a C-Next type name as C spells it where it is written -- a
   * primitive's C type, or the scope type ADR-057 qualifies a bare name to
   * (`sizeof(P)` inside scope S is `sizeof(S__P)`). Through
   * `ScopeUtils.qualifyScopeType`, the rule every type position uses.
   */
  static cTypeName(
    typeName: string,
    at: ISourcePosition,
    facts: IConstantNameFacts,
  ): string {
    const primitive = CNEXT_TO_C_TYPE_MAP[typeName];
    if (primitive !== undefined) return primitive;
    const scopePath = facts.scopePathAt(at);
    const parts = typeName.split(".");
    if (parts[0] === "this") {
      return ScopeUtils.getTranspiledCName({
        name: parts.slice(1).join("."),
        scopePath,
      });
    }
    if (parts[0] === "global") return QualifiedCName.fromParts(parts.slice(1));
    const qualified =
      parts.length === 1
        ? ScopeUtils.qualifyScopeType(typeName, scopePath, (name) =>
            facts.isScopeTypeVisible(name),
          )
        : typeName;
    return QualifiedCName.fromParts(qualified.split("."));
  }

  /** `this.N`, `global.N`, `Scope.N`, `m[].element_count` */
  static spell(name: TConstName): string {
    return [...(name.root === null ? [] : [name.root]), ...name.path]
      .join(".")
      .replaceAll(`.${ELEMENT_STEP}`, ELEMENT_STEP);
  }

  private static ofLocal(
    declaration: ILocalDeclaration,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const settled = walk.facts.settledLocal(declaration);
    if (rest.length > 0) {
      const measured = settled ?? declaration;
      return ConstantNames.ofMember(
        { type: measured.type, dimensions: measured.arrayDimensions },
        rest,
        walk,
      );
    }
    if (declaration.isConst) {
      return ConstantNames.ofSettled(settled?.constValue ?? undefined, walk);
    }
    return ConstantNames.without(
      declaration.kind === "parameter" ? "parameter" : "variable",
      walk,
    );
  }

  private static ofVariable(
    symbol: IVariableSymbol,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (rest.length > 0) {
      return ConstantNames.ofMember(
        { type: symbol.type, dimensions: symbol.arrayDimensions ?? [] },
        rest,
        walk,
      );
    }
    if (!symbol.isConst) return ConstantNames.without("variable", walk);
    return ConstantNames.ofSettled(walk.facts.constValue(symbol), walk);
  }

  /**
   * A const, by what 1.4 settled it to: its value, or no value -- with its
   * own initializer's cause, so a use can say why (#1863 review)
   */
  private static ofSettled(
    settled: TSettledConst | undefined,
    walk: IWalk,
  ): TConstResult {
    if (settled?.kind === "value") {
      return {
        kind: "value",
        value: BigInt(settled.digits),
        typeName: settled.typeName,
      };
    }
    return {
      ...ConstantNames.without("unfolded", walk),
      ...(settled === undefined ? {} : { because: settled }),
    };
  }

  /**
   * #1175: ADR-058's length properties are constants -- `src.element_count`,
   * `cfg.data.bit_length` -- worth what `LengthProperty` says of the measured
   * value's settled dimensions and element width, reached through struct
   * fields. Render reads the same rule, so a dimension sized by a property is
   * the number the property reads as. Any other member has no value.
   */
  private static ofMember(
    measured: IMeasured,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    let current: IMeasured | null = measured;
    for (const step of rest.slice(0, -1)) {
      current = current && ConstantNames.stepInto(current, step, walk);
    }
    const property = rest.at(-1)!;
    if (current === null || !LengthProperty.isLength(property)) {
      return ConstantNames.without("member", walk);
    }
    const lookup = (cName: string) => walk.facts.visibleSymbol(cName);
    const struct =
      current.type.kind === "struct"
        ? LengthProperty.struct(
            QualifiedCName.fromParts(current.type.name.split(".")),
            lookup,
          )
        : undefined;
    const value = LengthProperty.of(
      property,
      current.dimensions,
      LengthProperty.elementBitsOfType(current.type, lookup),
      struct?.fields.size ?? null,
    );
    return value === null
      ? ConstantNames.without("unfolded", walk)
      : { kind: "value", value: BigInt(value), typeName: null };
  }

  /**
   * A name a header declares. A variable -- even an `extern const` -- or a
   * function is not a constant expression in C, so it has no value, and as a
   * dimension it would be a VLA (#1768, #1863 review); a length property of an
   * array is measured from its declared dimensions (`cArr.element_count`),
   * though the element's width is the target's to decide, so a `bit_length`
   * has none. Anything else bare -- a C enum constant -- is C's to evaluate as
   * written; C has no spelling of `X.y` C-Next could write for the rest.
   */
  private static ofForeign(
    name: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const value = walk.facts.foreignValue(name);
    if (value?.kind === "function") {
      return ConstantNames.without("function", walk);
    }
    if (value === null) {
      return rest.length === 0
        ? { kind: "foreign", spelling: walk.spelling, why: "header" }
        : ConstantNames.without("member", walk);
    }
    if (rest.length === 0) return ConstantNames.without("variable", walk);
    return ConstantNames.ofMember(
      {
        type: { kind: "external", name: value.type },
        dimensions: value.dimensions,
      },
      rest,
      walk,
    );
  }

  /** One step of a measured walk: into an element, or into a field */
  private static stepInto(
    current: IMeasured,
    step: string,
    walk: IWalk,
  ): IMeasured | null {
    if (step !== ELEMENT_STEP)
      return ConstantNames.fieldOf(current, step, walk);
    return current.dimensions.length > 0
      ? { type: current.type, dimensions: current.dimensions.slice(1) }
      : null;
  }

  /** A field of a struct value, measured as declared; null for anything else */
  private static fieldOf(
    current: IMeasured,
    field: string,
    walk: IWalk,
  ): IMeasured | null {
    if (current.dimensions.length > 0 || current.type.kind !== "struct") {
      return null;
    }
    const struct = walk.facts.visibleSymbol(
      QualifiedCName.fromParts(current.type.name.split(".")),
    );
    const info =
      struct?.kind === "struct" ? struct.fields.get(field) : undefined;
    return info
      ? {
          type: info.type,
          dimensions: LengthProperty.fieldDimensions(
            info.type,
            info.dimensions ?? [],
          ),
        }
      : null;
  }

  /** `Scope.member`, and `Scope.EMode.MEMBER` */
  private static ofScopeMember(
    scopePath: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    const member = rest[0];
    const more = rest.slice(1);
    if (member === undefined) return ConstantNames.without("scope", walk);
    const cName = ScopeUtils.getTranspiledCName({ name: member, scopePath });
    const symbol = walk.facts.visibleSymbol(cName);
    if (symbol?.kind === "variable") {
      return ConstantNames.ofVariable(symbol, more, walk);
    }
    if (symbol?.kind === "enum" && more.length === 1) {
      return walk.facts.enumMember(cName, more[0], walk.spelling, walk.at);
    }
    if (symbol === undefined) {
      return ConstantNames.without("undeclaredMember", walk);
    }
    // A function or a type the scope declares has no value
    return ConstantNames.without(
      symbol.kind === "function" ? "function" : "member",
      walk,
    );
  }

  /**
   * A head the binder binds to no value names a type, if anything: an enum's
   * member is `EColor.COUNT`, qualified by ADR-057 as a type is, so a scope's
   * own enum shadows a global one of the name.
   */
  private static ofTypeHead(
    root: TChainRoot,
    head: string,
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (rest.length !== 1) return ConstantNames.unbound(rest, walk);
    const scopePath = walk.facts.scopePathAt(walk.at);
    let cName = head;
    if (root === "this") {
      cName = ScopeUtils.getTranspiledCName({ name: head, scopePath });
    } else if (root === null) {
      const qualified = ScopeUtils.qualifyScopeType(head, scopePath, (name) =>
        walk.facts.isScopeTypeVisible(name),
      );
      cName = QualifiedCName.fromParts(qualified.split("."));
    }
    if (walk.facts.visibleSymbol(cName)?.kind === "enum") {
      return walk.facts.enumMember(cName, rest[0], walk.spelling, walk.at);
    }
    return ConstantNames.unbound(rest, walk);
  }

  /**
   * A name nothing C-Next declares. A `#define` never reaches the symbol
   * model, so in a file that includes a header it may be a macro -- C's to
   * evaluate, as E0427 leaves it (#1175). Elsewhere it is undeclared, which
   * E0427 reports.
   */
  private static unbound(
    rest: ReadonlyArray<string>,
    walk: IWalk,
  ): TConstResult {
    if (!walk.facts.reachesForeignHeader) {
      return ConstantNames.without("unknown", walk);
    }
    // A macro is a bare name: C has no spelling for `X.y` that C-Next could
    // write for it
    return rest.length === 0
      ? { kind: "foreign", spelling: walk.spelling, why: "maybeHeader" }
      : ConstantNames.without("member", walk);
  }

  private static without(reason: TReason, walk: IWalk): TConstResult {
    return {
      kind: "notConstant",
      reason,
      spelling: walk.spelling,
      at: walk.at,
    };
  }
}

export default ConstantNames;
