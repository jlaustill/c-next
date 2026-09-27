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
import { ParserRuleContext, ParseTree, TerminalNode } from "antlr4ng";

import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import ArrayDimensionParser from "./ArrayDimensionParser";
import ChainRoot from "./ChainRoot";
import ForeignTypeFacts from "./ForeignTypeFacts";
import LiteralUtils from "./LiteralUtils";
import ParserUtils from "./ParserUtils";
import QualifiedCName from "./QualifiedCName";
import ScopeUtils from "./ScopeUtils";
import SubscriptClassifier from "./SubscriptClassifier";
import TypeResolver from "./TypeResolver";
import type IChainStep from "../transpiler/types/IChainStep";
import type IChainTyping from "../transpiler/types/IChainTyping";
import type IOperandType from "../transpiler/types/IOperandType";
import type ITargetDescription from "../transpiler/types/ITargetDescription";
import type ITypingContext from "../transpiler/types/ITypingContext";
import type TEssentialCategory from "../transpiler/types/TEssentialCategory";
import type TType from "../transpiler/types/TType";
import type TValueBinding from "../transpiler/types/TValueBinding";
import type TSubscriptKind from "../transpiler/types/TSubscriptKind";

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
  | { readonly k: "unknown" };

const UNKNOWN: TChainValue = { k: "unknown" };

/** ADR-058 properties: typed by their own rules, never as a member */
const PROPERTIES = new Set([
  "length",
  "bit_length",
  "byte_length",
  "element_count",
  "capacity",
  "size",
]);

/** How an operand came to have its type */
type TOperandForm = IOperandType["form"];

const DECLARED: TOperandForm = { kind: "declared" };

class OperandTyper {
  /**
   * The value type of any expression-level node: it descends through
   * single-child levels, parentheses, unary operators, ternaries and
   * composites. Null when the operand has no type this can settle.
   */
  static typeOf(
    node: ParserRuleContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    const inner = OperandTyper.descend(node);
    if (inner instanceof Parser.PostfixExpressionContext) {
      return OperandTyper.chainResult(inner, ctx);
    }
    if (inner instanceof Parser.PrimaryExpressionContext) {
      return OperandTyper.primaryType(inner, ctx);
    }
    if (inner instanceof Parser.LiteralContext) {
      return OperandTyper.literalType(inner);
    }
    if (inner instanceof Parser.CastExpressionContext) {
      return OperandTyper.castType(inner, ctx);
    }
    if (inner instanceof Parser.UnaryExpressionContext) {
      return OperandTyper.unaryType(inner, ctx);
    }
    if (inner instanceof Parser.TernaryExpressionContext) {
      return OperandTyper.ternaryType(inner, ctx);
    }
    if (OperandTyper.isBooleanLevel(inner)) {
      return OperandTyper.booleanValue(false);
    }
    if (inner instanceof Parser.ShiftExpressionContext) {
      // `a << n` is `a`'s type; the shift count is never an operand (C01)
      const left = inner.additiveExpression()[0];
      return left ? OperandTyper.typeOf(left, ctx) : null;
    }
    if (OperandTyper.isCompositeLevel(inner)) {
      return OperandTyper.compositeType(inner, ctx);
    }
    return null;
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
    node: ParserRuleContext,
    ctx: ITypingContext,
  ): Array<IOperandType | null> {
    const inner = OperandTyper.descend(node);
    if (OperandTyper.isCompositeLevel(inner)) {
      return OperandTyper.ruleChildren(inner).flatMap((child) =>
        OperandTyper.valueLeaves(child, ctx),
      );
    }
    if (inner instanceof Parser.ShiftExpressionContext) {
      const left = inner.additiveExpression()[0];
      return left ? OperandTyper.valueLeaves(left, ctx) : [];
    }
    if (inner instanceof Parser.TernaryExpressionContext) {
      const arms = ParserUtils.ternaryValueArms(inner);
      if (arms !== null) {
        return arms.flatMap((arm) => OperandTyper.valueLeaves(arm, ctx));
      }
    }
    if (inner instanceof Parser.UnaryExpressionContext) {
      const operator = inner.getChild(0)?.getText();
      const operand = inner.unaryExpression();
      if (operator === "&") return [];
      if ((operator === "-" || operator === "~") && operand) {
        return OperandTyper.valueLeaves(operand, ctx);
      }
    }
    if (inner instanceof Parser.PrimaryExpressionContext) {
      const parenthesized = inner.expression();
      if (parenthesized) {
        return OperandTyper.valueLeaves(parenthesized, ctx);
      }
    }
    return [OperandTyper.typeOf(inner, ctx)];
  }

  /**
   * A postfix chain or assignment target, typed one operation at a time. A
   * `this.` or `global.` root has consumed its first `.name`.
   */
  static chainOf(
    node: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    ctx: ITypingContext,
  ): IChainTyping {
    return OperandTyper.walkChain(node, ctx).typing;
  }

  /** The chain typed, and the value it ends on */
  private static walkChain(
    node: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    ctx: ITypingContext,
  ): { typing: IChainTyping; last: IOperandType | null } {
    const start = OperandTyper.chainStart(node, ctx);
    const steps: IChainStep[] = [];
    let current = start.value;
    for (const op of start.ops) {
      const before = current.k === "value" ? current.t : null;
      const { next, subscript } = OperandTyper.applyOp(current, op, ctx);
      steps.push({
        before,
        subscript,
        after: next.k === "value" ? next.t : null,
      });
      current = next;
    }
    return {
      typing: { root: start.binding, steps },
      last: current.k === "value" ? current.t : null,
    };
  }

  /**
   * Whether an operand is essentially Boolean: an applied relational or
   * logical operator, `!`, or a `bool`. A single bit of a scalar is not
   * (ADR-024: it is a bit index).
   */
  static isBoolean(t: IOperandType | null): boolean {
    if (t === null) return false;
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
    if (/^u(?:8|16|32|64)$/.test(typeName)) return "unsigned";
    if (/^i(?:8|16|32|64)$/.test(typeName)) return "signed";
    if (/^f(?:32|64)$/.test(typeName)) return "floating";
    return "none";
  }

  // --------------------------------------------------------------------------
  // Levels
  // --------------------------------------------------------------------------

  /** Through every level that has exactly one rule child and nothing else */
  private static descend(node: ParserRuleContext): ParserRuleContext {
    let current = node;
    while (current.getChildCount() === 1) {
      const child = current.getChild(0);
      if (!(child instanceof ParserRuleContext)) break;
      current = child;
    }
    return current;
  }

  private static ruleChildren(node: ParserRuleContext): ParserRuleContext[] {
    const children: ParserRuleContext[] = [];
    for (let i = 0; i < node.getChildCount(); i += 1) {
      const child: ParseTree | null = node.getChild(i);
      if (child instanceof ParserRuleContext) children.push(child);
    }
    return children;
  }

  private static isBooleanLevel(node: ParserRuleContext): boolean {
    return (
      node instanceof Parser.OrExpressionContext ||
      node instanceof Parser.AndExpressionContext ||
      node instanceof Parser.EqualityExpressionContext ||
      node instanceof Parser.RelationalExpressionContext
    );
  }

  private static isCompositeLevel(node: ParserRuleContext): boolean {
    return (
      node instanceof Parser.BitwiseOrExpressionContext ||
      node instanceof Parser.BitwiseXorExpressionContext ||
      node instanceof Parser.BitwiseAndExpressionContext ||
      node instanceof Parser.AdditiveExpressionContext ||
      node instanceof Parser.MultiplicativeExpressionContext
    );
  }

  private static compositeType(
    node: ParserRuleContext,
    ctx: ITypingContext,
  ): IOperandType {
    const leaves = OperandTyper.valueLeaves(node, ctx);
    const typed = leaves.filter((leaf): leaf is IOperandType => leaf !== null);
    const categories = new Set(
      typed.map((leaf) => leaf.category).filter((c) => c !== "none"),
    );
    const names = new Set(typed.map((leaf) => leaf.typeName));
    const category =
      categories.size === 1 ? ([...categories][0] ?? "none") : "none";
    return {
      ...OperandTyper.plain(names.size === 1 ? [...names][0] : null),
      category,
      hasSideEffect: typed.some((leaf) => leaf.hasSideEffect),
      form: { kind: "composite", leaves },
    };
  }

  private static ternaryType(
    node: Parser.TernaryExpressionContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    const arms = ParserUtils.ternaryValueArms(node);
    if (arms === null) return null;
    const whenTrue = OperandTyper.typeOf(arms[0], ctx);
    const whenFalse = OperandTyper.typeOf(arms[1], ctx);
    const same =
      whenTrue !== null &&
      whenFalse !== null &&
      whenTrue.typeName === whenFalse.typeName &&
      whenTrue.category === whenFalse.category;
    return {
      ...(same ? whenTrue : OperandTyper.plain(null)),
      overflow: null,
      binding: null,
      hasSideEffect:
        (whenTrue?.hasSideEffect ?? false) ||
        (whenFalse?.hasSideEffect ?? false),
      form: { kind: "ternary", arms: [whenTrue, whenFalse] },
    };
  }

  private static unaryType(
    node: Parser.UnaryExpressionContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    const operator = node.getChild(0)?.getText();
    const operand = node.unaryExpression();
    if (operator === "!") {
      return OperandTyper.booleanValue(
        operand
          ? (OperandTyper.typeOf(operand, ctx)?.hasSideEffect ?? false)
          : false,
      );
    }
    if ((operator === "-" || operator === "~") && operand) {
      const t = OperandTyper.typeOf(operand, ctx);
      return t ? { ...t, overflow: null, binding: null } : null;
    }
    // `&x` is an address, never a value operand (#1152)
    return null;
  }

  private static primaryType(
    node: Parser.PrimaryExpressionContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    const parenthesized = node.expression();
    if (parenthesized) {
      return OperandTyper.typeOf(parenthesized, ctx);
    }
    const literal = node.literal();
    if (literal) return OperandTyper.literalType(literal);
    const cast = node.castExpression();
    if (cast) return OperandTyper.castType(cast, ctx);
    const identifier = node.IDENTIFIER();
    if (!identifier) return null;
    const binding = ctx.program.bindValue(
      ctx.sourceFile,
      null,
      identifier.getText(),
      ParserUtils.getPosition(node),
    );
    return binding ? OperandTyper.boundValue(binding, ctx) : null;
  }

  // --------------------------------------------------------------------------
  // Leaves
  // --------------------------------------------------------------------------

  private static literalType(node: Parser.LiteralContext): IOperandType | null {
    const text = node.getText();
    if (text.startsWith("'")) {
      return {
        ...OperandTyper.plain("char"),
        category: "character",
        bitWidth: 8,
        form: { kind: "literal", literal: "char", suffixed: false },
      };
    }
    const typeName = LiteralUtils.typeOf(node);
    if (typeName === null) return null;
    if (typeName === "bool") {
      return {
        ...OperandTyper.plain("bool"),
        category: "boolean",
        form: { kind: "literal", literal: "bool", suffixed: false },
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
      form: { kind: "literal", literal: "integer", suffixed },
    };
  }

  private static castType(
    node: Parser.CastExpressionContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    const operand = node.unaryExpression();
    const inner = operand ? OperandTyper.typeOf(operand, ctx) : null;
    const target = OperandTyper.namedType(
      node.type(),
      ctx,
      ParserUtils.getPosition(node),
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

  /** A written type, as a cast names it */
  private static namedType(
    typeCtx: Parser.TypeContext,
    ctx: ITypingContext,
    at: { line: number; column: number },
  ): IOperandType | null {
    const primitive = typeCtx.primitiveType();
    if (primitive) {
      return OperandTyper.fromType(
        { kind: "primitive", primitive: primitive.getText() } as TType,
        [],
        ctx,
      );
    }
    const text = typeCtx.getText();
    const scopePath = ctx.program.lexicalFrameAt(ctx.sourceFile, at).scopePath;
    const symbols = ctx.symbols;
    const qualified = ScopeUtils.qualifyScopeType(
      text,
      scopePath,
      (name) =>
        symbols.knownEnums.has(name) ||
        symbols.knownStructs.has(name) ||
        symbols.knownBitmaps.has(name),
    );
    const cName = qualified.includes(".")
      ? QualifiedCName.fromParts(qualified.split("."))
      : qualified;
    if (
      symbols.knownEnums.has(cName) ||
      symbols.knownBitmaps.has(cName) ||
      symbols.knownStructs.has(cName)
    ) {
      return OperandTyper.fromType({ kind: "struct", name: cName }, [], ctx);
    }
    return ForeignTypeFacts.operandType(
      text,
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
        return null;
    }
  }

  /** A C-Next type, as a declaration states it */
  private static fromType(
    type: TType,
    dimensions: ReadonlyArray<number | string>,
    ctx: ITypingContext,
  ): IOperandType {
    if (type.kind === "external") {
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

  private static chainResult(
    node: Parser.PostfixExpressionContext,
    ctx: ITypingContext,
  ): IOperandType | null {
    return OperandTyper.walkChain(node, ctx).last;
  }

  private static chainStart(
    node: Parser.PostfixExpressionContext | Parser.AssignmentTargetContext,
    ctx: ITypingContext,
  ): {
    binding: TValueBinding | null;
    value: TChainValue;
    ops: ReadonlyArray<Parser.PostfixOpContext | Parser.PostfixTargetOpContext>;
  } {
    const at = ParserUtils.getPosition(node);
    const isTarget = node instanceof Parser.AssignmentTargetContext;
    const ops: Array<Parser.PostfixOpContext | Parser.PostfixTargetOpContext> =
      isTarget ? [...node.postfixTargetOp()] : [...node.postfixOp()];
    const root = isTarget
      ? ChainRoot.ofTarget(node)
      : ChainRoot.ofPrimary(node.primaryExpression());

    if (root !== null) {
      // A target spells `this.name` in the rule itself; an expression's
      // first postfix op is `.name`
      if (isTarget) {
        const name = node.IDENTIFIER()?.getText();
        return name
          ? OperandTyper.rootedStart(root, name, ops, at, ctx)
          : { binding: null, value: UNKNOWN, ops: [] };
      }
      const first = ops.shift();
      const name = first?.IDENTIFIER()?.getText();
      if (!name || first?.DOT() === null) {
        return { binding: null, value: UNKNOWN, ops: [] };
      }
      return OperandTyper.rootedStart(root, name, ops, at, ctx);
    }

    if (!isTarget) {
      const primary = node.primaryExpression();
      const identifier = primary.IDENTIFIER();
      if (!identifier) {
        const t = OperandTyper.primaryType(primary, ctx);
        return {
          binding: null,
          value: t ? { k: "value", t, register: false } : UNKNOWN,
          ops,
        };
      }
      return OperandTyper.namedStart(identifier, ops, at, ctx);
    }
    const identifier = node.IDENTIFIER();
    return identifier
      ? OperandTyper.namedStart(identifier, ops, at, ctx)
      : { binding: null, value: UNKNOWN, ops };
  }

  /** `this.name` or `global.name`, with that first member consumed */
  private static rootedStart(
    root: "this" | "global",
    name: string,
    ops: ReadonlyArray<Parser.PostfixOpContext | Parser.PostfixTargetOpContext>,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): {
    binding: TValueBinding | null;
    value: TChainValue;
    ops: ReadonlyArray<Parser.PostfixOpContext | Parser.PostfixTargetOpContext>;
  } {
    const binding = ctx.program.bindValue(ctx.sourceFile, root, name, at);
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    if (binding) {
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
    identifier: TerminalNode,
    ops: ReadonlyArray<Parser.PostfixOpContext | Parser.PostfixTargetOpContext>,
    at: { line: number; column: number },
    ctx: ITypingContext,
  ): {
    binding: TValueBinding | null;
    value: TChainValue;
    ops: ReadonlyArray<Parser.PostfixOpContext | Parser.PostfixTargetOpContext>;
  } {
    const name = identifier.getText();
    const binding = ctx.program.bindValue(ctx.sourceFile, null, name, at);
    if (binding?.kind === "scope") {
      return {
        binding,
        value: { k: "scope", scopePath: binding.scopePath },
        ops,
      };
    }
    if (binding && binding.kind !== "foreign") {
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
      const fn = ctx.program.resolveFunction(
        name,
        ctx.program.scope(scopePath) ?? ctx.program.globalScope(),
      );
      if (fn)
        return {
          binding: null,
          value: { k: "function", returnType: fn.returnType },
          ops,
        };
    }
    const symbols = ctx.symbols;
    const enumName = ScopeUtils.qualifyScopeType(name, scopePath, (q) =>
      symbols.knownEnums.has(q),
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
    if (binding?.kind === "foreign") {
      const t = OperandTyper.boundValue(binding, ctx);
      return {
        binding,
        value: t
          ? { k: "value", t, register: false }
          : { k: "foreignPath", parts: [name] },
        ops,
      };
    }
    return { binding: null, value: { k: "foreignPath", parts: [name] }, ops };
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
    op: Parser.PostfixOpContext | Parser.PostfixTargetOpContext,
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    if (op.DOT() !== null) {
      const member = op.IDENTIFIER()?.getText();
      return {
        next: member ? OperandTyper.memberOf(current, member, ctx) : UNKNOWN,
        subscript: null,
      };
    }
    if (op.LBRACKET() !== null) {
      return OperandTyper.subscriptOf(current, op.expression(), op, ctx);
    }
    return { next: OperandTyper.callOf(current, ctx), subscript: null };
  }

  private static isCall(
    op: Parser.PostfixOpContext | Parser.PostfixTargetOpContext,
  ): boolean {
    return op.DOT() === null && op.LBRACKET() === null;
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
        return { k: "foreignPath", parts: [...current.parts, member] };
      case "value":
        return OperandTyper.fieldOf(current.t, member, ctx);
      default:
        return UNKNOWN;
    }
  }

  /** A field of a struct, a bitmap field, or a property (untyped here) */
  private static fieldOf(
    t: IOperandType,
    member: string,
    ctx: ITypingContext,
  ): TChainValue {
    if (
      PROPERTIES.has(member) ||
      t.typeName === null ||
      t.dimensions.length > 0
    ) {
      return UNKNOWN;
    }
    if (t.bitmapTypeName !== null) {
      const field = ctx.symbols.bitmapFields.get(t.bitmapTypeName)?.get(member);
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
    const struct = ctx.program.symbolByCName(t.typeName);
    if (struct?.kind === "struct") {
      const field = struct.fields.get(member);
      if (!field) return UNKNOWN;
      return {
        k: "value",
        register: false,
        t: {
          ...OperandTyper.fromType(field.type, field.dimensions ?? [], ctx),
          hasSideEffect: t.hasSideEffect,
        },
      };
    }
    const foreign = ForeignTypeFacts.fieldOperand(
      t.typeName,
      member,
      ctx.symbolTable,
      OperandTyper.target(ctx),
    );
    return foreign
      ? {
          k: "value",
          register: false,
          t: { ...foreign, hasSideEffect: t.hasSideEffect },
        }
      : UNKNOWN;
  }

  private static subscriptOf(
    current: TChainValue,
    indices: Parser.ExpressionContext[],
    op: ParserRuleContext,
    ctx: ITypingContext,
  ): { next: TChainValue; subscript: TSubscriptKind | null } {
    const t = current.k === "value" ? current.t : null;
    const subscript = SubscriptClassifier.classify({
      typeInfo: t
        ? {
            isArray: t.dimensions.length > 0,
            isString: t.stringCapacity !== null,
          }
        : null,
      subscriptCount: indices.length,
      isRegisterAccess: current.k === "value" && current.register,
    });
    if (t === null) return { next: UNKNOWN, subscript };
    const keep = { hasSideEffect: t.hasSideEffect };

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
              },
            },
          };
        }
        // A string's element is a character
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
            t: { ...t, overflow: null, binding: null },
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
        const width = OperandTyper.foldedWidth(indices[1], op, ctx);
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
    widthExpr: Parser.ExpressionContext | undefined,
    at: ParserRuleContext,
    ctx: ITypingContext,
  ): number | null {
    if (!widthExpr) return null;
    const value = ArrayDimensionParser.parseText(widthExpr.getText(), {
      constValues: new Map(
        ctx.program.constValuesAt(ctx.sourceFile, ParserUtils.getPosition(at)),
      ),
    });
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
    const match = typeName ? /^[ui](8|16|32|64)$/.exec(typeName) : null;
    return match ? Number(match[1]) : null;
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

  /** The run's target, when 1.4 resolved one */
  private static target(ctx: ITypingContext): ITargetDescription | null {
    const target = ctx.program.target();
    return target.kind === "resolved" ? target.description : null;
  }
}

export default OperandTyper;
