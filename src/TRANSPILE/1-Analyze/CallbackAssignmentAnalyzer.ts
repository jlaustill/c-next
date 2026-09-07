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

import { ParserRuleContext, ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import IFunctionSymbol from "../../transpiler/types/symbols/IFunctionSymbol";
import ParserUtils from "../../utils/ParserUtils";
import TypeResolver from "../../utils/TypeResolver";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import FunctionReference from "./helpers/FunctionReference";
import StructInitializerType from "./helpers/StructInitializerType";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import ICallbackAssignmentError from "./types/ICallbackAssignmentError";

/** Where a function name landed, for the message. */
interface ISlot {
  readonly verb: "assign" | "pass";
  readonly description: string;
}

class CallbackAssignmentListener extends CNextListener {
  private readonly found: ICallbackAssignmentError[] = [];
  private fieldTypes: ReadonlySet<string> | null = null;

  public constructor(
    private readonly scopes: ScopeFrameResolver,
    private readonly operands: OperandTypeResolver,
  ) {
    super();
  }

  public errors(): ICallbackAssignmentError[] {
    return this.found;
  }

  /** `target <- f`, any target shape. */
  override enterAssignmentStatement = (
    ctx: Parser.AssignmentStatementContext,
  ): void => {
    const target = ctx.assignmentTarget();
    const frame = this.scopes.frameFor(ctx);
    const ops = target.postfixTargetOp();
    const last = ops[ops.length - 1];
    const description =
      last === undefined
        ? `callback variable '${target.getText()}'`
        : last.DOT() !== null
          ? `callback field '${last.IDENTIFIER()?.getText()}'`
          : `callback '${target.getText()}'`;
    this.check(
      this.operands.typeOfAssignmentTarget(target, frame),
      ctx.expression(),
      { verb: "assign", description },
    );
  };

  /** `onDown cb <- f`, in a function, a scope, at file scope. */
  override enterVariableDeclaration = (
    ctx: Parser.VariableDeclarationContext,
  ): void => {
    this.checkDeclaration(ctx.type(), ctx.IDENTIFIER(), ctx.expression());
  };

  /** `for (onDown cb <- f; ...)`. */
  override enterForVarDecl = (ctx: Parser.ForVarDeclContext): void => {
    this.checkDeclaration(ctx.type(), ctx.IDENTIFIER(), ctx.expression());
  };

  /** `{ down: f }`, wherever the initializer's struct is established. */
  override enterFieldInitializer = (
    ctx: Parser.FieldInitializerContext,
  ): void => {
    const init = ctx.parent?.parent;
    if (!(init instanceof Parser.StructInitializerContext)) return;
    const frame = this.scopes.frameFor(ctx);
    const structName = StructInitializerType.of(init, frame, this.operands);
    if (structName === null) return;
    const fieldName = ctx.IDENTIFIER().getText();
    this.check(
      CodeGenState.symbols?.structFields.get(structName)?.get(fieldName) ??
        null,
      ctx.expression(),
      { verb: "assign", description: `callback field '${fieldName}'` },
    );
  };

  /** `register(f)`: each argument against its parameter's type. */
  override enterPostfixExpression = (
    ctx: Parser.PostfixExpressionContext,
  ): void => {
    const call = ctx.postfixOp().find((op) => op.LPAREN() !== null);
    if (call === undefined) return;
    const frame = this.scopes.frameFor(ctx);
    const callee = FunctionReference.ofCall(ctx, frame.scopePath);
    if (callee === null) return;
    const args = call.argumentList()?.expression() ?? [];
    args.forEach((arg, index) => {
      const param = callee.parameters[index];
      if (param === undefined) return;
      this.check(TypeResolver.getTypeName(param.type), arg, {
        verb: "pass",
        description: `parameter '${param.name}' of function '${callee.name}'`,
      });
    });
  };

  private checkDeclaration(
    typeCtx: Parser.TypeContext | null,
    identifier: { getText(): string } | null,
    initializer: Parser.ExpressionContext | null,
  ): void {
    if (!typeCtx || !identifier || !initializer) return;
    this.check(typeCtx.getText(), initializer, {
      verb: "assign",
      description: `callback variable '${identifier.getText()}'`,
    });
  }

  /**
   * The rule. Silent unless the slot's type is a function AND the value
   * names one; then the signatures must match, and a value that is itself a
   * field type must be the slot's own.
   */
  private check(
    slotTypeText: string | null,
    value: Parser.ExpressionContext,
    slot: ISlot,
  ): void {
    if (slotTypeText === null) return;
    const scopePath = this.scopes.frameFor(value).scopePath;
    const expected = FunctionReference.ofTypeText(slotTypeText, scopePath);
    if (expected === null) return;
    const actual = FunctionReference.ofValue(value, scopePath);
    if (actual === null) return;

    const valueText = value.getText();
    if (!CallbackAssignmentListener.signaturesMatch(expected, actual)) {
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

  /**
   * Whether any struct in the program declares a field of this type -- what
   * makes a function a nominal callback type rather than a plain function.
   *
   * Asked of the PROGRAM, not of the per-file view, and that is the decision.
   * ADR-029 says "type identity is the function name": a function IS a type
   * because some struct declares a field of it, which is a property of the
   * program and not of who imported whom. Reading a per-file set would make
   * the same function nominal in one file and plain in another, so the same
   * assignment would be rejected or accepted depending on the include graph.
   *
   * This is deliberately the opposite choice from #1398's VISIBILITY question
   * (E0427), where the run-wide table is wrong because a sibling that was
   * never included must not resolve. Here the function is visible either way
   * -- it was named in the source -- and the only question is what its type
   * identity is.
   *
   * Codegen asked `CodeGenState.callbackFieldTypes`, which holds the structs
   * emitted SO FAR in the current file, so a struct declared below the
   * assignment, in an enclosing scope, or in an include did not count.
   */
  private isFieldType(cName: string): boolean {
    this.fieldTypes ??= CallbackAssignmentListener.collectFieldTypes();
    return this.fieldTypes.has(cName);
  }

  private static collectFieldTypes(): ReadonlySet<string> {
    const types = new Set<string>();
    for (const fields of CodeGenState.symbols?.structFields.values() ?? []) {
      for (const type of fields.values()) types.add(type);
    }
    const program = CodeGenState.program;
    if (program) {
      for (const sourceFile of program.sourceFiles()) {
        for (const symbol of program.symbolsInFile(sourceFile)) {
          if (symbol.kind !== "struct") continue;
          for (const field of symbol.fields.values()) {
            types.add(TypeResolver.getTypeName(field.type));
          }
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
    at: ParserRuleContext,
    code: string,
    message: string,
    helpText: string,
  ): void {
    const { line, column } = ParserUtils.getPosition(at);
    this.found.push({ code, line, column, message, helpText });
  }
}

class CallbackAssignmentAnalyzer {
  public analyze(tree: Parser.ProgramContext): ICallbackAssignmentError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);
    const scopes = new ScopeFrameResolver(declarations);
    const listener = new CallbackAssignmentListener(
      scopes,
      new OperandTypeResolver(scopes),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default CallbackAssignmentAnalyzer;
