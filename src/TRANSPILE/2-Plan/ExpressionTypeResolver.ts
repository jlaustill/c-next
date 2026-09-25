/**
 * ExpressionTypeResolver - Handles type inference, classification, and validation
 * Static class that reads from CodeGenState directly.
 */
import { ParserRuleContext } from "antlr4ng";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ArrayDimensionParser from "../../utils/ArrayDimensionParser";
import dimensionEvalOptions from "./dimensionEvalOptions";
import DeclaredTypeFacts from "../../utils/DeclaredTypeFacts";
import INTEGER_TYPES from "../../transpiler/types/INTEGER_TYPES";
import FLOAT_TYPES from "../../transpiler/types/FLOAT_TYPES";
import UNSIGNED_TYPES from "../../transpiler/types/UNSIGNED_TYPES";
import ExpressionUnwrapper from "../../utils/ExpressionUnwrapper";
import type TOverflowBehavior from "../../transpiler/types/TOverflowBehavior";
import type TTypeInfo from "../../transpiler/types/TTypeInfo";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import PrimitiveKindUtils from "../../utils/PrimitiveKindUtils";
import type TranspileState from "../TranspileState";

/**
 * Internal type info tracked through postfix suffix chains.
 * Preserves isArray so indexing can distinguish array access from bit indexing.
 */
type InternalTypeInfo = { baseType: string; isArray: boolean };

/**
 * Discriminated union for postfix suffix processing results.
 * stop=true: return type immediately (terminal suffix like bit indexing).
 * stop=false: continue chain with updated InternalTypeInfo.
 */
type SuffixResult =
  | { stop: true; type: string | null }
  | { stop: false; info: InternalTypeInfo };

class ExpressionTypeResolver {
  /** Sentinel value for `global` keyword in postfix expression type resolution */
  private static readonly GLOBAL_SENTINEL = "__global__";
  /** Sentinel value for `this` keyword in postfix expression type resolution */
  private static readonly THIS_SENTINEL = "__this__";

  /**
   * ADR-024: Check if a type is any integer (signed or unsigned)
   */
  static isIntegerType(typeName: string): boolean {
    return (INTEGER_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is a floating point type
   */
  static isFloatType(typeName: string): boolean {
    return (FLOAT_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * ADR-024: Check if a type is an unsigned integer
   */
  /**
   * #1450: `isSignedType`, `isNarrowingConversion` and `isSignConversion` stood
   * beside this one with no production caller, each also declared on
   * `CastValidator` under the same name and two of the pairs disagreeing.
   * #1322 moved ADR-024's narrowing and sign-change DIAGNOSTICS to pass 2.1.
   * Whether to emit a cast is still decided in `output/`, by
   * `NarrowingCastHelper.needsCast` -- an earlier version of this comment said
   * nothing here decided narrowing "under any name", which was false. What was
   * dead was this pair of names, not the capability. `isUnsignedType` survives
   * because `UnaryExprGenerator` asks it.
   */
  static isUnsignedType(typeName: string): boolean {
    return (UNSIGNED_TYPES as readonly string[]).includes(typeName);
  }

  /**
   * Check if a type is a user-defined struct (C-Next or C header).
   * Issue #103: Now checks both knownStructs AND SymbolTable.
   */
  static isStructType(typeName: string, state: TranspileState): boolean {
    return DeclaredTypeFacts.isStruct(
      state.symbols,
      state.symbolTable,
      typeName,
    );
  }

  /**
   * ADR-024: Get the type from a literal (suffixed or unsuffixed).
   */
  static getLiteralType(ctx: Parser.LiteralContext): string | null {
    const text = ctx.getText();

    if (text === "true" || text === "false") return "bool";

    const suffixMatch = /([uUiI])(8|16|32|64)$/.exec(text);
    if (suffixMatch) {
      const signChar = suffixMatch[1].toLowerCase();
      const width = suffixMatch[2];
      return (signChar === "u" ? "u" : "i") + width;
    }

    const floatMatch = /[fF](32|64)$/.exec(text);
    if (floatMatch) {
      return "f" + floatMatch[1];
    }

    // Plain integer literals (no suffix) have type int in C
    // Check for integer: starts with digit, no decimal point
    if (/^\d+$/.test(text) || /^0[xXbBoO][\da-fA-F]+$/.test(text)) {
      return "int";
    }

    // Plain float literals (no suffix) have type double in C
    if (
      /^\d*\.\d+([eE][+-]?\d+)?$/.test(text) ||
      /^\d+[eE][+-]?\d+$/.test(text)
    ) {
      return "f64";
    }

    return null;
  }

  /**
   * ADR-024: Get the type of an expression for type checking.
   */
  static getExpressionType(
    ctx: Parser.ExpressionContext,
    state: TranspileState,
  ): string | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (postfix) {
      return ExpressionTypeResolver.getPostfixExpressionType(postfix, state);
    }

    const ternary = ctx.ternaryExpression();
    const orExprs = ternary.orExpression();
    if (orExprs.length > 1) {
      return null;
    }
    const or = orExprs[0];
    if (or.andExpression().length > 1) {
      return "bool";
    }

    const and = or.andExpression()[0];
    if (and.equalityExpression().length > 1) {
      return "bool";
    }

    const eq = and.equalityExpression()[0];
    if (eq.relationalExpression().length > 1) {
      return "bool";
    }

    const rel = eq.relationalExpression()[0];
    if (rel.bitwiseOrExpression().length > 1) {
      return "bool";
    }

    return null;
  }

  /**
   * Resolve the C-Next integer type of an expression, including composite
   * arithmetic/bitwise expressions that `getExpressionType` leaves unresolved.
   *
   * MISRA C:2012 Rule 10.4 (enforced by MixedTypeCategoryAnalyzer) guarantees a
   * binary operator's operands share an essential type category, so a composite
   * integer expression's category is uniform; its essential width is the widest
   * integer operand. This is what lets slice-assignment serialize an arithmetic
   * source (e.g. `a + b`) MISRA Rule 10.8-clean instead of guessing a width.
   *
   * Returns null when no integer-typed variable leaf can be resolved (e.g. a
   * struct-field or function-call composite — left for a later pass).
   */
  static getIntegerExpressionType(
    ctx: Parser.ExpressionContext,
    state: TranspileState,
  ): string | null {
    const direct = ExpressionTypeResolver.getExpressionType(ctx, state);
    if (direct !== null) return direct;
    return ExpressionTypeResolver.resolveCompositeIntegerType(ctx, state);
  }

  /**
   * Combine the leaf VALUE operands of a composite expression into a single
   * C-Next type: the (uniform, per Rule 10.4) category at the widest width.
   *
   * Operands are typed by their value (Issue #1085 review) — an array index
   * (`arr[i]`), bit offset (`x[off, w]`) or struct member name is NOT a value
   * operand and must not contribute to the width. A bit-extraction contributes
   * its EXTRACTED width, not the variable's full width (typing `a + b[0, 32]`
   * as u64 would cast the composite to a wider type — MISRA Rule 10.8).
   */
  /**
   * Issue #1152: the C-Next integer type of any composite node, for callers
   * that hold an `additiveExpression`/`multiplicativeExpression` rather than a
   * whole `expression`. Same rule as getIntegerExpressionType: the (uniform,
   * per Rule 10.4) category at the widest operand's width.
   */
  static getCompositeIntegerType(
    node: ParserRuleContext,
    state: TranspileState,
  ): string | null {
    return ExpressionTypeResolver.resolveCompositeIntegerType(node, state);
  }

  /**
   * Issue #1152: the overflow behavior of a composite arithmetic expression.
   *
   * `clamp` is the default (ADR-044), and safety wins a mix: the expression
   * wraps only when EVERY integer operand was explicitly declared `wrap`. One
   * saturating operand is enough to make the result saturate, which is what
   * makes a bounds guard like `offset + length <= limit` trustworthy when
   * `offset` can saturate (see #231).
   *
   * Returns null when no operand resolves to a declared integer variable, in
   * which case the caller should leave the expression alone.
   */
  static getCompositeOverflowBehavior(
    node: ParserRuleContext,
    state: TranspileState,
  ): TOverflowBehavior | null {
    let sawInteger = false;
    for (const operand of ExpressionTypeResolver.collectOperandPostfixes(
      node,
      state,
    )) {
      const info = ExpressionTypeResolver.operandTypeInfo(operand, state);
      if (info === undefined) continue;
      if (!ExpressionTypeResolver.isIntegerType(info.baseType)) continue;
      sawInteger = true;
      if (info.overflowBehavior === "clamp") return "clamp";
    }
    return sawInteger ? "wrap" : null;
  }

  /**
   * The declared type info for a leaf operand, when it is a plain variable.
   * Anything else (array element, member chain, call result) has no declared
   * overflow behavior of its own to consult.
   */
  private static operandTypeInfo(
    postfix: Parser.PostfixExpressionContext,
    state: TranspileState,
  ): TTypeInfo | undefined {
    const primary = postfix.primaryExpression();
    if (!primary) return undefined;

    const ops = postfix.postfixOp();
    if (ops.length === 0) {
      const name = primary.getText();
      return name ? state.getVariableTypeInfo(name) : undefined;
    }

    return ExpressionTypeResolver.scopeMemberOperandTypeInfo(
      primary,
      ops,
      state,
    );
  }

  /**
   * The declared type info for a SCOPE MEMBER operand (`Counter.value`,
   * `this.value`).
   *
   * Issue #1303: this used to return undefined for anything with a postfix op,
   * so ADR-044's overflow behavior was dropped for every scope member -- with
   * no file boundary involved. `Local.value <- Local.value + 10` emitted plain
   * C arithmetic in the very file that declared `Local`, while an identical
   * statement on a plain global saturated correctly.
   *
   * A scope member is a plain global under a qualified C name, so the answer is
   * the SAME lookup the bare-identifier branch makes -- only the key differs.
   * Deriving the key here rather than giving member operands their own notion of
   * overflow behavior is what keeps this one decision: fix the fact on the
   * symbol (as #1303 does for the cross-file half) and both branches inherit it.
   *
   * Returns undefined for anything that is not a pure member chain -- a
   * subscript or a call has no declared behavior of its own to consult.
   *
   * Also undefined for a struct field, but for a different reason worth keeping
   * separate: `p.x` IS a declared integer and DOES have an ADR-044 behavior, it
   * simply has no `p__x` entry here, because a struct field is a field of a
   * value rather than a global under a qualified name. So it currently wraps --
   * tracked as #1411, and not fixable by extending the key. ADR-063 forbids
   * `__` inside an identifier, so the key this builds can never collide with a
   * real bare name.
   */
  private static scopeMemberOperandTypeInfo(
    primary: Parser.PrimaryExpressionContext,
    ops: Parser.PostfixOpContext[],
    state: TranspileState,
  ): TTypeInfo | undefined {
    const members: string[] = [];
    for (const op of ops) {
      const identifier = op.IDENTIFIER();
      if (identifier === null || op.LBRACKET() !== null) return undefined;
      members.push(identifier.getText());
    }

    // `this.value` names the CURRENT scope, which the syntax does not spell
    // out; `Counter.value` spells its own path. Both go through the one
    // encoder rather than joining with "__" by hand.
    return state.getVariableTypeInfo(
      ExpressionTypeResolver.memberChainKey(primary, members, state),
    );
  }

  /**
   * The registry key for a member chain, for each of the three spellings
   * ADR-016 gives one scope member.
   *
   * `this.value` names the CURRENT scope, which the syntax does not spell out.
   * `global.Counter.value` names the path from global scope, so the qualifier
   * contributes no component of its own. `Counter.value` spells its whole path.
   * All three reach the same C lvalue and must reach the same key -- #1303
   * originally answered only two of them, which left `global.` wrapping while
   * the other two saturated, in one function.
   *
   * Every branch goes through the one encoder rather than joining with `__` by
   * hand, per the rule that a qualified name has a single producer.
   */
  private static memberChainKey(
    primary: Parser.PrimaryExpressionContext,
    members: readonly string[],
    state: TranspileState,
  ): string {
    if (primary.THIS() !== null) {
      return ScopeUtils.qualifyPathInScope(
        [...members],
        state.currentScopePath,
      );
    }
    if (primary.GLOBAL() !== null) {
      return QualifiedCName.fromParts(members);
    }
    return QualifiedCName.fromParts([primary.getText(), ...members]);
  }

  private static resolveCompositeIntegerType(
    ctx: ParserRuleContext,
    state: TranspileState,
  ): string | null {
    return PrimitiveKindUtils.widestIntegerOf(
      ExpressionTypeResolver.collectOperandPostfixes(ctx, state).map(
        (operand) => ExpressionTypeResolver.typeOperandPostfix(operand, state),
      ),
    );
  }

  /**
   * Type one leaf operand of a composite by its VALUE type. A bit-extraction
   * `x[start, width]` yields an unsigned value of the extracted width; a simple
   * function call `name(...)` yields its declared return type; everything else
   * (variable, array element, struct field, member chain) defers to
   * getPostfixExpressionType. Returns null for an operand it cannot classify
   * (e.g. a literal, which is contextually typed).
   */
  private static typeOperandPostfix(
    postfix: Parser.PostfixExpressionContext,
    state: TranspileState,
  ): string | null {
    const extractionWidth = ExpressionTypeResolver.bitExtractionWidth(
      postfix,
      state,
    );
    if (extractionWidth !== null) {
      return ExpressionTypeResolver.unsignedTypeForBits(extractionWidth);
    }

    const direct = ExpressionTypeResolver.getPostfixExpressionType(
      postfix,
      state,
    );
    if (direct !== null) return direct;

    return ExpressionTypeResolver.callReturnType(postfix, state);
  }

  /**
   * Collect the leaf operand postfix expressions of a composite WITHOUT
   * descending into a postfix's own internals — so an array index (`arr[i]`) or
   * bit offset (`x[off, w]`) variable is never mistaken for a value operand.
   */
  private static collectOperandPostfixes(
    node: ParserRuleContext,
    state: TranspileState,
  ): Parser.PostfixExpressionContext[] {
    if (node instanceof Parser.PostfixExpressionContext) return [node];

    // Issue #1152: a ternary's VALUE is its two arms; the condition is a
    // separate expression contributing no value operand. Counting it types
    // `(val > 0) ? 1 : -1` by `val`, reporting an i32 result as u32.
    // Addressed via orExpression() rather than child indices because the
    // condition is parenthesised, so it sits at child index 1, not 0.
    const arms = ExpressionTypeResolver.ternaryValueArms(node);
    if (arms !== null) {
      return arms.flatMap((arm) =>
        ExpressionTypeResolver.collectOperandPostfixes(arm, state),
      );
    }

    // Issue #1152: `&x` (address-of, ADR-006) yields an ADDRESS, not x's
    // value, so x's type must not flow out as the expression's type --
    // `u32 addr <- &counter` with an i32 counter is not a sign conversion.
    if (ExpressionTypeResolver.isAddressOf(node)) return [];

    const operands: Parser.PostfixExpressionContext[] = [];
    for (let i = 0; i < node.getChildCount(); i += 1) {
      const child = node.getChild(i);
      if (child instanceof ParserRuleContext) {
        operands.push(
          ...ExpressionTypeResolver.collectOperandPostfixes(child, state),
        );
      }
    }
    return operands;
  }

  /**
   * True for a `&expr` address-of node (ADR-006). Detected by the leading
   * token rather than by child count, since the operand is itself a
   * unaryExpression.
   */
  private static isAddressOf(node: ParserRuleContext): boolean {
    return (
      node instanceof Parser.UnaryExpressionContext &&
      node.getChildCount() === 2 &&
      node.getChild(0)?.getText() === "&"
    );
  }

  /**
   * The two value arms of a conditional ternary, or null when this node is not
   * one. A ternaryExpression with a single orExpression child is a
   * pass-through and has no condition to exclude.
   */
  private static ternaryValueArms(
    node: ParserRuleContext,
  ): Parser.OrExpressionContext[] | null {
    if (!(node instanceof Parser.TernaryExpressionContext)) return null;
    const branches = node.orExpression();
    return branches.length === 3 ? [branches[1]!, branches[2]!] : null;
  }

  /**
   * If a postfix expression's terminal suffix is a bit-range extraction
   * `[start, width]` with a compile-time-constant width, return that width in
   * bits; else null.
   */
  private static bitExtractionWidth(
    postfix: Parser.PostfixExpressionContext,
    state: TranspileState,
  ): number | null {
    const ops = postfix.postfixOp();
    const last = ops.at(-1);
    if (last?.expression().length !== 2) return null;
    const widthExpr = last.expression()[1];

    // Resolve the width through the constant evaluator — the same path the slice
    // offset/length use — so a named const or any-base literal width
    // (`b[0, WIDTH]`, `b[0, 0b100000]`) is sized at its real width rather than
    // dropped, which would mis-type a composite slice source (Issue #1085 review).
    // #1652: this went through `state.generator?.tryEvaluateConstant`,
    // whose parameter was typed `unknown` so the production contract would stay
    // out of the parse-tree population while carrying a parse node. The member
    // it reached was a ONE-LINE delegate to exactly the call below, so the
    // laundering bought nothing. This module already names parse types -- it
    // takes a `PostfixExpressionContext` six lines up -- so calling the
    // evaluator directly is both shorter and honest.
    const evaluated = ArrayDimensionParser.parseSingleDimension(
      widthExpr,
      dimensionEvalOptions(state),
    );
    if (evaluated !== undefined) {
      return evaluated > 0 ? evaluated : null;
    }

    // Fallback for contexts with no generator (e.g. isolated unit tests): accept
    // a plain decimal/hex literal width directly.
    const widthText = widthExpr.getText();
    if (!/^(0x[0-9a-fA-F]+|\d+)$/.test(widthText)) return null;
    const value = Number.parseInt(
      widthText,
      widthText.startsWith("0x") ? 16 : 10,
    );
    return Number.isNaN(value) || value <= 0 ? null : value;
  }

  /** Smallest standard unsigned C-Next type holding `bits` bits, or null if >64. */
  private static unsignedTypeForBits(bits: number): string | null {
    if (bits <= 8) return "u8";
    if (bits <= 16) return "u16";
    if (bits <= 32) return "u32";
    if (bits <= 64) return "u64";
    return null;
  }

  /**
   * If a postfix expression is a simple function call `name(...)`, return the
   * function's declared return type — a call operand's width comes from its
   * return type, not from being ignored (Issue #1085 review).
   */
  private static callReturnType(
    postfix: Parser.PostfixExpressionContext,
    state: TranspileState,
  ): string | null {
    const ops = postfix.postfixOp();
    if (ops.length !== 1 || !ops[0].getText().startsWith("(")) return null;
    const name = postfix.primaryExpression()?.IDENTIFIER()?.getText();
    return name ? (state.getFunctionReturnType(name) ?? null) : null;
  }

  /**
   * ADR-024: Get the type of a postfix expression.
   * Tracks InternalTypeInfo (baseType + isArray) through the suffix chain
   * so that array indexing is correctly distinguished from bit indexing.
   */
  static getPostfixExpressionType(
    ctx: Parser.PostfixExpressionContext,
    state: TranspileState,
  ): string | null {
    const primary = ctx.primaryExpression();
    if (!primary) return null;

    let current = ExpressionTypeResolver.getPrimaryExpressionTypeInfo(
      primary,
      state,
    );
    if (!current) {
      // #1303: a scope member named through its scope (`Counter.value`) has no
      // type at the primary -- `Counter` is a scope, not a variable, so the
      // lookup above returns null and the whole operand used to type as
      // nothing. That silently cost the operand BOTH its width and its ADR-044
      // overflow behavior, which is why `Counter__value + 10` was emitted
      // unclamped and without the `U` suffix every other operand carries.
      //
      // `this.value` reached the registry through the sentinel branch in
      // processMemberSuffix and so was unaffected -- the two spellings of one
      // member disagreed purely on which of them the resolver could name.
      const ops = ctx.postfixOp();
      if (ops.length === 0) return null;

      const memberInfo = ExpressionTypeResolver.scopeMemberOperandTypeInfo(
        primary,
        ops,
        state,
      );
      return memberInfo ? memberInfo.baseType : null;
    }

    // #1303: `global.Scope.member`. The sentinel walk below resolves `global.X`
    // as a single variable NAME, so a scope-qualified member under `global.`
    // stopped at the scope and typed as nothing -- leaving the third spelling
    // wrapping while `this.value` and `Counter.value` saturated.
    //
    // Tried first, and only when it answers: `global.plainVar` resolves here
    // too (a one-part path is its own key), while `global.someStruct.field`
    // does not and falls through to the struct handling below, unchanged.
    if (current.baseType === ExpressionTypeResolver.GLOBAL_SENTINEL) {
      const globalOps = ctx.postfixOp();
      if (globalOps.length > 0) {
        const memberInfo = ExpressionTypeResolver.scopeMemberOperandTypeInfo(
          primary,
          globalOps,
          state,
        );
        if (memberInfo) return memberInfo.baseType;
      }
    }

    const suffixes = ctx.children?.slice(1) || [];
    for (const suffix of suffixes) {
      const result = ExpressionTypeResolver.processPostfixSuffix(
        suffix.getText(),
        current,
        state,
      );
      if (result.stop) {
        return result.type;
      }
      current = result.info;
    }

    return current.baseType;
  }

  /**
   * Process a single postfix suffix and determine the resulting type.
   * Returns { type, stop, info } where stop=true means return type immediately.
   */
  private static processPostfixSuffix(
    text: string,
    current: InternalTypeInfo,
    state: TranspileState,
  ): SuffixResult {
    if (text.startsWith(".")) {
      return ExpressionTypeResolver.processMemberSuffix(
        text.slice(1),
        current,
        state,
      );
    }

    if (text.startsWith("[") && text.endsWith("]")) {
      return ExpressionTypeResolver.processIndexingSuffix(text, current);
    }

    return { stop: false, info: current };
  }

  /**
   * Process a member access suffix (.name) and resolve the resulting type.
   * Handles global/this sentinel values and regular struct member lookups.
   */
  private static processMemberSuffix(
    memberName: string,
    current: InternalTypeInfo,
    state: TranspileState,
  ): SuffixResult {
    // Handle global.X — resolve X as a global variable name
    if (current.baseType === ExpressionTypeResolver.GLOBAL_SENTINEL) {
      return ExpressionTypeResolver.resolveRegistryLookup(memberName, state);
    }

    // Handle this.X — resolve X as a scope member variable
    if (
      current.baseType === ExpressionTypeResolver.THIS_SENTINEL &&
      state.currentScopePath
    ) {
      const scopedName = QualifiedNameGenerator.forMember(
        state.currentScopePath,
        memberName,
      );
      return ExpressionTypeResolver.resolveRegistryLookup(scopedName, state);
    }

    const memberInfo = ExpressionTypeResolver.getMemberTypeInfo(
      current.baseType,
      memberName,
      state,
    );
    if (!memberInfo) {
      return { stop: true, type: null };
    }
    return {
      stop: false,
      info: { baseType: memberInfo.baseType, isArray: memberInfo.isArray },
    };
  }

  /**
   * Look up a variable name in the type registry and return a SuffixResult.
   */
  private static resolveRegistryLookup(
    name: string,
    state: TranspileState,
  ): SuffixResult {
    const typeInfo = state.getVariableTypeInfo(name);
    if (typeInfo) {
      return {
        stop: false,
        info: { baseType: typeInfo.baseType, isArray: typeInfo.isArray },
      };
    }
    return { stop: true, type: null };
  }

  /**
   * Process array or bit indexing suffix.
   * Checks isArray BEFORE isIntegerType to correctly distinguish
   * array element access from bit indexing.
   */
  private static processIndexingSuffix(
    text: string,
    current: InternalTypeInfo,
  ): SuffixResult {
    const inner = text.slice(1, -1);

    // Range indexing: [start, width] - always bit extraction
    if (inner.includes(",")) {
      return { stop: true, type: null };
    }

    // Array access: if current type is known to be an array, index yields element
    if (current.isArray) {
      return {
        stop: false,
        info: { baseType: current.baseType, isArray: false },
      };
    }

    // Bit indexing on integer: single bit returns bool
    if (ExpressionTypeResolver.isIntegerType(current.baseType)) {
      return { stop: true, type: "bool" };
    }

    // Unknown indexing - preserve current state
    return { stop: false, info: current };
  }

  /**
   * Get full InternalTypeInfo from a primary expression (preserves isArray).
   */
  private static getPrimaryExpressionTypeInfo(
    ctx: Parser.PrimaryExpressionContext,
    state: TranspileState,
  ): InternalTypeInfo | null {
    const id = ctx.IDENTIFIER();
    if (id) {
      const name = id.getText();
      const scopedName = state.resolveIdentifier(name);
      const typeInfo = state.getVariableTypeInfo(scopedName);
      if (typeInfo) {
        return { baseType: typeInfo.baseType, isArray: typeInfo.isArray };
      }
      return null;
    }

    // Handle global.X and this.X — these are scope qualifiers, not types.
    // The actual variable name is the first .suffix after the keyword.
    // Return a sentinel so getPostfixExpressionType knows to consume one suffix.
    if (ctx.GLOBAL()) {
      return {
        baseType: ExpressionTypeResolver.GLOBAL_SENTINEL,
        isArray: false,
      };
    }
    if (ctx.THIS()) {
      return { baseType: ExpressionTypeResolver.THIS_SENTINEL, isArray: false };
    }

    const literal = ctx.literal();
    if (literal) {
      const litType = ExpressionTypeResolver.getLiteralType(literal);
      return litType ? { baseType: litType, isArray: false } : null;
    }

    const expr = ctx.expression();
    if (expr) {
      const exprType = ExpressionTypeResolver.getExpressionType(expr, state);
      return exprType ? { baseType: exprType, isArray: false } : null;
    }

    const cast = ctx.castExpression();
    if (cast) {
      return { baseType: cast.type().getText(), isArray: false };
    }

    return null;
  }

  /**
   * ADR-024: Get the type of a primary expression (public API, returns baseType only).
   */
  static getPrimaryExpressionType(
    ctx: Parser.PrimaryExpressionContext,
    state: TranspileState,
  ): string | null {
    const info = ExpressionTypeResolver.getPrimaryExpressionTypeInfo(
      ctx,
      state,
    );
    return info?.baseType ?? null;
  }

  /**
   * ADR-024: Get the type of a unary expression (for cast validation).
   */
  static getUnaryExpressionType(
    ctx: Parser.UnaryExpressionContext,
    state: TranspileState,
  ): string | null {
    const postfix = ctx.postfixExpression();
    if (postfix) {
      return ExpressionTypeResolver.getPostfixExpressionType(postfix, state);
    }

    const unary = ctx.unaryExpression();
    if (unary) {
      return ExpressionTypeResolver.getUnaryExpressionType(unary, state);
    }

    return null;
  }

  /**
   * Get type info for a struct member field.
   * Issue #831: SymbolTable is the single source of truth for struct fields.
   */
  static getMemberTypeInfo(
    structType: string,
    memberName: string,
    state: TranspileState,
  ): { isArray: boolean; baseType: string } | undefined {
    const fieldInfo = state.symbolTable?.getStructFieldInfo(
      structType,
      memberName,
    );
    if (!fieldInfo) return undefined;

    return {
      isArray:
        fieldInfo.arrayDimensions !== undefined &&
        fieldInfo.arrayDimensions.length > 0,
      baseType: fieldInfo.type,
    };
  }
}

export default ExpressionTypeResolver;
