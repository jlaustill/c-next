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

import LengthProperty from "../../utils/LengthProperty";
import QualifiedCName from "../../utils/QualifiedCName";
import ScopeUtils from "../../utils/ScopeUtils";
import ConstLiteral from "../../utils/ConstLiteral";
import type TChainRoot from "../../types/TChainRoot";
import type TValueBinding from "../../types/TValueBinding";
import type TSymbol from "../../types/symbols/TSymbol";
import OperandTyper from "../../utils/OperandTyper";
import StatementNodes from "../../utils/StatementNodes";
import EnumValueResolver from "./EnumValueResolver";
import ISwitchStatementError from "./types/ISwitchStatementError";
import EnumMemberSuggestion from "./helpers/EnumMemberSuggestion";
import type IAnalysisContext from "./types/IAnalysisContext";
import type IProgramSyntax from "../../types/syntax/IProgramSyntax";
import type ISourceSpan from "../../types/ISourceSpan";
import type TCaseLabelSyntax from "../../types/syntax/TCaseLabelSyntax";
import type TDeclarationSyntax from "../../types/syntax/TDeclarationSyntax";
import type TStatement from "../../types/syntax/TStatement";

type TSwitch = Extract<TStatement, { kind: "switch" }>;
type TSwitchCase = TSwitch["cases"][number];
type TDefaultCase = NonNullable<TSwitch["defaultCase"]>;

/** MISRA C:2012 Rule 16.6: a switch needs at least two clauses. */
const MINIMUM_CLAUSES = 2;

/** Symbols that name a type, which a case label cannot be (#2051, #2069) */
const TYPE_KINDS: ReadonlySet<string> = new Set([
  "enum",
  "struct",
  "bitmap",
  "register",
]);

class SwitchStatementCheck {
  private readonly found: ISwitchStatementError[] = [];
  private readonly values: EnumValueResolver;

  public constructor(private readonly context: IAnalysisContext) {
    this.values = new EnumValueResolver(context);
  }

  public errors(): ISwitchStatementError[] {
    return this.found;
  }

  /** Every switch in a function, a scope's included (#1991) */
  public declaration(declaration: TDeclarationSyntax): void {
    if (declaration.kind === "scope") {
      for (const member of declaration.members) {
        this.declaration(member.declaration);
      }
      return;
    }
    if (declaration.kind !== "function") return;
    for (const statement of StatementNodes.of(declaration.body.statements)) {
      if (statement.kind === "switch") this.statement(statement);
    }
  }

  private statement(statement: TSwitch): void {
    const switchExpr = statement.subject;
    const cases = statement.cases;
    const defaultCase = statement.defaultCase;

    if (OperandTyper.isBoolean(OperandTyper.typeOf(switchExpr, this.context))) {
      this.report(
        switchExpr.span,
        "E0711",
        "Cannot switch on a boolean",
        "MISRA C:2012 Rule 16.7: a bool has two states and a switch implies more. Use if/else.",
      );
      return;
    }

    if (cases.length + (defaultCase ? 1 : 0) < MINIMUM_CLAUSES) {
      this.report(
        switchExpr.span,
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
      this.checkExhaustiveness(switchExpr.span, switchEnum, cases, defaultCase);
    }
  }

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
    label: TCaseLabelSyntax,
    switchEnum: string | null,
  ): boolean {
    const symbols = this.context.symbols;
    // `this.X` and `global.X` name a const by where it lives (ADR-057), so
    // they are never a bare member (#1629)
    if (label.kind !== "identifier" || label.root !== null) return false;
    const name = label.name;
    if (switchEnum !== null && symbols.enumMembers.get(switchEnum)?.has(name)) {
      return false;
    }
    const declaring = EnumMemberSuggestion.enumsDeclaring(name, symbols);
    if (declaring.length === 0) return false; // a const label

    this.found.push({
      code: "E0424",
      line: label.span.line,
      column: label.span.column,
      message: EnumMemberSuggestion.message(name, declaring),
      helpText:
        switchEnum === null
          ? "The switch is not on an enum, so a bare member names nothing here; qualify it, or switch on a value of the enum's type (ADR-017)."
          : `The switch is on ${switchEnum}, which declares no such member; qualify the label with the enum it belongs to (ADR-017).`,
    });
    return true;
  }

  private reportBareMemberLabels(
    cases: readonly TSwitchCase[],
    switchEnum: string | null,
  ): boolean {
    let reported = false;
    for (const caseCtx of cases) {
      for (const label of caseCtx.labels) {
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
  private reportNonConstantLabels(cases: readonly TSwitchCase[]): boolean {
    let reported = false;
    for (const caseCtx of cases) {
      for (const label of caseCtx.labels) {
        if (this.isConstantLabel(label)) continue;
        const { line, column } = label.span;
        this.found.push({
          code: "E0717",
          line,
          column,
          message: `Case label '${SwitchStatementCheck.caseLabelValue(label)}' is not a constant`,
          helpText:
            "A case label must be a literal, an enum member or a const with a value (ADR-025); compare a variable with if/else.",
        });
        reported = true;
      }
    }
    return reported;
  }

  /** A length label's folded number (#1975 review); null for any other */
  private lengthValue(label: TCaseLabelSyntax): string | null {
    const length = LengthProperty.labelName(label);
    if (length === null) return null;
    const folded = this.context.program.constantValueOf(
      this.context.sourceFile,
      length,
    );
    return folded.kind === "value" ? folded.value.toString() : null;
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

  private isConstantLabel(label: TCaseLabelSyntax): boolean {
    if (LengthProperty.labelName(label) !== null) {
      return this.lengthValue(label) !== null;
    }
    const binding = this.labelBinding(label);
    if (binding !== null) return this.isConstant(binding, label);
    if (label.kind === "identifier") {
      const kind = this.typeKindOf(label.root, label.name, label.span);
      return kind === undefined || !TYPE_KINDS.has(kind);
    }
    if (label.kind !== "qualified") return true;
    // A chain through an enum names its member; through a struct or a bitmap
    // a field, which is no constant (#2072). No symbol at all is E0427's.
    const kind = this.typeKindOf(label.root, label.path[0], label.span);
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
    at: ISourceSpan,
  ): TSymbol["kind"] | undefined {
    return this.context.program.symbolByCName(this.headCName(root, name, at))
      ?.kind;
  }

  /** The C name a type-position head -- `State`, `this.State` -- names at `at` */
  private headCName(root: TChainRoot, name: string, at: ISourceSpan): string {
    const { program, sourceFile } = this.context;
    return ScopeUtils.typeHeadCName(
      root,
      name,
      OperandTyper.scopePathAt(at, this.context),
      (qualified) => program.isScopeTypeVisibleFrom(sourceFile, qualified),
    );
  }

  /** The member `Panel.LIMIT` names, in the scope its head binds */
  private scopeMember(
    label: Extract<TCaseLabelSyntax, { kind: "qualified" }>,
    scopePath: string,
  ): TSymbol | undefined {
    return this.context.program.symbolByCName(
      ScopeUtils.qualifyPathInScope(label.path.slice(1), scopePath),
    );
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
        const member = this.scopeMember(label, binding.scopePath);
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
   * What a label claims in C, so two labels that are one C case are one key
   * whatever their spelling (#2046). A const is written as its value
   * (`resolveCaseConst`), so `LIMIT`, `this.LIMIT`, `Panel.LIMIT` and `3`
   * all claim 3, and two consts with one value claim it twice;
   * `case Point.type_byte_length` is its number too. A label that does not
   * fold is keyed on what it names: an enum member on the member, so
   * `State.IDLE` and `this.State.IDLE` in its scope are one, and a header
   * macro on its name.
   */
  private labelKey(label: TCaseLabelSyntax): string {
    const folded = this.lengthValue(label) ?? this.foldedValue(label);
    if (folded !== null) return `value:${folded}`;
    const binding = this.labelBinding(label);
    // `HDR_K` and `global.HDR_K`: one header macro, written by its name
    if (
      label.kind === "identifier" &&
      label.root !== "this" &&
      (binding === null || binding.kind === "foreign")
    ) {
      return `name:${binding?.name ?? label.name}`;
    }
    if (label.kind === "qualified") {
      const head = this.headCName(label.root, label.path[0], label.span);
      return `member:${QualifiedCName.fromParts([head, ...label.path.slice(1)])}`;
    }
    return `value:${SwitchStatementCheck.caseLabelValue(label)}`;
  }

  /** A const label's value, from the declaration its spelling binds */
  private foldedValue(label: TCaseLabelSyntax): string | null {
    const { program } = this.context;
    const binding = this.labelBinding(label);
    if (binding === null) return null;
    if (label.kind === "identifier") {
      return program.constantOf(binding)?.value.toString() ?? null;
    }
    if (label.kind !== "qualified" || binding.kind !== "scope") return null;
    const member = this.scopeMember(label, binding.scopePath);
    if (member?.kind !== "variable") return null;
    return (
      program
        .constantOf({ kind: "variable", symbol: member })
        ?.value.toString() ?? null
    );
  }

  /** True when a duplicate was reported, so the later checks are skipped. */
  private reportDuplicateCase(cases: readonly TSwitchCase[]): boolean {
    const seen = new Set<string>();
    for (const caseCtx of cases) {
      for (const label of caseCtx.labels) {
        const value = SwitchStatementCheck.caseLabelValue(label);
        const key = this.labelKey(label);
        if (seen.has(key)) {
          this.found.push({
            code: "E0713",
            line: label.span.line,
            column: label.span.column,
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
    at: ISourceSpan,
    enumTypeName: string,
    cases: readonly TSwitchCase[],
    defaultCase: TDefaultCase | null,
  ): void {
    const variants = this.context.symbols.enumMembers.get(enumTypeName);
    if (!variants) return;

    const total = variants.size;
    const explicit = cases.reduce(
      (sum, caseCtx) => sum + caseCtx.labels.length,
      0,
    );

    if (defaultCase) {
      const declared = defaultCase.count;
      if (declared === null) return;
      const absorbed = Number.parseInt(declared, 10);
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
    at: ISourceSpan,
    code: string,
    message: string,
    helpText: string,
  ): void {
    this.found.push({
      code,
      line: at.line,
      column: at.column,
      message,
      helpText,
    });
  }
}

class SwitchStatementAnalyzer {
  /** #1456: handed in rather than read off shared state. */
  constructor(private readonly context: IAnalysisContext) {}

  public analyze(program: IProgramSyntax): ISwitchStatementError[] {
    const check = new SwitchStatementCheck(this.context);
    for (const member of program.declarations) {
      check.declaration(member.declaration);
    }
    return check.errors();
  }
}

export default SwitchStatementAnalyzer;
