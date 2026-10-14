/**
 * ADR-029 callback typing: E0879, E0880.
 *
 * #1322. Two throws in `TypeValidator`, reached from `AssignmentValidator`
 * for exactly one target shape -- `h.down <- f`, a variable's direct field --
 * and reported as `1:0`. A function is a type under ADR-029, so a function
 * NAMED as a value must fit the slot it is placed in: its signature must
 * match the slot's type (E0879), and a function that is itself used as a
 * field type is nominally distinct from every other (E0880). A variable of
 * callback type placed in a slot is not named here: it already carries its
 * type, and codegen never asked; stated below.
 *
 * ## Four slots, one rule
 *
 * The rule is about where a function name lands, and codegen checked one of
 * the four places it can:
 *
 * - an assignment, `h.down <- f` -- checked, for a direct field only;
 *   `this.h.down`, `a.b.down` and a callback-typed variable never reached it
 * - a declaration's initializer, `onDown cb <- f`
 * - a struct initializer's field, `{ down: f }`
 * - a call's argument, `register(f)` -- the case ADR-029's own example marks
 *   `COMPILE ERROR`
 *
 * All four are decided here, from the slot's declared type through the same
 * lookup (`FunctionReference`), at the value's own position.
 *
 * ## What "used as a field type" reads
 *
 * Codegen's nominal rule read a map filled while emitting struct
 * declarations, so it held the structs emitted so far in the CURRENT file:
 * a struct declared below the assignment, in an enclosing scope, or in an
 * include did not count. The per-file symbol view holds every struct this
 * file can see, and that is what a type identity is.
 *
 * ## Stated, not closed
 *
 * A function used only as a PARAMETER type (`void reg(onUp cb)`) is not a
 * nominal type here, as it was not in codegen; widening that is a language
 * decision (ADR-029 §Nominal Typing names struct fields). Array dimensions of
 * parameters are not compared, as they were not.
 */

import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type IAssignmentSyntax from "../../types/syntax/IAssignmentSyntax";
import type TExpression from "../../types/syntax/TExpression";
import DeclarationParts from "../../utils/DeclarationParts";
import ExpressionNodes from "../../utils/ExpressionNodes";
import StatementNodes from "../../utils/StatementNodes";
import OperandTyper from "../../utils/OperandTyper";
import type IVariableDeclarationSyntax from "../../types/syntax/IVariableDeclarationSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import IFunctionSymbol from "../../types/symbols/IFunctionSymbol";
import TypeResolver from "../../utils/TypeResolver";
import FunctionReference from "./helpers/FunctionReference";
import ValuePositions from "./helpers/ValuePositions";
import ICallbackAssignmentError from "./types/ICallbackAssignmentError";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IValuePosition from "../../types/IValuePosition";
import SourceOrder from "../../utils/SourceOrder";

/** The slot a value fills, for E0880's wording */
interface ISlot {
  readonly verb: "assign" | "pass";
  readonly description: string;
}

class CallbackAssignmentCheck {
  private readonly found: ICallbackAssignmentError[] = [];
  private fieldTypes: ReadonlySet<string> | null = null;

  public constructor(
    private readonly context: IAnalysisContext,
    private readonly positions: ReadonlyMap<TExpression, IValuePosition>,
  ) {}

  public errors(): ICallbackAssignmentError[] {
    return this.found;
  }

  /** An assignment statement, or a `for` loop's init or update */
  public checkSite(site: IAssignmentSyntax): void {
    this.check(
      OperandTyper.typeOfTarget(site.target, this.context)?.typeName ?? null,
      site.value,
      {
        verb: "assign",
        description: CallbackAssignmentCheck.describeTarget(site.target),
      },
    );
  }

  public checkDeclaration(declaration: IVariableDeclarationSyntax): void {
    if (!declaration.initializer) return;
    this.check(declaration.type.text, declaration.initializer, {
      verb: "assign",
      description: `callback variable '${declaration.name}'`,
    });
  }

  /** A struct initializer's fields, and the arguments of a chain's first call */
  public checkExpression(expr: TExpression): void {
    if (expr.kind === "structInitializer") {
      for (const field of expr.fields) {
        this.check(
          ValuePositions.at(this.positions, field.value).typeText,
          field.value,
          { verb: "assign", description: `callback field '${field.name}'` },
        );
      }
      return;
    }
    if (expr.kind !== "postfix") return;
    const call = expr.ops.find((op) => op.kind === "call");
    if (call?.kind !== "call") return;
    const callee = FunctionReference.ofCallChain(
      expr,
      OperandTyper.scopePathAt(expr.span, this.context),
      this.context,
    );
    if (callee === null) return;
    call.arguments.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined) return;
      this.check(TypeResolver.getTypeName(param.type), arg, {
        verb: "pass",
        description: `parameter '${param.name}' of function '${callee.name}'`,
      });
    });
  }

  /** `this.` and `global.` name where the target is, not a field of it */
  private static describeTarget(target: TExpression): string {
    const ops =
      target.kind !== "postfix"
        ? []
        : target.primary.kind === "root"
          ? target.ops.slice(1)
          : target.ops;
    const last = ops.at(-1);
    if (last === undefined) {
      return `callback variable '${target.written}'`;
    }
    if (last.kind === "member") {
      return `callback field '${last.name}'`;
    }
    return `callback '${target.written}'`;
  }

  private check(
    slotTypeText: string | null,
    value: TExpression,
    slot: ISlot,
  ): void {
    if (slotTypeText === null) return;
    const scopePath = OperandTyper.scopePathAt(value.span, this.context);
    const expected = FunctionReference.ofTypeText(
      slotTypeText,
      scopePath,
      this.context,
    );
    if (expected === null) return;
    const actual = FunctionReference.ofValue(value, scopePath, this.context);
    if (actual === null) return;

    const valueText = value.written;
    if (!CallbackAssignmentCheck.signaturesMatch(expected, actual)) {
      this.report(
        value,
        "E0879",
        `Function '${valueText}' signature does not match callback type '${slotTypeText}'`,
        "A callback must match its type's signature exactly: return type, parameter count, and each parameter's type, const-ness and array-ness (ADR-029).",
      );
      return;
    }

    const actualName = FunctionReference.cNameOf(actual);
    if (
      actualName !== FunctionReference.cNameOf(expected) &&
      this.isFieldType(actualName)
    ) {
      const verb =
        slot.verb === "assign"
          ? `Cannot assign '${valueText}' to`
          : `Cannot pass '${valueText}' as`;
      this.report(
        value,
        "E0880",
        `${verb} ${slot.description} (expected ${slotTypeText} type, got ${valueText} type - nominal typing)`,
        "A function used as a struct field's type is its own callback type; only a function that is not itself a type may stand in for another (ADR-029).",
      );
    }
  }

  private isFieldType(cName: string): boolean {
    this.fieldTypes ??= this.collectFieldTypes();
    return this.fieldTypes.has(cName);
  }

  private collectFieldTypes(): ReadonlySet<string> {
    return new Set([
      ...this.fieldTypesInFileView(),
      ...this.fieldTypesInProgram(),
    ]);
  }

  /** Field types of the structs this file declares. */
  private fieldTypesInFileView(): string[] {
    const types: string[] = [];
    for (const fields of this.context.symbols.structFields.values()) {
      types.push(...fields.values());
    }
    return types;
  }

  /** Field types of every struct the program declares, in any file. */
  private fieldTypesInProgram(): string[] {
    const program = this.context.program;
    const types: string[] = [];
    for (const sourceFile of program.sourceFiles()) {
      for (const symbol of program.symbolsInFile(sourceFile)) {
        if (symbol.kind !== "struct") continue;
        for (const field of symbol.fields.values()) {
          types.push(TypeResolver.getTypeName(field.type));
        }
      }
    }
    return types;
  }

  private static signaturesMatch(
    a: IFunctionSymbol,
    b: IFunctionSymbol,
  ): boolean {
    if (
      TypeResolver.getTypeName(a.returnType) !==
      TypeResolver.getTypeName(b.returnType)
    ) {
      return false;
    }
    if (a.parameters.length !== b.parameters.length) return false;
    return a.parameters.every((pa, i) => {
      const pb = b.parameters[i];
      return (
        TypeResolver.getTypeName(pa.type) ===
          TypeResolver.getTypeName(pb.type) &&
        pa.isConst === pb.isConst &&
        pa.isArray === pb.isArray
      );
    });
  }

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

class CallbackAssignmentAnalyzer {
  constructor(private readonly context: IAnalysisContext) {}

  /** #1991: reads 1.2's syntax, not the parse tree */
  public analyze(
    program: IProgramSyntax,
    positions: ReadonlyMap<TExpression, IValuePosition>,
  ): ICallbackAssignmentError[] {
    const check = new CallbackAssignmentCheck(this.context, positions);
    const visit = (declaration: TDeclarationSyntax): void => {
      if (declaration.kind === "scope") {
        for (const member of declaration.members) visit(member.declaration);
        return;
      }
      if (declaration.kind === "variableDeclaration") {
        check.checkDeclaration(declaration);
      }
      for (const statement of StatementNodes.in(declaration)) {
        if (statement.kind === "variableDeclaration") {
          check.checkDeclaration(statement);
        }
      }
      for (const site of StatementNodes.assignments(declaration)) {
        check.checkSite(site);
      }
    };
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

export default CallbackAssignmentAnalyzer;
