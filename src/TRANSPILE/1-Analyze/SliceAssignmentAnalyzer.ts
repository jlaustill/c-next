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
 * The offset and length must fold at compile time. They fold with the const
 * values visible where they are written, which 1.4 Resolve settles before any
 * pass reads them (`ConstantExpression.valueAt`). A codegen-time map filled
 * during generation saw the PREVIOUS file's consts (#1399); render no longer
 * keeps one (#1664 box 7).
 */

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import { ParseTreeWalker } from "antlr4ng";

import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import TYPE_WIDTH from "../../types/TYPE_WIDTH";
import ParserUtils from "../../utils/ParserUtils";
import OperandTyper from "../../utils/OperandTyper";
import AssignmentSiteListener from "./AssignmentSiteListener";
import ISliceAssignmentError from "./types/ISliceAssignmentError";
import ConstantExpression from "./helpers/ConstantExpression";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IOperandType from "../../types/IOperandType";
import type TAssignmentSite from "../../types/TAssignmentSite";

/** `string<N>` holds N characters plus the terminator. */
const STRING_TERMINATOR_BYTES = 1;

/** What a slice destination writes, one element at a time. */
interface IDestination {
  readonly elementBytes: number;
  readonly capacity: number;
}

class SliceAssignmentListener {
  private readonly found: ISliceAssignmentError[] = [];

  public constructor(private readonly context: IAnalysisContext) {}

  public errors(): ISliceAssignmentError[] {
    return this.found;
  }

  /** `buf[offset, length] <- value`, in a statement or a `for` header */
  public checkSite(site: TAssignmentSite): void {
    // A compound operator on any two-subscript target is E0857's, reported
    // before this step runs. Checking the slice as well would give one mistake
    // two diagnostics.
    if (!site.assignmentOperator().ASSIGN()) return;

    const target = site.assignmentTarget();
    const ops = target.postfixTargetOp();
    if (ops.length !== 1) return;

    const subscripts = ops[0].expression();
    if (subscripts.length !== 2) return;

    const name = target.IDENTIFIER()?.getText();
    // The buffer as its declaration states it, bound by the one binder --
    // this file's locals first, then scope members, globals and includes
    // (#1668), so a buffer declared in an included file is found
    const declared = OperandTyper.chainOf(
      SyntaxLowering.assignmentTarget(target),
      this.context,
    ).steps[0]?.before;
    // Not established, or a SCALAR base -- on a scalar, two subscripts are a
    // bit RANGE (ADR-007), which is a different construct with its own rules.
    if (name === undefined || !declared) return;
    if (declared.dimensions.length === 0 && declared.stringCapacity === null) {
      return;
    }

    this.check(site, name, declared, subscripts);
  }

  private check(
    site: TAssignmentSite,
    name: string,
    declared: IOperandType,
    subscripts: readonly Parser.ExpressionContext[],
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

    this.checkSource(site, name, length);
  }

  /** The destination's element stride and capacity, or null if unestablished. */
  private destinationOf(
    name: string,
    declared: IOperandType,
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

    const element = declared.typeName;
    const bits = element === null ? undefined : TYPE_WIDTH[element];
    if (element === null || bits === undefined || element.startsWith("f")) {
      // A float or a type this pass cannot size cannot be written as integer
      // byte chunks -- that needs type punning, which ADR-052 does not do.
      // `bool` is excluded for the same reason even though it has a width.
      if (element !== null && !TYPE_WIDTH[element]) return null;
      this.report(
        at,
        "E0858",
        `Slice assignment is not supported for element type '${element ?? "unknown"}' of '${name}'`,
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
    if (typeof capacity !== "number" || capacity <= 0) {
      // A dimension this pass cannot fold -- a C macro, or a size that did not
      // settle, which UNRESOLVED_DIMENSION records as 0 (#1175). Reporting a
      // bounds error would mean guessing at the bound.
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
    site: TAssignmentSite,
    name: string,
    length: number,
  ): void {
    const value = site.expression();

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

    // An integer composite's type is the typer's (`CompositeType`); null
    // when it cannot name one (a mixed composite, an unknown-width C integer)
    const sourceType =
      OperandTyper.typeOf(SyntaxLowering.expressionNode(value), this.context)
        ?.typeName ?? null;
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
   * A compile-time constant, or undefined.
   *
   * #1322 review: this asked the flat const map, whose bare key every scope
   * declaring that name shares. A slice bound named by a scoped const was
   * measured against whichever scope was derived last. `ConstantExpression`
   * is the one evaluator now, and it asks from where the bound is written.
   */
  private constantOf(expr: Parser.ExpressionContext): number | undefined {
    return ConstantExpression.valueAt(expr, this.context) ?? undefined;
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
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): ISliceAssignmentError[] {
    const listener = new SliceAssignmentListener(this.context);
    ParseTreeWalker.DEFAULT.walk(
      new AssignmentSiteListener((site) => listener.checkSite(site)),
      tree,
    );
    return listener.errors();
  }
}

export default SliceAssignmentAnalyzer;
