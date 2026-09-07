/**
 * ADR-025 switch statements: E0711-E0714.
 *
 * #1322. Five throws in `TypeValidator.validateSwitchStatement`, every one of
 * them reaching the user as `1:0` -- seven fixtures under `tests/switch/` all
 * assert that position, which is the defect this card exists to remove.
 *
 * ## Every one of these is a whole-statement question
 *
 * Unlike most relocations, nothing here needs a type the analyzers could not
 * already see. `knownEnums` and `enumMembers` are on the per-file symbol view,
 * populated before `runAnalyzers`; the clause count, the case labels and the
 * `default(N)` count are all in the parse tree. The checks lived in codegen
 * because that is where the switch was being WRITTEN, not because that is where
 * the facts were.
 *
 * ## Why the coverage rules are one code and not two
 *
 * `switch covers 3 of 4` and `Non-exhaustive switch ... missing 1` were two
 * throws, and they are the same decision: the clauses must account for the
 * enum's variants exactly. What differs is only whether a `default(N)` is
 * present to contribute a count. Two codes would make a reader think the fix
 * differs; it does not.
 */

import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../transpiler/logic/parser/grammar/CNextListener";
import * as Parser from "../../transpiler/logic/parser/grammar/CNextParser";
import CodeGenState from "../../transpiler/state/CodeGenState";
import ParserUtils from "../../utils/ParserUtils";
import DeclarationScopeCollector from "./DeclarationScopeCollector";
import EnumValueResolver from "./EnumValueResolver";
import ISwitchStatementError from "./types/ISwitchStatementError";
import OperandTypeResolver from "./OperandTypeResolver";
import ScopeFrameResolver from "./ScopeFrameResolver";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";

/** MISRA C:2012 Rule 16.6: a switch needs at least two clauses. */
const MINIMUM_CLAUSES = 2;

class SwitchStatementListener extends CNextListener {
  private readonly found: ISwitchStatementError[] = [];
  private readonly types: OperandTypeResolver;
  private readonly values: EnumValueResolver;

  public constructor(private readonly scopes: ScopeFrameResolver) {
    super();
    this.types = new OperandTypeResolver(scopes);
    this.values = new EnumValueResolver(scopes);
  }

  public errors(): ISwitchStatementError[] {
    return this.found;
  }

  override enterSwitchStatement = (
    ctx: Parser.SwitchStatementContext,
  ): void => {
    const switchExpr = ctx.expression();
    const cases = ctx.switchCase();
    const defaultCase = ctx.defaultCase();
    const frame = this.scopes.frameFor(ctx);

    if (this.types.typeOfOperand(switchExpr, frame) === "bool") {
      this.report(
        switchExpr,
        "E0711",
        "Cannot switch on a boolean",
        "MISRA C:2012 Rule 16.7: a bool has two states and a switch implies more. Use if/else.",
      );
      return;
    }

    if (cases.length + (defaultCase ? 1 : 0) < MINIMUM_CLAUSES) {
      this.report(
        switchExpr,
        "E0712",
        "Switch requires at least 2 clauses",
        "MISRA C:2012 Rule 16.6: a one-clause switch is an if statement written the long way.",
      );
      return;
    }

    if (this.reportDuplicateCase(cases)) return;

    const verdict = this.values.classify(switchExpr, frame);
    const switchEnum = verdict.kind === "enum" ? verdict.typeName : null;
    if (this.reportBareMemberLabels(cases, switchEnum)) return;
    if (switchEnum !== null) {
      this.checkExhaustiveness(switchExpr, switchEnum, cases, defaultCase);
    }
  };

  /**
   * E0424 on a case label (ADR-017, #1322): a bare identifier label resolves
   * against the switch's enum, and against nothing when the switch is not on
   * an enum. A label naming a member of some OTHER enum is the bare-member
   * mistake with the enum spelled out for it. True when one was reported.
   */
  private reportBareMemberLabels(
    cases: readonly Parser.SwitchCaseContext[],
    switchEnum: string | null,
  ): boolean {
    const symbols = CodeGenState.symbols;
    if (!symbols) return false;
    let reported = false;
    for (const caseCtx of cases) {
      for (const label of caseCtx.caseLabel()) {
        const name = label.IDENTIFIER()?.getText();
        if (name === undefined) continue;
        if (
          switchEnum !== null &&
          symbols.enumMembers.get(switchEnum)?.has(name)
        )
          continue;
        const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
        if (declaring.length === 0) continue; // a const label
        const { line, column } = ParserUtils.getPosition(label);
        this.found.push({
          code: "E0424",
          line,
          column,
          message: EnumMemberSuggestion.message(name, declaring),
          helpText:
            switchEnum === null
              ? "The switch is not on an enum, so a bare member names nothing here; qualify it, or switch on a value of the enum's type (ADR-017)."
              : `The switch is on ${switchEnum}, which declares no such member; qualify the label with the enum it belongs to (ADR-017).`,
        });
        reported = true;
      }
    }
    return reported;
  }

  /** True when a duplicate was reported, so the later checks are skipped. */
  private reportDuplicateCase(
    cases: readonly Parser.SwitchCaseContext[],
  ): boolean {
    const seen = new Set<string>();
    for (const caseCtx of cases) {
      for (const label of caseCtx.caseLabel()) {
        const value = SwitchStatementListener.caseLabelValue(label);
        if (seen.has(value)) {
          const { line, column } = ParserUtils.getPosition(label);
          this.found.push({
            code: "E0713",
            line,
            column,
            message: `Duplicate case value '${value}' in switch statement`,
            helpText:
              "Two clauses cannot claim the same value; one of them is unreachable.",
          });
          return true;
        }
        seen.add(value);
      }
    }
    return false;
  }

  /**
   * The clauses must account for the enum's variants exactly.
   *
   * A `default(N)` states how many variants it absorbs, so the total is the
   * explicit labels plus that count; without one, the explicit labels alone
   * have to cover every variant. A `default` with no count says nothing about
   * how many it covers, so nothing can be checked.
   */
  private checkExhaustiveness(
    at: Parser.ExpressionContext,
    enumTypeName: string,
    cases: readonly Parser.SwitchCaseContext[],
    defaultCase: Parser.DefaultCaseContext | null,
  ): void {
    const variants = CodeGenState.symbols?.enumMembers.get(enumTypeName);
    if (!variants) return;

    const total = variants.size;
    const explicit = cases.reduce(
      (sum, caseCtx) => sum + caseCtx.caseLabel().length,
      0,
    );

    if (defaultCase) {
      const declared = defaultCase.INTEGER_LITERAL();
      if (declared === null) return;
      const absorbed = Number.parseInt(declared.getText(), 10);
      const covered = explicit + absorbed;
      if (covered !== total) {
        this.report(
          at,
          "E0714",
          `Switch covers ${covered} of ${total} ${enumTypeName} variants (${explicit} explicit + default(${absorbed}))`,
          `Every variant has to be accounted for exactly once. Expected ${total}.`,
        );
      }
      return;
    }

    if (explicit !== total) {
      this.report(
        at,
        "E0714",
        `Non-exhaustive switch on ${enumTypeName}: covers ${explicit} of ${total} variants, missing ${total - explicit}`,
        "Add the missing cases, or a `default(N)` stating how many variants it absorbs.",
      );
    }
  }

  /**
   * A case label's value, as a string that compares equal for equal values.
   *
   * The spellings have to normalize or the duplicate check misses: `-1` and
   * `-0x1` are the same case written two ways, and `tests/switch` has a fixture
   * for each. Moved wholesale from codegen, where it had no other caller.
   */
  private static caseLabelValue(ctx: Parser.CaseLabelContext): string {
    const qualified = ctx.qualifiedType();
    if (qualified) {
      return qualified
        .IDENTIFIER()
        .map((id) => id.getText())
        .join(".");
    }
    const identifier = ctx.IDENTIFIER();
    if (identifier) return identifier.getText();

    const negated = ctx.children?.[0]?.getText() === "-";
    const numeric =
      ctx.INTEGER_LITERAL() ?? ctx.HEX_LITERAL() ?? ctx.BINARY_LITERAL();
    if (numeric) {
      const value = BigInt(numeric.getText());
      return String(negated ? -value : value);
    }

    const character = ctx.CHAR_LITERAL();
    return character ? character.getText() : "";
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

class SwitchStatementAnalyzer {
  public analyze(tree: Parser.ProgramContext): ISwitchStatementError[] {
    const declarations = new DeclarationScopeCollector();
    ParseTreeWalker.DEFAULT.walk(declarations, tree);

    const listener = new SwitchStatementListener(
      new ScopeFrameResolver(declarations),
    );
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default SwitchStatementAnalyzer;
