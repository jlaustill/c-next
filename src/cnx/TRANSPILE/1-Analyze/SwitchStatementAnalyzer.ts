/**
 * ADR-025 switch statements: E0711-E0714, and E0717.
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

import SyntaxLowering from "../../PARSE/2-Parse/SyntaxLowering";
import StatementLowering from "../../PARSE/2-Parse/StatementLowering";
import type TCaseLabelSyntax from "../../types/syntax/TCaseLabelSyntax";
import { ParseTreeWalker } from "antlr4ng";

import { CNextListener } from "../../PARSE/2-Parse/grammar/CNextListener";
import * as Parser from "../../PARSE/2-Parse/grammar/CNextParser";
import ParserUtils from "../../utils/ParserUtils";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import ConstLiteral from "../../utils/ConstLiteral";
import type TChainRoot from "../../types/TChainRoot";
import type TValueBinding from "../../types/TValueBinding";
import OperandTyper from "../../utils/OperandTyper";
import EnumValueResolver from "./EnumValueResolver";
import ISwitchStatementError from "./types/ISwitchStatementError";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import type IAnalysisContext from "./types/IAnalysisContext";

/** MISRA C:2012 Rule 16.6: a switch needs at least two clauses. */
const MINIMUM_CLAUSES = 2;

/** Symbols that name a type, which a case label cannot be (#2051, #2069) */
const TYPE_KINDS: ReadonlySet<string> = new Set([
  "enum",
  "struct",
  "bitmap",
  "register",
]);

class SwitchStatementListener extends CNextListener {
  private readonly found: ISwitchStatementError[] = [];
  private readonly values: EnumValueResolver;

  public constructor(private readonly context: IAnalysisContext) {
    super();
    this.values = new EnumValueResolver(context);
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

    if (
      OperandTyper.isBoolean(
        OperandTyper.typeOf(
          SyntaxLowering.expressionNode(switchExpr),
          this.context,
        ),
      )
    ) {
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

    if (this.reportNonConstantLabels(cases)) return;
    if (this.reportDuplicateCase(cases)) return;

    const verdict = this.values.classify(switchExpr);
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
  /**
   * One label. True when it named a bare enum member that the switch's own
   * enum does not declare -- a label naming nothing at all is a const, and not
   * this rule's to judge.
   */
  private reportBareMemberLabel(
    label: Parser.CaseLabelContext,
    switchEnum: string | null,
  ): boolean {
    const symbols = this.context.symbols;
    const lowered = StatementLowering.caseLabel(label);
    // `this.X` and `global.X` name a const by where it lives (ADR-057), so
    // they are never a bare member (#1629)
    if (lowered.kind !== "identifier" || lowered.root !== null) return false;
    const name = lowered.name;
    if (switchEnum !== null && symbols.enumMembers.get(switchEnum)?.has(name)) {
      return false;
    }
    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return false; // a const label

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
    return true;
  }

  private reportBareMemberLabels(
    cases: readonly Parser.SwitchCaseContext[],
    switchEnum: string | null,
  ): boolean {
    let reported = false;
    for (const caseCtx of cases) {
      for (const label of caseCtx.caseLabel()) {
        if (this.reportBareMemberLabel(label, switchEnum)) reported = true;
      }
    }
    return reported;
  }

  /**
   * E0717 (ADR-025 rule 6, #2051): a label is a literal, an enum member or a
   * const with a value. A variable, a function or a scope has no value C can
   * switch on, so each reached the C as a name gcc rejects, at exit 0.
   *
   * Asked of what the label BINDS, so one check covers every spelling the
   * grammar admits: `level`, `this.level`, `global.level`, `Panel.level`.
   * A label binding no value is a type or a chain through a struct or a
   * bitmap (E0717 too: `EMode`, `this.State`, `global.Pt.x`; #2069, #2072),
   * an enum member, a header's macro, or E0427's.
   */
  private reportNonConstantLabels(
    cases: readonly Parser.SwitchCaseContext[],
  ): boolean {
    let reported = false;
    for (const caseCtx of cases) {
      for (const label of caseCtx.caseLabel()) {
        const lowered = StatementLowering.caseLabel(label);
        if (this.isConstantLabel(lowered, label)) continue;
        const { line, column } = ParserUtils.getPosition(label);
        this.found.push({
          code: "E0717",
          line,
          column,
          message: `Case label '${SwitchStatementListener.caseLabelValue(lowered)}' is not a constant`,
          helpText:
            "A case label must be a literal, an enum member or a const with a value (ADR-025); compare a variable with if/else.",
        });
        reported = true;
      }
    }
    return reported;
  }

  /** What a label's name -- or a member chain's head -- binds, if it has one */
  private labelBinding(label: TCaseLabelSyntax): TValueBinding | null {
    const { program, sourceFile } = this.context;
    switch (label.kind) {
      case "identifier":
        return program.bindValue(
          sourceFile,
          label.root,
          label.name,
          label.nameSpan,
        );
      case "qualified":
        return program.bindValue(
          sourceFile,
          label.root,
          label.path[0],
          label.headSpan,
        );
      default:
        return null;
    }
  }

  private isConstantLabel(
    label: TCaseLabelSyntax,
    at: Parser.CaseLabelContext,
  ): boolean {
    const binding = this.labelBinding(label);
    if (binding !== null) return this.isConstant(binding, label);
    if (label.kind === "identifier") {
      const kind = this.typeKindOf(label.root, label.name, at);
      return kind === undefined || !TYPE_KINDS.has(kind);
    }
    if (label.kind !== "qualified") return true;
    // A chain through an enum names its member; through a struct or a bitmap
    // a field, which is no constant (#2072). No symbol at all is E0427's.
    const kind = this.typeKindOf(label.root, label.path[0], at);
    return kind === undefined || kind === "enum";
  }

  /**
   * The kind of type a name that binds no value names -- `EMode`,
   * `this.State`, `global.Pt`, or a chain's head -- looked up where a member
   * chain's head would be. Not `isTypeNameAt`: in a file that includes a
   * header it calls a name it cannot find a type, which a bare enum member
   * (`IDLE`) is.
   */
  private typeKindOf(
    root: TChainRoot,
    name: string,
    at: Parser.CaseLabelContext,
  ): string | undefined {
    const { program, sourceFile } = this.context;
    const cName = ScopeUtils.typeHeadCName(
      root,
      name,
      OperandTyper.scopePathAt(ParserUtils.getPosition(at), this.context),
      (qualified) => program.isScopeTypeVisibleFrom(sourceFile, qualified),
    );
    return program.symbolByCName(cName)?.kind;
  }

  /** Whether a bound label is a constant, asked of the one const-value answer */
  private isConstant(binding: TValueBinding, label: TCaseLabelSyntax): boolean {
    const { program } = this.context;
    switch (binding.kind) {
      case "foreign":
        return true;
      case "variable":
        return (
          label.kind === "identifier" &&
          ConstLiteral.textOf(program, binding.symbol) !== null
        );
      case "local":
        return (
          label.kind === "identifier" && program.constantOf(binding) !== null
        );
      case "function":
        return false;
      case "scope": {
        // `Panel.LIMIT`: the scope names where to look, the member decides
        if (label.kind !== "qualified") return false;
        const member = program.symbolByCName(
          ScopeUtils.qualifyPathInScope(label.path.slice(1), binding.scopePath),
        );
        // No symbol: an enum member chain (`Panel.State.IDLE`), or #1630's
        if (member === undefined) return true;
        return (
          member.kind === "variable" &&
          ConstLiteral.textOf(program, member) !== null
        );
      }
    }
  }

  /**
   * Which declaration or enum member a named label is, so two spellings of
   * one -- `LIMIT` and `this.LIMIT` in its scope, `State.IDLE` and
   * `this.State.IDLE` -- are one value. Null for a label keyed on its value.
   */
  private labelIdentity(
    label: TCaseLabelSyntax,
    at: Parser.CaseLabelContext,
  ): string | null {
    const { program, sourceFile } = this.context;
    if (label.kind === "identifier") {
      const binding = this.labelBinding(label);
      return binding?.kind === "variable"
        ? binding.symbol.fullyQualifiedCName
        : null;
    }
    if (label.kind !== "qualified") return null;
    const head = ScopeUtils.typeHeadCName(
      label.root,
      label.path[0],
      OperandTyper.scopePathAt(ParserUtils.getPosition(at), this.context),
      (name) => program.isScopeTypeVisibleFrom(sourceFile, name),
    );
    return QualifiedCName.fromParts([head, ...label.path.slice(1)]);
  }

  /** True when a duplicate was reported, so the later checks are skipped. */
  private reportDuplicateCase(
    cases: readonly Parser.SwitchCaseContext[],
  ): boolean {
    const seen = new Set<string>();
    for (const caseCtx of cases) {
      for (const label of caseCtx.caseLabel()) {
        const lowered = StatementLowering.caseLabel(label);
        const value = SwitchStatementListener.caseLabelValue(lowered);
        // A declaration and a spelling are different keys: a local `LIMIT`
        // is not the file's, which `global.LIMIT` binds
        const identity = this.labelIdentity(lowered, label);
        const key = identity === null ? `value:${value}` : `decl:${identity}`;
        if (seen.has(key)) {
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
        seen.add(key);
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
    const variants = this.context.symbols.enumMembers.get(enumTypeName);
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
  private static caseLabelValue(label: TCaseLabelSyntax): string {
    switch (label.kind) {
      case "qualified":
        return (
          label.root === null ? label.path : [label.root, ...label.path]
        ).join(".");
      case "identifier":
        return label.root === null ? label.name : `${label.root}.${label.name}`;
      case "integer":
      case "hex": {
        const value = BigInt(label.text);
        return String(label.negative ? -value : value);
      }
      case "binary":
        return String(BigInt(label.text));
      case "char":
        return label.text;
      case "missing":
        return "";
    }
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
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(tree: Parser.ProgramContext): ISwitchStatementError[] {
    const listener = new SwitchStatementListener(this.context);
    ParseTreeWalker.DEFAULT.walk(listener, tree);
    return listener.errors();
  }
}

export default SwitchStatementAnalyzer;
