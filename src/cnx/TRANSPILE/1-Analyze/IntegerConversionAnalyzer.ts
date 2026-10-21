/**
 * ADR-024 integer conversions: E0868, E0869 and E0891.
 *
 * #1322. Six rules across `TypeResolver` and `CodeGenerator`, reached through
 * three entry points -- a declaration's initializer, an assignment, a cast --
 * and two rethrow WRAPPERS that caught the message and prefixed `${line}:${col}`
 * onto it. The wrappers are why the assignment fixtures already showed a real
 * position while the cast fixtures showed `1:0`: the same rule, smuggling its
 * position through the message on one path and not the other.
 *
 * ## The rule, once
 *
 * A literal must fit the target's range. A non-literal integer source must not
 * be wider than the target, and must agree with it on signedness. That is the
 * whole of it, whichever of the three spellings reaches it -- which is why it
 * is one analyzer with three listener methods rather than three checks.
 *
 * ## What is deliberately NOT typed
 *
 * A lone bit extraction, `large[0, 8]`, is ADR-024's explicit reinterpret --
 * the escape hatch the rule tells the author to use. Typing it would make the
 * sanctioned form fail the very check it exists to satisfy; codegen's
 * declaration path declined for that reason, and this pass declines for all
 * three. A composite's integer type is the typer's, which settles it by
 * `CompositeType.integerOf` over its value leaves -- category from the first
 * integer operand, width from the widest -- the one rule 2.2 sizes its clamp
 * helper by (#1668).
 *
 * ## Two holes codegen had, both closed
 *
 * A COMPOSITE source was typed on a declaration and not on an assignment, and
 * an assignment was checked against the ROOT variable's declared type rather
 * than the type the value actually lands in. The second is the sharper one:
 * `c.col <- wide` emitted `c.col = wide;`, a u32 truncated into a u8 field with
 * no diagnostic, because the lookup found `c` -- a struct -- and skipped.
 * Reading the chain to the field is what ADR-036's bounds rule already did,
 * so both holes closed by asking the question that was already being asked
 * next door -- now the one operand typer's `typeOfTarget` (#1668).
 *
 * ## A third hole this closes
 *
 * `u8 narrow <- this.wide;` inside a scope compiled clean, while the identical
 * line at top level was rejected -- codegen's text-keyed lookup did not resolve
 * the `this.` spelling, so the source read as untyped and untyped never
 * rejects. The lexical frames resolve it, so the rule now holds in the scope
 * contexts too. Measured against the corpus before relying on it.
 *
 * ## Typed by the one operand typer (#1668)
 *
 * Source and target come from `OperandTyper`, so a suffixed literal is its
 * suffix's type (`u8 x <- 300u16` narrows), `-w` is `w`'s type, a cast inside
 * a composite counts at the type it names, a bit range's const width folds,
 * and a C or C++ header's integer -- a source, or the field a value lands in
 * -- has its width on this target. Every assignment site is read, `for`
 * headers included (#1726).
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import VariableDeclarations from "../../utils/VariableDeclarations";
import OperandTyper from "../../utils/OperandTyper";
import ExpressionShape from "../../utils/ExpressionShape";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import invariant from "../../utils/invariant";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import CompositeType from "../../utils/CompositeType";
import StructInitializerType from "./helpers/StructInitializerType";
import ValuePositions from "./helpers/ValuePositions";
import IIntegerConversionError from "./types/IIntegerConversionError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IValuePosition from "../../types/IValuePosition";
import type IOperandType from "../../types/IOperandType";
import SourceOrder from "../../utils/SourceOrder";

const INTEGER_LITERAL = /^-?(?:\d+|0[xX][0-9a-fA-F]+|0[bB][01]+)$/;

class IntegerConversionCheck {
  private readonly found: IIntegerConversionError[] = [];

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): IIntegerConversionError[] {
    return this.found;
  }

  public checkDeclaration(declaration: IVariableDeclarationSyntax): void {
    if (!declaration.initializer) return;
    if (this.checkStringsAt(declaration.initializer)) return;
    const target = declaration.type.text;
    if (!TypeCheckUtils.isInteger(target)) return;
    this.check(target, declaration.initializer, "assign", true);
  }

  /** The values E0891 types from their position: arguments, fields, elements */
  public checkExpression(expr: TExpression): void {
    switch (expr.kind) {
      case "postfix":
        for (const op of expr.ops) {
          if (op.kind !== "call") continue;
          for (const argument of op.arguments) this.checkFloatingAt(argument);
        }
        return;
      case "structInitializer":
        for (const field of expr.fields) this.checkFloatingAt(field.value);
        return;
      case "arrayInitializer":
        if (expr.fill) this.checkFloatingAt(expr.fill);
        for (const element of expr.elements) this.checkFloatingAt(element);
        return;
      case "cast":
        this.checkCast(expr);
        return;
      default:
        return;
    }
  }

  /** E0914, then E0891, for a value at the type its position gives it */
  public checkFloatingAt(value: TExpression): void {
    if (this.checkStringsAt(value)) return;
    const target = StructInitializerType.valueTypeAt(
      ValuePositions.at(this.positions, value),
    );
    if (target !== null && TypeCheckUtils.isInteger(target)) {
      this.checkFloating(target, value);
    }
  }

  /** An assignment statement, or a `for` loop's init or update */
  public checkSite(site: IAssignmentSyntax): void {
    if (this.checkStringAt(site.value)) return;
    if (this.writesWholeString(site) && this.checkNonStringAt(site.value)) {
      return;
    }
    // A compound operator is arithmetic at the operands' width, which ADR-044
    // governs; only a plain `<-` is a conversion.
    if (site.operator !== "<-") return;
    const target = site.target;
    if (
      target.kind === "postfix" &&
      target.ops.some(
        (op) => op.kind === "subscript" && op.indexes.length === 2,
      )
    ) {
      return;
    }
    const targetType =
      OperandTyper.typeOfTarget(target, this.context)?.typeName ?? "";
    if (!TypeCheckUtils.isInteger(targetType)) return;
    this.check(targetType, site.value, "assign", true);
  }

  /** E0914, then E0923: a string lands only in a string, and only a string does */
  private checkStringsAt(value: TExpression): boolean {
    return this.checkStringAt(value) || this.checkNonStringAt(value);
  }

  /**
   * E0923: a value that is not a string at a position that types it one
   * string<N> (ADR-045, #1634) -- whatever it is, as `OperandTyper.isStringValue`
   * decides. True when reported. Unreported, it reached the string copy, which
   * takes the value as an address. A string array's list element is E0866's
   * (ADR-035, #2195), which takes only a string literal there.
   */
  private checkNonStringAt(value: TExpression): boolean {
    const position = ValuePositions.at(this.positions, value);
    if (position.inList) return false;
    const target = StructInitializerType.valueTypeAt(position);
    if (target === null || !TypeCheckUtils.isSizedStringName(target)) {
      return false;
    }
    if (OperandTyper.isStringValue(value, this.context) !== false) {
      return false;
    }
    this.report(
      value,
      "E0923",
      `A value that is not a string cannot be assigned to ${target}: '${value.written}'`,
      "A string<N> holds only a string (ADR-045): a literal, another string<N>, a concatenation, a substring or a C string",
    );
    return true;
  }

  /** Whether the write lands one whole string<N>, by the copy's own rule */
  private writesWholeString(site: IAssignmentSyntax): boolean {
    return OperandTyper.stringCopyCapacity(site.target, this.context) !== null;
  }

  /**
   * E0914: a string value at a position that types it a cnx scalar -- an
   * integer, a float, a bool, an enum or a bitmap. True when reported, so the
   * value is not judged again as a number.
   */
  private checkStringAt(value: TExpression): boolean {
    const target = StructInitializerType.valueTypeAt(
      ValuePositions.at(this.positions, value),
    );
    if (target === null || !this.isScalar(target, value)) return false;
    if (!this.landsString(value)) return false;
    this.report(
      value,
      "E0914",
      `A string value cannot be assigned to ${target}: '${value.written}'`,
      "A string lands only in a string<N> (ADR-045); a u8 array may be initialized by a string literal (ADR-035)",
    );
    return true;
  }

  /**
   * Every cnx type that holds one value and is not a string. A named type
   * is the one its spelling names where the value is (ADR-057): `ELocal` in
   * `scope S` is `S__ELocal`.
   */
  private isScalar(target: string, value: TExpression): boolean {
    if (
      TypeCheckUtils.isInteger(target) ||
      TypeCheckUtils.isFloat(target) ||
      target === "bool"
    ) {
      return true;
    }
    const cName = this.context.program.cTypeNameAt(
      this.context.sourceFile,
      target,
      { line: value.span.line, column: value.span.column },
    );
    const symbols = this.context.symbols;
    return symbols.knownEnums.has(cName) || symbols.knownBitmaps.has(cName);
  }

  /**
   * Whether a string is what lands: the value itself, the one it
   * parenthesizes, or either arm of a ternary -- each arm lands in the target
   */
  private landsString(value: TExpression): boolean {
    if (value.kind === "parenthesized") {
      return this.landsString(value.expression);
    }
    if (value.kind === "ternary") {
      return (
        this.landsString(value.whenTrue) || this.landsString(value.whenFalse)
      );
    }
    return (
      ExpressionShape.isStringLiteral(value) ||
      OperandTyper.isScalarString(OperandTyper.typeOf(value, this.context))
    );
  }

  private checkCast(cast: Extract<TExpression, { kind: "cast" }>): void {
    const target = cast.type.text;
    if (!TypeCheckUtils.isInteger(target)) return;
    const source = this.conversionSource(cast.operand, false);
    if (source !== null) this.checkConversion(target, source, cast, "cast");
  }

  private check(
    target: string,
    value: TExpression,
    kind: "assign" | "cast",
    typeComposites: boolean,
  ): void {
    const text = IntegerConversionCheck.integerLiteralText(value);
    if (text !== null) {
      this.checkLiteral(target, text, value);
      return;
    }
    if (this.checkFloating(target, value)) return;
    const source = this.conversionSource(value, typeComposites);
    if (source !== null) this.checkConversion(target, source, value, kind);
  }

  /** An integer literal, or a minus over one, as one token: `-1`, `0xFF` */
  private static integerLiteralText(value: TExpression): string | null {
    const negated = value.kind === "unary" && value.operator === "-";
    const literal = negated ? value.operand : value;
    if (literal.kind !== "literal") return null;
    const text = negated ? `-${literal.text}` : literal.text;
    return INTEGER_LITERAL.test(text) ? text : null;
  }

  private checkFloating(target: string, value: TExpression): boolean {
    const floating = CompositeType.floatingOf(
      OperandTyper.valueLeaves(value, this.context),
    );
    if (floating === null) return false;
    this.report(
      value,
      "E0891",
      `Implicit conversion from floating ${floating} to integer ${target}`,
      `Write the conversion as a cast, which saturates: (${target})value (ADR-024)`,
    );
    return true;
  }

  private checkLiteral(target: string, text: string, at: TExpression): void {
    // BigInt, not parseInt: a u64 bound is past 2^53, where a double stops
    // being exact and `0xFFFFFFFFFFFFFFFF` would round into range.
    const value = text.startsWith("-") ? -BigInt(text.slice(1)) : BigInt(text);

    if (TypeCheckUtils.isUnsigned(target) && value < 0n) {
      this.report(
        at,
        "E0868",
        `Negative value ${text} cannot be assigned to unsigned type ${target}`,
        `An unsigned type holds no negative values; use a signed type such as i${TYPE_WIDTH[target]}.`,
      );
      return;
    }
    const range = TypeCheckUtils.integerRange(target);
    invariant(range, `every caller checks that ${target} is an integer`);
    const [min, max] = range;
    if (value < min || value > max) {
      this.report(
        at,
        "E0868",
        `Value ${text} exceeds ${target} range (${min} to ${max})`,
        "Widen the target type, or narrow the value.",
      );
    }
  }

  private checkConversion(
    target: string,
    source: string,
    at: TExpression,
    kind: "assign" | "cast",
  ): void {
    if (source === target || !TypeCheckUtils.isInteger(source)) return;
    const verb = kind === "cast" ? "cast" : "assign";
    const subject = kind === "cast" ? "expr" : "value";
    const targetWidth = TYPE_WIDTH[target];

    if (TYPE_WIDTH[source] > targetWidth) {
      this.report(
        at,
        "E0869",
        `Cannot ${verb} ${source} to ${target} (narrowing)`,
        `Use bit indexing to say which bits you mean: ${subject}[0, ${targetWidth}]`,
      );
      return;
    }
    if (TypeCheckUtils.isSigned(source) !== TypeCheckUtils.isSigned(target)) {
      this.report(
        at,
        "E0869",
        `Cannot ${verb} ${source} to ${target} (sign change)`,
        `Use bit indexing to reinterpret the bits explicitly: ${subject}[0, ${targetWidth}]`,
      );
    }
  }

  // --- What type a source is ------------------------------------------------

  /**
   * The integer type a source converts from, as a cnx integer name, or
   * null when the rule does not judge it (#1668, the design's §5 row):
   *
   * - a top-level ternary: its branches are what matter, and
   *   `(val > 0) ? 1 : -1` has literal branches with no declared type (a
   *   `test-no-warnings` execution fixture asserts it is fine);
   * - a lone bit extraction, `large[0, 8]`: ADR-024's explicit reinterpret,
   *   the form this rule tells the author to use;
   * - a composite, `a + b`: its integer type, as the typer settled it -- the
   *   one rule 2.2 sizes its clamp helper by -- unless `composites` is false,
   *   as for a cast;
   * - anything else: the typer's type, a C or C++ integer included, at its
   *   width on this target; a suffixed literal is its suffix's type.
   */
  /** A ternary is ADR-022's, whose arms are each checked where they stand */
  private conversionSource(
    expr: TExpression,
    composites: boolean,
  ): string | null {
    if (expr.kind === "ternary") return null;
    const t = OperandTyper.typeOf(expr, this.context);
    if (t === null) return null;
    if (t.form.kind === "composite") {
      return composites && t.bitWidth !== null ? t.typeName : null;
    }
    if (t.form.kind === "bitRange" || t.form.kind === "bitIndex") return null;
    return IntegerConversionCheck.integerName(t);
  }

  private static integerName(t: IOperandType): string | null {
    if (t.dimensions.length > 0 || t.bitWidth === null) return null;
    if (t.category === "signed") return `i${t.bitWidth}`;
    if (t.category === "unsigned") return `u${t.bitWidth}`;
    return null;
  }

  /** Whether the expression, past its single-child levels, is a real ternary. */
  private report(
    at: TExpression,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.span.line,
      column: at.span.column,
      message,
      helpText,
    });
  }
}

class IntegerConversionAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): IIntegerConversionError[] {
    const check = new IntegerConversionCheck(this.context, positions);
    const visit = (declaration: TDeclarationSyntax): void => {
      if (declaration.kind === "scope") {
        for (const member of declaration.members) visit(member.declaration);
        return;
      }
      for (const statement of StatementNodes.in(declaration)) {
        if (statement.kind === "return" && statement.value) {
          check.checkFloatingAt(statement.value);
        }
      }
      for (const site of StatementNodes.assignments(declaration)) {
        check.checkSite(site);
      }
    };
    for (const entry of VariableDeclarations.in(program)) {
      check.checkDeclaration(entry.declaration);
    }
    for (const member of program.declarations) {
      visit(member.declaration);
      for (const expr of DeclarationParts.of(member.declaration).flatMap(
        ExpressionNodes.of,
      )) {
        check.checkExpression(expr);
      }
    }
    return check.errors().sort(SourceOrder.compare);
  }
}

export default IntegerConversionAnalyzer;
