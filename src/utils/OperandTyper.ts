/**
 * #1668: the one operand typer.
 *
 * Pass 2.1 (the analyzers) and pass 2.2 (planning the C) each typed
 * operands with a chain walker of their own, so every expression shape had
 * to be taught twice, and the two already disagreed. This answers "what is
 * the value type of this operand" once, as a pure function of the node and
 * the typing context -- no field, no state, no registry. Each consuming rule
 * applies its own policy to the facts; none is decided here.
 *
 * Names bind through `IProgram.bindValue`, so a local, a parameter, a scope
 * member and a global are found the same way for typing and emission; a C
 * or C++ header's operand is typed by `ForeignTypeFacts` from its spelling
 * and the run's target.
 */
import ExpressionCalls from "./ExpressionCalls";
import ExpressionShape from "./ExpressionShape";
import ConstExprLowering from "./ConstExprLowering";
import ConstantEvaluator from "./ConstantEvaluator";
import ConstantFold from "./ConstantFold";
import TTypeUtils from "./TTypeUtils";
import PrimitiveKindUtils from "./PrimitiveKindUtils";
import TypeCheckUtils from "./TypeCheckUtils";
import TYPE_WIDTH from "../types/TYPE_WIDTH";
import ForeignTypeFacts from "./ForeignTypeFacts";
import LiteralUtils from "./LiteralUtils";
import CompositeType from "./CompositeType";
import QualifiedCName from "./QualifiedCName";
import PROPERTY_NAMES from "./constants/PROPERTY_NAMES";
import ScopeUtils from "./ScopeUtils";
import SubscriptClassifier from "./SubscriptClassifier";
import TypeResolver from "./TypeResolver";
import TypeBinding from "../PARSE/3-Declare/TypeBinding";
import type THeaderMacro from "../types/THeaderMacro";
import type IChainStep from "../types/IChainStep";
import type IChainTyping from "../types/IChainTyping";
import type IOperandType from "../types/IOperandType";
import type ITargetDescription from "../types/ITargetDescription";
import type ITypingContext from "../types/ITypingContext";
import type TEssentialCategory from "../types/TEssentialCategory";
import type TType from "../types/TType";
import type TValueBinding from "../types/TValueBinding";
import type TSubscriptKind from "../types/TSubscriptKind";
import type TExpression from "../types/syntax/TExpression";
import type TExpressionOf from "../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";

/** Where a chain walk stands between operations */
type TChainValue =
  | {
      readonly k: "value";
      readonly t: IOperandType;
      /** A register member: its subscripts are bits */
      readonly register: boolean;
    }
  | { readonly k: "scope"; readonly scopePath: string }
  | { readonly k: "enumType"; readonly name: string }
  | { readonly k: "register"; readonly name: string }
  | { readonly k: "function"; readonly returnType: TType }
  /** An unresolved name path: a C/C++ namespace, class or function */
  | { readonly k: "foreignPath"; readonly parts: readonly string[] }
  /** A header's function pointer, not yet called: its call's result */
  | { readonly k: "foreignFunction"; readonly result: IOperandType | null }
  | { readonly k: "unknown" };

const UNKNOWN: TChainValue = { k: "unknown" };

/** The operations a chain applies after its head */
type TChainOps = readonly TPostfixOpSyntax[];

/** A chain's head, typed, and the operations left to apply to it */
interface IChainStart {
  binding: TValueBinding | null;
  value: TChainValue;
  ops: TChainOps;
}

/** How an operand came to have its type */
type TOperandForm = IOperandType["form"];

const DECLARED: TOperandForm = { kind: "declared" };

/** A name that may be a macro C-Next could not read (#1688, ADR-024) */
const UNREAD_MACRO: THeaderMacro = { kind: "unreadable" };

class OperandTyper {
  /**
   * Whether evaluating an expression has a side effect: it calls a function
   * or reads a volatile or atomic declaration. A call the typer cannot type
   * still counts, found by its spelling. The one test for an element read's
   * own side effect and for a read-modify-write target that would evaluate
   * the expression twice (E0890).
   */
  static hasSideEffect(expr: TExpression, ctx: ITypingContext): boolean {
    return (
      ExpressionCalls.callsAtTop(expr) ||
      OperandTyper.typeOf(expr, ctx)?.hasSideEffect === true
    );
  }

  /**
   * Whether a bit or bit-range subscript writes the value's bits (ADR-007):
   * an integer's, of any width, or a float's, through a union. The classifier
   * and the member-chain writer ask this one question (#1760 review), which
   * each had answered for integers alone, so a float element or field bit
   * write fell through to a plain subscript store that C rejects.
   */
  static hasWritableBits(t: IOperandType | null): boolean {
    return (
      t?.category === "signed" ||
      t?.category === "unsigned" ||
      t?.category === "floating"
    );
  }

  /**
   * The value type of any expression-level node: it descends through
   * single-child levels, parentheses, unary operators, ternaries and
   * composites. Null when the operand has no type this can settle.
   */
  static typeOf(expr: TExpression, ctx: ITypingContext): IOperandType | null {
    switch (expr.kind) {
      case "postfix":
        return OperandTyper.walkChain(expr, ctx).last;
      case "identifier":
        return OperandTyper.identifierType(expr, ctx);
      case "parenthesized":
        return OperandTyper.typeOf(expr.expression, ctx);
      case "literal":
        return OperandTyper.literalType(expr);
      case "cast":
        return OperandTyper.castType(expr, ctx);
      case "unary":
        return OperandTyper.unaryType(expr, ctx);
      case "ternary":
        return OperandTyper.ternaryType(expr, ctx);
      case "binary":
        if (OperandTyper.isBooleanLevel(expr)) {
          return OperandTyper.booleanValue(false);
        }
        // `a << n` is `a`'s type; the shift count is never an operand (C01)
        if (expr.level === "shift") {
          return OperandTyper.typeOf(expr.operands[0], ctx);
        }
        return OperandTyper.compositeType(expr, ctx);
      default:
        return null;
    }
  }

  /**
   * The value leaves of one arithmetic or bitwise level (#1668, §3.6), by the
   * one collection rule every consumer shares. It descends through arithmetic
   * and bitwise levels, parentheses, a ternary's VALUE arms (never its
   * condition), and unary `-` and `~`; it stops at a postfix chain, a cast, a
   * Boolean-valued level or `!` (one Boolean leaf) and `sizeof`; it excludes
   * `&x` and a shift count.
   */
  static valueLeaves(
    expr: TExpression,
    ctx: ITypingContext,
  ): Array<IOperandType | null> {
    if (OperandTyper.isCompositeLevel(expr)) {
      return expr.operands.flatMap((operand) =>
        OperandTyper.valueLeaves(operand, ctx),
      );
    }
    if (expr.kind === "ternary") {
      return [expr.whenTrue, expr.whenFalse].flatMap((arm) =>
        OperandTyper.valueLeaves(arm, ctx),
      );
    }
    if (expr.kind === "unary" && expr.operator === "&") return [];
    const operand = OperandTyper.wrappedOperand(expr);
    return operand === null
      ? [OperandTyper.typeOf(expr, ctx)]
      : OperandTyper.valueLeaves(operand, ctx);
  }

  /**
   * The one expression a wrapper's value is: a parenthesized expression, a
   * shift's left operand (its count is not a value leaf), or the operand of
   * a unary `-` or `~` -- except a negated literal, `-5`, which is one leaf.
   * Null for anything else.
   *
   * The one descent `valueLeaves` and `compositeLevelOf` share (#1760 second
   * review): the second stopped at a unary or a shift, so the category of
   * `-(a + 'A')` was scanned from leaves that disagree, where `(a + 'A')`
   * had its level's.
   */
  private static wrappedOperand(expr: TExpression): TExpression | null {
    if (expr.kind === "parenthesized") return expr.expression;
    if (expr.kind === "binary" && expr.level === "shift") {
      return expr.operands[0];
    }
    if (expr.kind !== "unary") return null;
    if (expr.operator !== "-" && expr.operator !== "~") return null;
    const negatedLiteral =
      expr.operator === "-" && expr.operand.kind === "literal";
    return negatedLiteral ? null : expr.operand;
  }

  /**
   * A postfix chain or assignment target, typed one operation at a time. A
   * `this.` or `global.` root has consumed its first `.name`.
   */
  static chainOf(chain: TExpression, ctx: ITypingContext): IChainTyping {
    return OperandTyper.walkChain(chain, ctx).typing;
  }

  /**
   * An operand's compile-time integer value, by the one evaluator (#1175):
   * literals, names that bind here to a const (through the one binder, so a
   * const local shadows as it does everywhere else), and the arithmetic over
   * them that C computes exactly. Anything else -- a call, an element, a
   * variable, arithmetic ADR-044 would clamp or wrap -- is a runtime value:
   * null. So is a comparison, which is a bool, not an integer.
   *
   * This used to read only a literal under leading minus signs or a bare
   * name, and called arithmetic a runtime value, because folding it exactly
   * disagreed with ADR-044's saturating C. The evaluator folds at the
   * operands' width and declines where C would clamp, so that reason is gone,
   * and a fifth rule for a constant's value with it.
   */
  static constantOf(expr: TExpression, ctx: ITypingContext): number | null {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
      ConstantFold.environment(ctx.program, ctx.sourceFile),
    );
    return result.kind === "value" && result.typeName !== "bool"
      ? (ConstantEvaluator.toNumber(result.value) ?? null)
      : null;
  }

  /**
   * A bare name's value type as it binds at `at`: a local, a member, a
   * global or a header's variable, through Program's one binder. For a rule
   * that holds a name rather than an expression node.
   */
  static typeOfName(
    name: string,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IOperandType | null {
    const binding = ctx.program.bindValue(ctx.sourceFile, null, name, at);
    return binding && binding.kind !== "scope"
      ? OperandTyper.boundValue(binding, ctx)
      : null;
  }

  /** The value type an assignment target writes */
  static typeOfTarget(
    target: TExpression,
    ctx: ITypingContext,
  ): IOperandType | null {
    return OperandTyper.walkChain(target, ctx).last;
  }

  /** The chain typed, and the value it ends on */
  private static walkChain(
    chain: TExpression,
    ctx: ITypingContext,
  ): { typing: IChainTyping; last: IOperandType | null } {
    const start = OperandTyper.chainStart(chain, ctx);
    const steps: IChainStep[] = [];
    let current = start.value;
    for (const op of start.ops) {
      const before = current.k === "value" ? current.t : null;
      const { next, subscript } = OperandTyper.applyOp(current, op, ctx);
      const member = op.kind === "member" ? op.name : null;
      steps.push({
        before,
        subscript,
        after: next.k === "value" ? next.t : null,
        property:
          before !== null &&
          member !== null &&
          OperandTyper.readsProperty(before, member, ctx)
            ? member
            : null,
      });
      current = next;
    }
    return {
      typing: { root: start.binding, steps },
      last: current.k === "value" ? current.t : null,
    };
  }

  /**
   * Whether an operand's type is a string (ADR-045), an array of them
   * included: a `string<N>`, or the bare `string` keyword, whose capacity is
   * not known here -- main's `string args[]` (ADR-030) and an unsized
   * `const string`. #1668 (C12): three rules stood where this one does, and
   * only this one's callers ask it; the subscript shape knew only a capacity,
   * so the element of `args[0]` was read as a bit rather than a character.
   */
  /** A bounded string value -- not an array of them, nor an element of one, which is a char */
  static isScalarString(t: IOperandType | null): boolean {
    return t !== null && t.dimensions.length === 0 && OperandTyper.isString(t);
  }

  /**
   * A bounded `string<N>` value's capacity `N` -- not an array of them, which
   * an element of one is; null for anything else (#1737). What a copy into
   * the value is bounded by.
   */
  static scalarStringCapacity(
    t: IOperandType | null | undefined,
  ): number | null {
    if (t === null || t === undefined || t.dimensions.length > 0) return null;
    return t.stringCapacity;
  }

  static isString(t: IOperandType | null): boolean {
    if (t === null) return false;
    const name = t.typeName ?? "";
    return (
      t.stringCapacity !== null ||
      name === "string" ||
      TypeCheckUtils.isSizedStringName(name)
    );
  }

  /**
   * Whether an operand is stored as a C array, which C decays to a pointer to
   * its first element: a whole array (`pts`, not `pts[0]`), or a string,
   * whose `char` buffer is an array though it is not one of `dimensions`.
   * Such an argument never takes `&` -- its address is a pointer to the ARRAY.
   */
  static decaysToPointer(t: IOperandType | null): boolean {
    return t !== null && (t.dimensions.length > 0 || OperandTyper.isString(t));
  }

  /**
   * ADR-057's scope-type predicate for the file being typed: the scope types
   * it declares or its include closure declares (#1724). The one answer 1.4
   * settled the file's symbols with and codegen qualifies with, so the typer
   * cannot see a sibling's scope type the file never includes.
   */
  private static scopeTypesSeenBy(
    ctx: ITypingContext,
  ): (qualifiedName: string) => boolean {
    return (qualifiedName) =>
      ctx.program.isScopeTypeVisibleFrom(ctx.sourceFile, qualifiedName);
  }

  /**
   * Whether an operand is essentially Boolean: an applied relational or
   * logical operator, `!`, or a `bool`. A single bit of a scalar is not
   * (ADR-024: it is a bit index), and neither is an array of bools.
   */
  static isBoolean(t: IOperandType | null): boolean {
    if (t === null || t.dimensions.length > 0) return false;
    return (
      t.form.kind === "boolean" ||
      (t.typeName === "bool" && t.form.kind !== "bitIndex")
    );
  }

  /** The essential category of a C-Next type name: decided here, once (G8) */
  static categoryOf(typeName: string | null): TEssentialCategory {
    if (typeName === null) return "none";
    if (typeName === "bool") return "boolean";
    if (typeName === "char") return "character";
    // TypeCheckUtils' lists, not a second spelling of them (#1760 review)
    if (TypeCheckUtils.isUnsigned(typeName)) return "unsigned";
    if (TypeCheckUtils.isSigned(typeName)) return "signed";
    if (TypeCheckUtils.isFloat(typeName)) return "floating";
    return "none";
  }

  // --------------------------------------------------------------------------
  // Levels
  // --------------------------------------------------------------------------

  private static isBooleanLevel(expr: TExpressionOf<"binary">): boolean {
    return (
      expr.level === "or" ||
      expr.level === "and" ||
      expr.level === "equality" ||
      expr.level === "relational"
    );
  }

  /**
   * The composite operator level (`*`, `+`, `&`, `^`, `|`) an expression IS,
   * through single-child chains and `wrappedOperand`, or null. The same
   * descent `valueLeaves` flattens, for a rule that needs the level itself --
   * Rule 10.4's category of an operand that is an operation (#1760 review).
   */
  static compositeLevelOf(expr: TExpression): TExpressionOf<"binary"> | null {
    if (OperandTyper.isCompositeLevel(expr)) return expr;
    const operand = OperandTyper.wrappedOperand(expr);
    return operand === null ? null : OperandTyper.compositeLevelOf(operand);
  }

  private static isCompositeLevel(
    expr: TExpression,
  ): expr is TExpressionOf<"binary"> {
    return (
      expr.kind === "binary" &&
      (expr.level === "bitwiseOr" ||
        expr.level === "bitwiseXor" ||
        expr.level === "bitwiseAnd" ||
        expr.level === "additive" ||
        expr.level === "multiplicative")
    );
  }

  private static compositeType(
    expr: TExpressionOf<"binary">,
    ctx: ITypingContext,
  ): IOperandType {
    const leaves = OperandTyper.valueLeaves(expr, ctx);
    const typed = leaves.filter((leaf): leaf is IOperandType => leaf !== null);
    const categories = new Set(
      typed.map((leaf) => leaf.category).filter((c) => c !== "none"),
    );
    const names = new Set(typed.map((leaf) => leaf.typeName));
    const category =
      categories.size === 1 ? ([...categories][0] ?? "none") : "none";
    // The integer type the composite computes in, settled here once (#1760
    // second review): four consumers each re-derived it from the leaves
    const integer = CompositeType.integerOf(leaves);
    return {
      ...OperandTyper.plain(
        integer ?? OperandTyper.compositeName(names, category, leaves),
      ),
      category,
      bitWidth: integer === null ? null : OperandTyper.widthOf(integer),
      hasSideEffect: typed.some((leaf) => leaf.hasSideEffect),
      form: { kind: "composite", leaves },
    };
  }

  /**
   * A non-integer composite's type name: its leaves' one name, or for
   * floating leaves of different names C's usual arithmetic conversion
   * (`CompositeType`). An integer composite is typed by `CompositeType.
   * integerOf`, with its width, and its `bitWidth` says it is one.
   */
  private static compositeName(
    names: ReadonlySet<string | null>,
    category: TEssentialCategory,
    leaves: ReadonlyArray<IOperandType | null>,
  ): string | null {
    if (names.size === 1) return [...names][0] ?? null;
    return category === "floating" ? CompositeType.floatingOf(leaves) : null;
  }

  private static ternaryType(
    expr: TExpressionOf<"ternary">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const whenTrue = OperandTyper.typeOf(expr.whenTrue, ctx);
    const whenFalse = OperandTyper.typeOf(expr.whenFalse, ctx);
    const same =
      whenTrue !== null &&
      whenFalse !== null &&
      whenTrue.typeName === whenFalse.typeName &&
      whenTrue.category === whenFalse.category;
    return {
      ...(same ? whenTrue : OperandTyper.floatingArms(whenTrue, whenFalse)),
      overflow: null,
      binding: null,
      hasSideEffect:
        (whenTrue?.hasSideEffect ?? false) ||
        (whenFalse?.hasSideEffect ?? false),
      form: { kind: "ternary", arms: [whenTrue, whenFalse] },
    };
  }

  /**
   * Two arms of different types: C's usual arithmetic conversion when every
   * arm with an essential category is floating (`c ? k : 2.0` is f64), and
   * untyped otherwise -- E0810 rejects the mixes in 2.1.
   */
  private static floatingArms(
    whenTrue: IOperandType | null,
    whenFalse: IOperandType | null,
  ): IOperandType {
    const arms = [whenTrue, whenFalse];
    const categorized = arms.filter(
      (arm): arm is IOperandType => arm !== null && arm.category !== "none",
    );
    const allFloating =
      categorized.length > 0 &&
      categorized.every((arm) => arm.category === "floating");
    if (!allFloating) return OperandTyper.plain(null);
    return {
      ...OperandTyper.plain(CompositeType.floatingOf(arms)),
      category: "floating",
    };
  }

  private static unaryType(
    expr: TExpressionOf<"unary">,
    ctx: ITypingContext,
  ): IOperandType | null {
    if (expr.operator === "!") {
      return OperandTyper.booleanValue(
        OperandTyper.typeOf(expr.operand, ctx)?.hasSideEffect ?? false,
      );
    }
    if (expr.operator === "-" || expr.operator === "~") {
      const t = OperandTyper.typeOf(expr.operand, ctx);
      if (t === null) return null;
      const form =
        expr.operator === "-" && t.form.kind === "literal"
          ? { ...t.form, negated: !t.form.negated }
          : t.form;
      return { ...t, form, overflow: null, binding: null };
    }
    // `&x` is an address, never a value operand (#1152)
    return null;
  }

  private static identifierType(
    expr: TExpressionOf<"identifier">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const binding = ctx.program.bindValue(
      ctx.sourceFile,
      null,
      expr.name,
      OperandTyper.positionOf(expr),
    );
    const macro = OperandTyper.headerMacroType(binding, expr.name, ctx);
    if (macro) return macro;
    return binding ? OperandTyper.boundValue(binding, ctx) : null;
  }

  private static positionOf(node: TExpression): {
    line: number;
    column: number;
  } {
    return { line: node.span.line, column: node.span.column };
  }

  // --------------------------------------------------------------------------
  // Leaves
  // --------------------------------------------------------------------------

  /** A character constant, written inline or as a header macro's expansion */
  private static characterLiteral(): IOperandType {
    return {
      ...OperandTyper.plain("char"),
      category: "character",
      bitWidth: 8,
      form: {
        kind: "literal",
        literal: "char",
        suffixed: false,
        negated: false,
      },
    };
  }

  private static literalType(
    expr: TExpressionOf<"literal">,
  ): IOperandType | null {
    const text = expr.text;
    if (text.startsWith("'")) return OperandTyper.characterLiteral();
    const typeName = LiteralUtils.typeOf(text);
    if (typeName === null) return null;
    if (typeName === "bool") {
      return {
        ...OperandTyper.plain("bool"),
        category: "boolean",
        form: {
          kind: "literal",
          literal: "bool",
          suffixed: false,
          negated: false,
        },
      };
    }
    const floatWidth = LiteralUtils.floatLiteralWidth(text);
    if (floatWidth !== null) {
      return {
        ...OperandTyper.plain(typeName),
        category: "floating",
        form: {
          kind: "literal",
          literal: "float",
          suffixed: /[fF](?:32|64)$/.test(text),
          negated: false,
        },
      };
    }
    // An unsuffixed integer has no essential category of its own (ADR-052);
    // a suffixed one takes its suffix's (R2).
    const suffixed = typeName !== "int";
    return {
      ...OperandTyper.plain(typeName),
      category: suffixed ? OperandTyper.categoryOf(typeName) : "none",
      bitWidth: suffixed ? OperandTyper.widthOf(typeName) : null,
      form: { kind: "literal", literal: "integer", suffixed, negated: false },
    };
  }

  private static castType(
    expr: TExpressionOf<"cast">,
    ctx: ITypingContext,
  ): IOperandType | null {
    const inner = OperandTyper.typeOf(expr.operand, ctx);
    const target = OperandTyper.typeOfWritten(
      expr.type,
      ctx,
      OperandTyper.positionOf(expr),
    );
    if (target === null) return null;
    return {
      ...target,
      overflow: null,
      binding: null,
      hasSideEffect: inner?.hasSideEffect ?? false,
      form: { kind: "cast" },
    };
  }

  /**
   * The scope path enclosing a node, from Program's lexical frames: the one
   * answer to "which scope is this in", which ADR-057 name lookups start from.
   */
  static scopePathAt(
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): string {
    return ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath;
  }

  /**
   * A written type -- a cast's, a declaration's -- resolved by 1.3's one
   * ladder (`TypeBinding`), so `this.T`, `global.T`, `Scope.T` and a bare `T`
   * name what they name everywhere else; qualifying the source text by hand
   * read `this.EMode` as a type called `this_EMode`.
   *
   * An array type is its element's type with the written dimensions (#1668
   * review: `EColor[2]` had no type at all, so its elements' bare enum
   * members lost their anchor).
   */
  static typeOfWritten(
    type: TTypeSyntax,
    ctx: ITypingContext,
    at: { line: number; column: number },
  ): IOperandType | null {
    if (type.kind === "array") {
      const element = OperandTyper.typeOfWritten(type.element, ctx, at);
      if (element === null) return null;
      const env = ConstantFold.environment(ctx.program, ctx.sourceFile);
      // #1175: the size as 1.4 settles a declared one -- never the source
      // text, which named what C cannot see
      const dimensions = type.dimensions.map((size) =>
        size ? ConstantFold.dimension(ConstExprLowering.lower(size), env) : "",
      );
      return {
        ...element,
        dimensions: [...dimensions, ...element.dimensions],
      };
    }
    if (
      type.kind === "primitive" &&
      PrimitiveKindUtils.isPrimitive(type.name)
    ) {
      return OperandTyper.fromType(
        TTypeUtils.createPrimitive(type.name),
        [],
        ctx,
      );
    }
    // ADR-057's qualification is the program's one answer, as for every
    // `TypeBinding` caller; whether the result is a C-Next type this file
    // sees is `declaresNamedType`, as in `fromType` (#1668 review: the trio
    // was spelled out here by hand)
    const cName =
      TypeBinding.classifyNamed(
        type,
        ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath,
        { isScopeType: OperandTyper.scopeTypesSeenBy(ctx) },
      )?.name ?? null;
    if (cName !== null && OperandTyper.declaresNamedType(cName, ctx)) {
      return OperandTyper.fromType({ kind: "struct", name: cName }, [], ctx);
    }
    // A header's type, by its spelling
    return ForeignTypeFacts.operandType(
      type.text,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
  }

  /** A bound name's value: a local, a variable, or a header's variable */
  private static boundValue(
    binding: TValueBinding,
    ctx: ITypingContext,
  ): IOperandType | null {
    switch (binding.kind) {
      case "local": {
        const d = binding.declaration;
        return {
          ...OperandTyper.fromType(d.type, d.arrayDimensions, ctx),
          overflow: d.overflowBehavior,
          hasSideEffect: d.isVolatile || d.isAtomic,
          binding,
        };
      }
      case "variable": {
        const s = binding.symbol;
        return {
          ...OperandTyper.fromType(s.type, s.arrayDimensions ?? [], ctx),
          overflow: s.overflowBehavior,
          hasSideEffect: s.isVolatile || s.isAtomic,
          binding,
        };
      }
      case "foreign": {
        const t = ForeignTypeFacts.variableOperand(
          binding.name,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        );
        return t ? { ...t, binding } : null;
      }
      case "scope":
      case "function":
        return null;
    }
  }

  /** A C-Next type, as a declaration states it */
  private static fromType(
    type: TType,
    dimensions: ReadonlyArray<number | string>,
    ctx: ITypingContext,
  ): IOperandType {
    // A header's type named in a C-Next declaration (`real_t x`,
    // `float32_t v`): 1.3 guesses a named type's kind from its spelling
    // (#1720), so a name that is no C-Next struct, enum or bitmap, and that is
    // a C type or a header's, is asked of the header too (#1668 review:
    // it was untyped, and `x * i` went to an integer clamp helper).
    if (
      type.kind === "external" ||
      (OperandTyper.isNamedKind(type) &&
        !OperandTyper.declaresNamedType(type.name, ctx) &&
        ForeignTypeFacts.isForeignType(
          type.name,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        ))
    ) {
      const foreign = ForeignTypeFacts.operandType(
        type.name,
        ctx.symbolTable,
        OperandTyper.target(ctx),
        dimensions,
      );
      if (foreign) return { ...foreign, form: DECLARED };
    }
    if (type.kind === "array") {
      return OperandTyper.fromType(
        type.elementType,
        [...type.dimensions, ...dimensions],
        ctx,
      );
    }
    const typeName = TypeResolver.getTypeName(type);
    const base = { ...OperandTyper.plain(typeName), dimensions };
    switch (type.kind) {
      case "primitive":
        return {
          ...base,
          category: OperandTyper.categoryOf(typeName),
          bitWidth: OperandTyper.widthOf(typeName),
        };
      case "string":
        return { ...base, stringCapacity: type.capacity };
      case "struct":
      case "enum":
      case "bitmap":
        return { ...base, ...OperandTyper.namedFacts(type.name, ctx) };
      default:
        return base;
    }
  }

  private static isNamedKind(
    type: TType,
  ): type is Extract<TType, { kind: "struct" | "enum" | "bitmap" }> {
    return (
      type.kind === "struct" || type.kind === "enum" || type.kind === "bitmap"
    );
  }

  /** Whether this file sees `name` declared as a C-Next struct, enum or bitmap */
  private static declaresNamedType(name: string, ctx: ITypingContext): boolean {
    const symbols = ctx.symbols;
    return (
      symbols.knownStructs.has(name) ||
      symbols.knownEnums.has(name) ||
      symbols.knownBitmaps.has(name)
    );
  }

  /**
   * What a named C-Next type is, from the names this file sees declared.
   * Never from `TType.kind`: 1.3 guesses a named type's kind from its
   * spelling, so an enum not named `E...` and every bitmap settle as a
   * struct (#1720).
   */
  private static namedFacts(
    name: string,
    ctx: ITypingContext,
  ): Pick<IOperandType, "category" | "enumTypeName" | "bitmapTypeName"> {
    if (ctx.symbols.knownEnums.has(name)) {
      return { category: "enum", enumTypeName: name, bitmapTypeName: null };
    }
    if (ctx.symbols.knownBitmaps.has(name)) {
      return { category: "none", enumTypeName: null, bitmapTypeName: name };
    }
    return { category: "none", enumTypeName: null, bitmapTypeName: null };
  }

  // --------------------------------------------------------------------------
  // Chains
  // --------------------------------------------------------------------------

  /**
   * A chain's head: a `this.`/`global.` root has its first `.name` in the
   * chain's first op. An assignment target is lowered to the same shape.
   */
  private static chainStart(
    chain: TExpression,
    ctx: ITypingContext,
  ): IChainStart {
    const at = OperandTyper.positionOf(chain);
    const head = ExpressionShape.headOf(chain);
    const rest = head.ops.slice(head.opsConsumed);
    if (head.root !== null) {
      if (head.identifier === null) {
        return { binding: null, value: UNKNOWN, ops: [] };
      }
      return OperandTyper.rootedStart(
        head.root,
        head.identifier.name,
        rest,
        at,
        ctx,
      );
    }
    if (head.identifier !== null) {
      return OperandTyper.namedStart(head.identifier.name, rest, at, ctx);
    }
    const t = OperandTyper.typeOf(head.primary, ctx);
    return {
      binding: null,
      value: t ? { k: "value", t, register: false } : UNKNOWN,
      ops: rest,
    };
  }

  /** `this.name` or `global.name`, with that first member consumed */
  private static rootedStart(
    root: "this" | "global",
    name: string,
    ops: TChainOps,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IChainStart {
    const binding = ctx.program.bindValue(ctx.sourceFile, root, name, at);
    // `global.NAME` names what a bare NAME names at file scope, a header
    // macro included (#1688); a `this.` name is the scope's own member
    if (root === "global") {
      const macro = OperandTyper.macroStart(binding, name, ops, ctx);
      if (macro) return macro;
    }
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    if (binding?.kind === "foreign") {
      return OperandTyper.foreignStart(binding, name, ops, ctx);
    }
    // A function is typed by the call that follows it, as it was before the
    // binder named it (#1760 review)
    if (binding && binding.kind !== "function") {
      const t = OperandTyper.boundValue(binding, ctx);
      return {
        binding,
        value: t ? { k: "value", t, register: false } : UNKNOWN,
        ops,
      };
    }
    const scopePath =
      root === "this"
        ? ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath
        : "";
    return {
      binding: null,
      value: OperandTyper.memberOfScope(scopePath, name, ctx),
      ops,
    };
  }

  /** A bare name at the head of a chain */
  private static namedStart(
    name: string,
    ops: TChainOps,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): IChainStart {
    const binding = ctx.program.bindValue(ctx.sourceFile, null, name, at);
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    if (binding && binding.kind !== "foreign" && binding.kind !== "function") {
      const t = OperandTyper.boundValue(binding, ctx);
      return {
        binding,
        value: t ? { k: "value", t, register: false } : UNKNOWN,
        ops,
      };
    }

    const scopePath = ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath;
    const nextIsCall = ops[0] !== undefined && OperandTyper.isCall(ops[0]);
    if (nextIsCall) {
      const fn = ctx.program.resolveFunction(name, scopePath);
      if (fn)
        return {
          binding: null,
          value: { k: "function", returnType: fn.returnType },
          ops,
        };
    }
    const symbols = ctx.symbols;
    // ADR-057's qualification, the program's one answer: a scope's own type
    // shadows a global one of the name, whatever kind each is (#1668 review:
    // an enums-only predicate let a global enum through a scope's struct)
    const enumName = ScopeUtils.qualifyScopeType(
      name,
      scopePath,
      OperandTyper.scopeTypesSeenBy(ctx),
    );
    const enumCName = OperandTyper.cNameOf(enumName);
    if (symbols.knownEnums.has(enumCName)) {
      return { binding: null, value: { k: "enumType", name: enumCName }, ops };
    }
    const registerCName =
      scopePath !== "" &&
      symbols.knownRegisters.has(
        ScopeUtils.getTranspiledCName({ name, scopePath }),
      )
        ? ScopeUtils.getTranspiledCName({ name, scopePath })
        : name;
    if (symbols.knownRegisters.has(registerCName)) {
      return {
        binding: null,
        value: { k: "register", name: registerCName },
        ops,
      };
    }
    const macro = OperandTyper.macroStart(binding, name, ops, ctx);
    if (macro) return macro;
    if (binding?.kind === "foreign") {
      return OperandTyper.foreignStart(binding, name, ops, ctx);
    }
    return { binding: null, value: { k: "foreignPath", parts: [name] }, ops };
  }

  /** A chain that is a floating or unreadable header macro named alone */
  private static macroStart(
    binding: TValueBinding | null,
    name: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart | null {
    if (ops.length !== 0) return null;
    const t = OperandTyper.headerMacroType(binding, name, ctx);
    return t
      ? { binding: null, value: { k: "value", t, register: false }, ops }
      : null;
  }

  /**
   * The one precedence for a name a header macro may define (#1688, ADR-024):
   * a C-Next declaration of the name wins; a macro wins over a header
   * declaration, as the preprocessor replaces it before C sees one. Null for
   * an integer macro, which keeps an unsuffixed literal's untyped path. A
   * name nothing declares, in a file whose macros were not all read, may be
   * a macro of any type, so it is unreadable (#1688 review)
   */
  private static headerMacroType(
    binding: TValueBinding | null,
    name: string,
    ctx: ITypingContext,
  ): IOperandType | null {
    if (binding !== null && binding.kind !== "foreign") return null;
    const macro = ctx.program.headerMacro(ctx.sourceFile, name);
    const unread =
      macro === null &&
      binding === null &&
      ctx.program.headerMacrosUnread(ctx.sourceFile);
    return OperandTyper.macroOperand(unread ? UNREAD_MACRO : macro);
  }

  /** A floating, character or unreadable header macro's type; null for others */
  private static macroOperand(macro: THeaderMacro | null): IOperandType | null {
    if (macro === null || macro.kind === "integer") return null;
    if (macro.kind === "character") return OperandTyper.characterLiteral();
    if (macro.kind === "unreadable") {
      return { ...OperandTyper.plain(null), form: { kind: "unreadableMacro" } };
    }
    return {
      ...OperandTyper.plain(macro.typeName),
      category: "floating",
      form: { kind: "foreign", indeterminate: false },
    };
  }

  /**
   * A header's name at the head of a chain, bare or as `global.name`: its
   * variable's type, or a path a following call or member resolves (a
   * function, a namespace). One arm for both spellings (#1668 review:
   * `global.cGetF()` stopped at an untyped root).
   */
  private static foreignStart(
    binding: TValueBinding,
    name: string,
    ops: TChainOps,
    ctx: ITypingContext,
  ): IChainStart {
    const t = OperandTyper.boundValue(binding, ctx);
    return {
      binding,
      value: t
        ? { k: "value", t, register: false }
        : { k: "foreignPath", parts: [name] },
      ops,
    };
  }

  /** What `Scope.name` denotes: a member, a function, an enum or a register */
  private static memberOfScope(
    scopePath: string,
    name: string,
    ctx: ITypingContext,
  ): TChainValue {
    const cName =
      scopePath === ""
        ? name
        : ScopeUtils.getTranspiledCName({ name, scopePath });
    const symbol = ctx.program.symbolByCName(cName);
    switch (symbol?.kind) {
      case "variable": {
        const t = OperandTyper.boundValue({ kind: "variable", symbol }, ctx);
        return t ? { k: "value", t, register: false } : UNKNOWN;
      }
      case "function":
        return { k: "function", returnType: symbol.returnType };
      case "enum":
        return { k: "enumType", name: cName };
      case "register":
        return { k: "register", name: cName };
      default:
        break;
    }
    return UNKNOWN;
  }

  private static applyOp(
    current: TChainValue,
    op: TPostfixOpSyntax,
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    switch (op.kind) {
      case "member":
        return {
          next: OperandTyper.memberOf(current, op.name, ctx),
          subscript: null,
        };
      case "subscript":
        return OperandTyper.subscriptOf(current, op.indexes, ctx);
      case "call":
        return { next: OperandTyper.callOf(current, ctx), subscript: null };
      case "missing":
        return { next: UNKNOWN, subscript: null };
    }
  }

  private static isCall(op: TPostfixOpSyntax): boolean {
    return op.kind === "call";
  }

  private static memberOf(
    current: TChainValue,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    switch (current.k) {
      case "scope":
        return OperandTyper.memberOfScope(current.scopePath, member, ctx);
      case "enumType":
        return {
          k: "value",
          register: false,
          t: {
            ...OperandTyper.plain(current.name),
            category: "enum",
            enumTypeName: current.name,
            form: { kind: "enumMember" },
          },
        };
      case "register": {
        // The register symbol is the one source; the per-file map only
        // records bitmap-typed members
        const register = ctx.program.symbolByCName(current.name);
        const info =
          register?.kind === "register" ? register.members.get(member) : null;
        if (!info) return UNKNOWN;
        if (info.bitmapType) {
          const t = {
            ...OperandTyper.plain(info.bitmapType),
            bitmapTypeName: info.bitmapType,
          };
          return { k: "value", register: true, t };
        }
        // A member records its C spelling (`uint16_t`)
        const foreign = ForeignTypeFacts.operandType(
          info.cType,
          ctx.symbolTable,
          OperandTyper.target(ctx),
        );
        if (!foreign) return UNKNOWN;
        const t = { ...foreign, form: DECLARED };
        return { k: "value", register: true, t };
      }
      case "foreignPath":
        return OperandTyper.foreignPathOf([...current.parts, member], ctx);
      case "value":
        return OperandTyper.fieldOf(current.t, member, ctx);
      default:
        return UNKNOWN;
    }
  }

  /**
   * Whether `.member` on a value of type `t` reads an ADR-058/ADR-045
   * property rather than a field. A field named like a property is a field
   * -- ADR-058's `struct Packet { u32 length; }` is "perfectly fine", and a
   * chain that resolves as a whole is a member access -- so only a property
   * name the value's type declares no field of reads the property. The one
   * answer: the typer records it on the chain step, and 2.1's property rules
   * and render read the step (#1760 review: each decided by the name alone).
   */
  private static readsProperty(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): boolean {
    return (
      PROPERTY_NAMES.has(member) && !OperandTyper.declaresField(t, member, ctx)
    );
  }

  /** Whether a value's type declares the field: a struct's, bitmap's or header's */
  private static declaresField(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): boolean {
    if (t.dimensions.length > 0) return false;
    if (t.bitmapTypeName !== null) {
      return (
        ctx.symbols.bitmapFields.get(t.bitmapTypeName)?.has(member) ?? false
      );
    }
    if (t.typeName === null) return false;
    const struct = ctx.program.symbolByCName(t.typeName);
    if (struct?.kind === "struct") return struct.fields.has(member);
    return ctx.symbolTable.getStructFieldInfo(t.typeName, member) !== undefined;
  }

  /** A field of a struct, a bitmap field, or a property (untyped here) */
  private static fieldOf(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    if (
      // ADR-058/ADR-045 properties: typed by their own rules, never as a member
      OperandTyper.readsProperty(t, member, ctx) ||
      t.typeName === null ||
      t.dimensions.length > 0
    ) {
      return UNKNOWN;
    }
    if (t.bitmapTypeName !== null) {
      return OperandTyper.bitmapFieldOf(t, t.bitmapTypeName, member, ctx);
    }
    const struct = ctx.program.symbolByCName(t.typeName);
    if (struct?.kind === "struct") {
      const field = struct.fields.get(member);
      if (!field) return UNKNOWN;
      return {
        k: "value",
        register: false,
        t: {
          ...OperandTyper.fromType(
            field.type,
            OperandTyper.fieldDimensions(field.type, field.dimensions ?? []),
            ctx,
          ),
          hasSideEffect: t.hasSideEffect,
        },
      };
    }
    return OperandTyper.foreignFieldOf(t, t.typeName, member, ctx);
  }

  /** A bitmap field: a Boolean bit, or an unsigned run of bits */
  private static bitmapFieldOf(
    t: IOperandType,
    bitmapTypeName: string,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    const field = ctx.symbols.bitmapFields.get(bitmapTypeName)?.get(member);
    if (!field) return UNKNOWN;
    const width = field.width;
    const typeName = width === 1 ? "bool" : OperandTyper.unsignedFor(width);
    return {
      k: "value",
      register: false,
      t: {
        ...OperandTyper.plain(typeName),
        category: width === 1 ? "boolean" : "unsigned",
        bitWidth: width === 1 ? null : width,
        hasSideEffect: t.hasSideEffect,
      },
    };
  }

  /** A member of a header's struct or class */
  private static foreignFieldOf(
    t: IOperandType,
    typeName: string,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    const foreign = ForeignTypeFacts.fieldOperand(
      typeName,
      member,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    // A C struct's function-pointer field, `ops.get()` (#1668 review: its
    // call's result was untyped)
    const pointer = ForeignTypeFacts.fieldCallOperand(
      typeName,
      member,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    if (pointer !== undefined) {
      return { k: "foreignFunction", result: pointer };
    }
    if (foreign) {
      return {
        k: "value",
        register: false,
        // A read of the field has the struct's side effect, or its own: a
        // volatile field is one (#1760 review: the struct's replaced it)
        t: {
          ...foreign,
          hasSideEffect: t.hasSideEffect || foreign.hasSideEffect,
        },
      };
    }
    // A C++ class's member function, `dev.read()`: named `Dev::read`, as a
    // static member's call already is, so the call that follows
    // resolves it (#1668 review: an instance method's result was untyped)
    return t.form.kind === "foreign" || t.form.kind === "declared"
      ? { k: "foreignPath", parts: [typeName, member] }
      : UNKNOWN;
  }

  /**
   * A path into a C++ namespace or class, `NS.nf`: a variable the path names
   * is typed where it is reached, so a member after it resolves too
   * (`NS.nps.pf`); anything else stays a path, for a call to resolve
   * (#1668 review: a namespace variable was typed only when called).
   */
  private static foreignPathOf(
    parts: readonly string[],
    ctx: ITypingContext,
  ): TChainValue {
    const t = ForeignTypeFacts.variableOperand(
      parts.join("::"),
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    return t ? { k: "value", register: false, t } : { k: "foreignPath", parts };
  }

  /**
   * A field's dimensions as the program subscripts them. A string field's
   * symbol carries its C buffer, capacity + 1, as its LAST dimension
   * (`char name[33]`), which a `string<32>` variable's type does not; the
   * buffer is the string's own, typed by its capacity, so it is left off.
   */
  private static fieldDimensions(
    type: TType,
    dimensions: ReadonlyArray<number | string>,
  ): ReadonlyArray<number | string> {
    if (type.kind !== "string" || dimensions.length === 0) return dimensions;
    return dimensions.at(-1) === type.capacity + 1
      ? dimensions.slice(0, -1)
      : dimensions;
  }

  /**
   * What the classifier is told about a subscripted value.
   *
   * ADR-024's "a subscript into a scalar is a bit index" is about integers
   * whose bits C-Next can see, so a C or C++ header's scalar integer is one
   * (S25). A header's value that is NOT an integer -- a struct, a C++ type
   * with its own `operator[]` -- is left to C and C++: shown as unknown, so
   * its subscript stays the element access it always was.
   */
  private static subscriptedShape(
    t: IOperandType | null,
  ): { isArray: boolean; isString: boolean } | null {
    if (t === null) return null;
    const isArray = t.dimensions.length > 0;
    // A header scalar with bits -- an integer, or a float (#1760 review: a
    // `double`'s subscript was read as an element) -- is bit-indexed as a
    // C-Next one is (ADR-007); anything else there is untyped
    if (
      t.form.kind === "foreign" &&
      !isArray &&
      !OperandTyper.hasWritableBits(t)
    ) {
      return null;
    }
    return { isArray, isString: OperandTyper.isString(t) };
  }

  private static subscriptOf(
    current: TChainValue,
    indices: readonly TExpression[],
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    const t = current.k === "value" ? current.t : null;
    const subscript = SubscriptClassifier.classify({
      typeInfo: OperandTyper.subscriptedShape(t),
      subscriptCount: indices.length,
      isRegisterAccess: current.k === "value" && current.register,
    });
    if (t === null) return { next: UNKNOWN, subscript };
    // An element read whose index calls, or reads a volatile, has that side
    // effect too: `arr[nextIndex()]` is not a pure read
    const keep = {
      hasSideEffect:
        t.hasSideEffect ||
        indices.some((index) => OperandTyper.hasSideEffect(index, ctx)),
    };

    switch (subscript) {
      case "array_element": {
        if (t.dimensions.length > 0) {
          return {
            subscript,
            next: {
              k: "value",
              register: false,
              t: {
                ...t,
                dimensions: t.dimensions.slice(1),
                overflow: null,
                binding: null,
                form: DECLARED,
                ...keep,
              },
            },
          };
        }
        // Only a string's element is a character (#1760 review). A header
        // value with no dimensions -- a C++ `operator[]` result, a `T*`
        // field -- is one the typer cannot see into, not a `char`
        if (!OperandTyper.isString(t)) {
          return { subscript, next: UNKNOWN };
        }
        return {
          subscript,
          next: {
            k: "value",
            register: false,
            t: {
              ...OperandTyper.plain("char"),
              category: "character",
              bitWidth: 8,
              ...keep,
            },
          },
        };
      }
      case "array_slice":
        return {
          subscript,
          next: {
            k: "value",
            register: false,
            t: { ...t, overflow: null, binding: null, ...keep },
          },
        };
      case "bit_single":
        return {
          subscript,
          next: {
            k: "value",
            register: false,
            t: {
              ...OperandTyper.plain("bool"),
              category: "boolean",
              form: { kind: "bitIndex" },
              ...keep,
            },
          },
        };
      case "bit_range": {
        const width = OperandTyper.foldedWidth(indices[1], ctx);
        // The unsigned type that holds the bits, as 2.2 always typed a range
        const typeName =
          width === null ? null : OperandTyper.unsignedFor(width);
        return {
          subscript,
          next: {
            k: "value",
            register: false,
            t: {
              ...OperandTyper.plain(typeName),
              category: "unsigned",
              bitWidth: OperandTyper.widthOf(typeName),
              form: { kind: "bitRange", width },
              ...keep,
            },
          },
        };
      }
    }
  }

  private static callOf(
    current: TChainValue,
    ctx: ITypingContext,
  ): TChainValue {
    const call: TOperandForm = { kind: "call" };
    if (current.k === "function") {
      return {
        k: "value",
        register: false,
        t: {
          ...OperandTyper.fromType(current.returnType, [], ctx),
          hasSideEffect: true,
          form: call,
        },
      };
    }
    if (current.k === "value" && current.t.typeName !== null) {
      // An ADR-029 callback: its type names the function that defines it
      const definer = ctx.program.symbolByCName(current.t.typeName);
      if (definer?.kind === "function") {
        return {
          k: "value",
          register: false,
          t: {
            ...OperandTyper.fromType(definer.returnType, [], ctx),
            hasSideEffect: true,
            form: call,
          },
        };
      }
    }
    if (current.k === "foreignFunction") {
      return current.result
        ? {
            k: "value",
            register: false,
            t: { ...current.result, hasSideEffect: true, form: call },
          }
        : UNKNOWN;
    }
    if (current.k === "foreignPath") {
      const t = ForeignTypeFacts.callOperand(
        current.parts.join("::"),
        ctx.symbolTable,
        OperandTyper.target(ctx),
      );
      return t ? { k: "value", register: false, t } : UNKNOWN;
    }
    return UNKNOWN;
  }

  // --------------------------------------------------------------------------
  // Small facts
  // --------------------------------------------------------------------------

  /** A bit range's width, when it folds in the constants visible there */
  private static foldedWidth(
    widthExpr: TExpression | undefined,
    ctx: ITypingContext,
  ): number | null {
    if (!widthExpr) return null;
    const value = ConstExprLowering.valueOf(
      widthExpr,
      ConstantFold.environment(ctx.program, ctx.sourceFile),
    );
    return value !== undefined && value > 0 ? value : null;
  }

  private static unsignedFor(width: number): string | null {
    if (width <= 8) return "u8";
    if (width <= 16) return "u16";
    if (width <= 32) return "u32";
    if (width <= 64) return "u64";
    return null;
  }

  private static widthOf(typeName: string | null): number | null {
    return typeName !== null && TypeCheckUtils.isInteger(typeName)
      ? TYPE_WIDTH[typeName]
      : null;
  }

  private static cNameOf(sourceName: string): string {
    return sourceName.includes(".")
      ? QualifiedCName.fromParts(sourceName.split("."))
      : sourceName;
  }

  private static booleanValue(hasSideEffect: boolean): IOperandType {
    return {
      ...OperandTyper.plain("bool"),
      category: "boolean",
      hasSideEffect,
      form: { kind: "boolean" },
    };
  }

  /** An operand with a type name and nothing else settled */
  private static plain(typeName: string | null): IOperandType {
    return {
      typeName,
      cType: null,
      dimensions: [],
      category: "none",
      bitWidth: null,
      stringCapacity: null,
      enumTypeName: null,
      bitmapTypeName: null,
      overflow: null,
      hasSideEffect: false,
      form: DECLARED,
      binding: null,
    };
  }

  /** The run's target description, or null while 1.4 has not resolved it */
  static target(ctx: ITypingContext): ITargetDescription | null {
    const target = ctx.program.target();
    return target.kind === "resolved" ? target.description : null;
  }
}

export default OperandTyper;
