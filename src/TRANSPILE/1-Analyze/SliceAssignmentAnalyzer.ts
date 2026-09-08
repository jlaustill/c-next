/**
 * ADR-052 slice assignment: E0858-E0861.
 *
 * #1322. This replaces TWELVE throws in `ArrayHandlers`, every one of which
 * already knew its line and spent it on a message prefix:
 *
 *     throw new Error(`${line}:0 Error: Slice assignment out of bounds: ...`)
 *
 * The `${line}:0` was read back out of the message by `parseErrorLocation`, so
 * the diagnostic reached the user with a real line and a hard-coded column 0.
 * That is what makes this tier A: the position is not missing, it is being
 * smuggled through the one channel a throw has. Relocating removes the hack
 * rather than adding a position.
 *
 * ## What 2.1 has to recompute, and why that is not a duplicate decision
 *
 * These checks sit inside the code that EMITS the unrolled copy, and they share
 * its arithmetic: the element stride, the element count, the buffer capacity.
 * Moving the checks means computing those here as well.
 *
 * That is a shared FACT, not a duplicated decision. 2.1 decides "reject"; 2.3
 * decides "emit these writes". What matters is that they cannot disagree
 * silently, so every check relocated here leaves an assertion behind at the
 * emission site: if a slice reaches codegen that this pass would have rejected,
 * it fails loudly as an internal invariant instead of emitting wrong C.
 *
 * ## Compile-time constants in pass 2.1
 *
 * The offset and length must fold at compile time. `CodeGenState.constValues`
 * is the codegen-time map -- filled during generation and cleared by `reset()`,
 * so an analyzer reading it sees the PREVIOUS file's consts (#1399). The
 * order-independent source is `Program`, which 1.4 Resolve settles and which
 * `CodeGenState.getCNextConstValue` already exposes for exactly this;
 * `DivisionByZeroAnalyzer` reads it the same way.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import TYPE_WIDTH from "../../transpiler/constants/TYPE_WIDTH";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import IDeclaredVar from "./types/IDeclaredVar";
import IScopeFrame from "./types/IScopeFrame";
import ISliceAssignmentError from "./types/ISliceAssignmentError";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ConstantExpression from "./helpers/ConstantExpression";

/** `string<N>` holds N characters plus the terminator. */
const STRING_TERMINATOR_BYTES = 1;

/** What a slice destination writes, one element at a time. */
interface IDestination {
  readonly elementBytes: number;
  readonly capacity: number;
}

class SliceAssignmentListener extends CNextListener {
  private readonly found: ISliceAssignmentError[] = [];
  private readonly types: OperandTypeResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
  }

  public errors(): ISliceAssignmentError[] {
    return this.found;
  }

  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    // A compound operator on any two-subscript target is E0857's, reported
    // before this step runs. Checking the slice as well would give one mistake
    // two diagnostics.
    if (!ctx.assignmentOperator().ASSIGN()) return;

    const target = ctx.assignmentTarget();
    const ops = target.postfixTargetOp();
    if (ops.length !== 1) return;

    const subscripts = ops[0].expression();
    if (subscripts.length !== 2) return;

    const frame = this.scopes.frameFor(ctx);
    const name = target.IDENTIFIER().getText();
    const declared = this.declarationOf(name, frame);
    // Not established, or a SCALAR base -- on a scalar, two subscripts are a
    // bit RANGE (ADR-007), which is a different construct with its own rules.
    if (declared === null) return;
    if (declared.dimensions.length === 0 && declared.stringCapacity === null) {
      return;
    }

    this.check(ctx, name, declared, subscripts, frame);
  };

  /**
   * What a name's declaration says, from this file's frames or, failing that,
   * from the run-wide view.
   *
   * The lexical frames hold only THIS file, so a buffer declared in an included
   * file resolved to nothing and the slice was passed over -- and with the
   * codegen checks now assertions, that surfaced as an internal error naming
   * the guarantee rather than as a diagnostic. Probed, not reasoned about.
   *
   * The two-source shape is `ScopeFrameResolver.typeOfName`'s, for its reason:
   * lexical FIRST, so a local declaration still shadows an imported one, with
   * the run-wide view answering only what the frames cannot. This is a question
   * about a buffer's SHAPE rather than about visibility, which is the case
   * #1220 established the run-wide fallback is right for.
   */
  private declarationOf(name: string, frame: IScopeFrame): IDeclaredVar | null {
    const lexical = this.scopes.declarationOfNameLexical(name, frame);
    if (lexical !== null) return lexical;

    const info = CodeGenState.getVariableTypeInfo(name);
    if (info === undefined) return null;
    return {
      typeText: info.baseType,
      dimensions: info.arrayDimensions ?? [],
      stringCapacity: info.isString ? (info.stringCapacity ?? null) : null,
      isConst: info.isConst,
    };
  }

  private check(
    ctx: Parser.AssignmentStatementContext,
    name: string,
    declared: IDeclaredVar,
    subscripts: readonly Parser.ExpressionContext[],
    frame: IScopeFrame,
  ): void {
    const destination = this.destinationOf(name, declared, subscripts[0]);
    if (destination === null) return;

    const offset = this.constantOf(subscripts[0]);
    if (offset === undefined) {
      this.report(
        subscripts[0],
        "E0859",
        `Slice assignment offset must be a compile-time constant for '${name}'`,
        "A runtime offset cannot be bounds-checked at compile time. Use a literal or a `const`.",
      );
      return;
    }

    const length = this.constantOf(subscripts[1]);
    if (length === undefined) {
      this.report(
        subscripts[1],
        "E0859",
        `Slice assignment length must be a compile-time constant for '${name}'`,
        "A runtime length cannot be bounds-checked at compile time. Use a literal or a `const`.",
      );
      return;
    }

    if (offset < 0) {
      this.report(
        subscripts[0],
        "E0860",
        `Slice assignment offset cannot be negative: ${offset}`,
        "An offset is an element index into the buffer, counted from zero.",
      );
      return;
    }

    if (length <= 0) {
      this.report(
        subscripts[1],
        "E0860",
        `Slice assignment length must be positive: ${length}`,
        "A slice writes at least one byte; a zero-length slice writes nothing and is almost certainly a mistake.",
      );
      return;
    }

    if (length % destination.elementBytes !== 0) {
      this.report(
        subscripts[1],
        "E0860",
        `Slice assignment length (${length}) must be a multiple of the element size (${destination.elementBytes} bytes) for '${name}'`,
        "The length is a BYTE count and the copy writes whole elements, so it has to divide evenly.",
      );
      return;
    }

    const elementCount = length / destination.elementBytes;
    if (offset + elementCount > destination.capacity) {
      this.report(
        subscripts[0],
        "E0860",
        `Slice assignment out of bounds: offset(${offset}) + ${elementCount} element(s) = ${offset + elementCount} exceeds buffer capacity(${destination.capacity}) for '${name}'`,
        "The offset is an element index and the capacity an element count, so the span is compared in elements, not bytes.",
      );
      return;
    }

    this.checkSource(ctx, name, length, frame);
  }

  /** The destination's element stride and capacity, or null if unestablished. */
  private destinationOf(
    name: string,
    declared: IDeclaredVar,
    at: Parser.ExpressionContext,
  ): IDestination | null {
    if (declared.stringCapacity !== null) {
      // A string buffer is `char[N + 1]`; the terminator is part of it.
      return {
        elementBytes: 1,
        capacity: declared.stringCapacity + STRING_TERMINATOR_BYTES,
      };
    }

    if (declared.dimensions.length > 1) {
      this.report(
        at,
        "E0858",
        `Slice assignment is only valid on one-dimensional arrays; '${name}' has ${declared.dimensions.length} dimensions`,
        `Index the outer dimensions first, e.g. ${name}[index][offset, length].`,
      );
      return null;
    }

    const element = SliceAssignmentListener.elementTypeOf(declared.typeText);
    const bits = element === null ? undefined : TYPE_WIDTH[element];
    if (element === null || bits === undefined || element.startsWith("f")) {
      // A float or a type this pass cannot size cannot be written as integer
      // byte chunks -- that needs type punning, which ADR-052 does not do.
      // `bool` is excluded for the same reason even though it has a width.
      if (element !== null && !TYPE_WIDTH[element]) return null;
      this.report(
        at,
        "E0858",
        `Slice assignment is not supported for element type '${element ?? declared.typeText}' of '${name}'`,
        "Only integer and string buffers can be sliced; a float or bool element would need type punning.",
      );
      return null;
    }
    if (element === "bool") {
      this.report(
        at,
        "E0858",
        `Slice assignment is not supported for element type 'bool' of '${name}'`,
        "Only integer and string buffers can be sliced.",
      );
      return null;
    }

    const capacity = declared.dimensions[0];
    if (typeof capacity !== "number") {
      // A dimension this pass cannot fold -- a C macro, or a const it cannot
      // see. Reporting a bounds error would mean guessing at the bound.
      this.report(
        at,
        "E0858",
        `Cannot determine the size of '${name}' at compile time`,
        "A sliced buffer needs a dimension that folds at compile time, so the span can be checked.",
      );
      return null;
    }

    return { elementBytes: bits / 8, capacity };
  }

  /** The source value has to fit the slice it is written into. */
  private checkSource(
    ctx: Parser.AssignmentStatementContext,
    name: string,
    length: number,
    frame: IScopeFrame,
  ): void {
    const value = ctx.expression();
    if (!value) return;

    const literal = this.constantOf(value);
    if (literal !== undefined) {
      // ADR-052 types the literal to the slice's byte width, so it has to be
      // representable there either unsigned or as two's complement. Guarding
      // only the unsigned upper bound let a negative literal of any magnitude
      // through, silently truncated (#1085 review).
      const truncated = BigInt(Math.trunc(literal));
      if (
        truncated >= 1n << BigInt(8 * length) ||
        truncated < -(1n << BigInt(8 * length - 1))
      ) {
        this.report(
          value,
          "E0861",
          `Slice assignment literal value (${literal}) does not fit in the ${length}-byte slice for '${name}'`,
          "Narrow the value, or widen the slice.",
        );
      }
      return;
    }

    const sourceType = this.types.typeOfOperand(value, frame);
    if (sourceType === null) return;

    const bits = TYPE_WIDTH[sourceType];
    if (
      bits === undefined ||
      sourceType.startsWith("f") ||
      sourceType === "bool"
    ) {
      this.report(
        value,
        "E0861",
        `Slice assignment source must be an integer value; the value assigned to '${name}' has type '${sourceType}'`,
        "A slice copies the source's bytes, so the source has to be an integer.",
      );
      return;
    }

    if (length > bits / 8) {
      this.report(
        value,
        "E0861",
        `Slice assignment length (${length} bytes) exceeds the source value width (${bits / 8} bytes) for '${name}'`,
        "Copying more bytes than the source holds would shift past its width, which is undefined behavior.",
      );
    }
  }

  /**
   * The element type of a declared array type text: `u8[32]` -> `u8`.
   * Null when the text names no element type this pass can read.
   */
  private static elementTypeOf(typeText: string): string | null {
    const open = typeText.indexOf("[");
    const base = (open === -1 ? typeText : typeText.slice(0, open)).trim();
    return base.length > 0 ? base : null;
  }

  /**
   * A compile-time constant, or undefined.
   *
   * `ArrayDimensionParser` is pure and takes its lookups as options, so it is
   * bound here to the ORDER-INDEPENDENT const source rather than to
   * `CodeGenState.constValues`, which does not exist yet when this pass runs.
   */
  /**
   * #1322 review: this asked the flat const map, whose bare key every scope
   * declaring that name shares. A slice bound named by a scoped const was
   * measured against whichever scope was derived last. `ConstantExpression`
   * is the one evaluator now, and it asks from the enclosing scope.
   */
  private constantOf(expr: Parser.ExpressionContext): number | undefined {
    return (
      ConstantExpression.valueIn(expr, this.scopes.frameFor(expr).scopePath) ??
      undefined
    );
  }

  private report(
    at: Parser.ExpressionContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class SliceAssignmentAnalyzer {
  public analyze(tree: Parser.ProgramContext): ISliceAssignmentError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new SliceAssignmentListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default SliceAssignmentAnalyzer;
