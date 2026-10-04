/**
 * CodeGenWalker -- the parse-tree walk that drives code generation.
 *
 * #1445 box 3: the render pass must not hold parse nodes. This class is the
 * half of the former `CodeGenerator` that did, extracted whole: every member
 * whose text names a `Parser.*Context`, `ParserRuleContext` or
 * `CommonTokenStream`, plus the parse-free members that only those call.
 *
 * It lives at `src/TRANSPILE/` rather than in a pass because it is not one.
 * It walks the tree and drives 2.2 and 2.3 for a single file -- the same role
 * `Transpiler` plays for a run, which is why `src/transpiler/` already holds
 * three tree-walking modules. It cannot live in `2-Plan/`:
 * `plan-cannot-import-render` is `error` with `reachable: true`, and the walk
 * imports sixteen generator functions and twenty-eight helpers from
 * `3-Render/`.
 *
 * What stayed behind in `CodeGenerator` is the render-side service surface --
 * `IOrchestrator`'s methods, the emission-fact captures and output assembly.
 * The split is ACYCLIC and that was measured, not assumed: the staying half
 * makes zero calls back into the walk, so this class depends on
 * `CodeGenerator` and never the reverse. Fourteen of its methods are reached
 * through `this.host`, all of them already public.
 */
import type ISubstringOps from "./3-Render/codegen/types/ISubstringOps";
import type IChainStep from "../types/IChainStep";
import type EFileType from "../PARSE/1-Discover/types/EFileType";
import type IStringConcatOps from "./3-Render/codegen/types/IStringConcatOps";
import { basename } from "node:path";
import { CommonTokenStream, ParserRuleContext } from "antlr4ng";
import * as Parser from "../PARSE/2-Parse/grammar/CNextParser";
import CommentScanner from "../PARSE/2-Parse/CommentScanner";
import CommentFormatter from "./3-Render/codegen/CommentFormatter";
import IComment from "../types/IComment";
import TYPE_MAP from "./3-Render/codegen/types/TYPE_MAP";
import TParameterInfo from "../types/TParameterInfo";
import ICodeGeneratorOptions from "./3-Render/codegen/types/ICodeGeneratorOptions";
import TypeValidator from "./3-Render/codegen/TypeValidator";
import IGeneratorOutput from "./3-Render/codegen/generators/IGeneratorOutput";
import EmissionPlan from "./2-Plan/EmissionPlan";
import DeclarationPlan from "./2-Plan/DeclarationPlan";
import CastRequirement from "./2-Plan/CastRequirement";
import OperandTyper from "../utils/OperandTyper";
import CppNamespaceUtils from "../utils/CppNamespaceUtils";
import PlanTyping from "./2-Plan/PlanTyping";
import CompositeType from "../utils/CompositeType";
import type IOperandType from "../types/IOperandType";
import type TOverflowBehavior from "../types/TOverflowBehavior";
import type TDeclarationKind from "../types/TDeclarationKind";
import type IEmissionPlan from "../types/IEmissionPlan";
import type IEmissionFacts from "../types/IEmissionFacts";
import TGeneratorFn from "./3-Render/codegen/generators/TGeneratorFn";
import generateLiteral from "./3-Render/codegen/generators/expressions/LiteralGenerator";
import generateBinaryExpr from "./3-Render/codegen/generators/expressions/BinaryExprGenerator";
import TPlannedBinaryExpr from "./3-Render/codegen/types/TPlannedBinaryExpr";
import BinaryExprUtils from "./3-Render/codegen/generators/expressions/BinaryExprUtils";
import generateUnaryExpr from "./3-Render/codegen/generators/expressions/UnaryExprGenerator";
import generateTernaryExpr from "./3-Render/codegen/generators/expressions/ExpressionGenerator";
import type TPlannedTernary from "./3-Render/codegen/types/TPlannedTernary";
import generatePostfixExpression from "./3-Render/codegen/generators/expressions/PostfixExpressionGenerator";
import controlFlowGenerators from "./3-Render/codegen/generators/statements/ControlFlowGenerator";
import IPlannedFor from "./3-Render/codegen/types/IPlannedFor";
import IPlannedForAssignment from "./3-Render/codegen/types/IPlannedForAssignment";
import type TAssignmentSite from "./1-Analyze/types/TAssignmentSite";
import IPlannedForVarDecl from "./3-Render/codegen/types/IPlannedForVarDecl";
import IPlannedForever from "./3-Render/codegen/types/IPlannedForever";
import IPlannedIf from "./3-Render/codegen/types/IPlannedIf";
import IPlannedLoop from "./3-Render/codegen/types/IPlannedLoop";
import TPlannedReturn from "./3-Render/codegen/types/TPlannedReturn";
import VariableModifierBuilder from "./3-Render/codegen/helpers/VariableModifierBuilder";
import ArrayInitHelper from "./3-Render/codegen/helpers/ArrayInitHelper";
import generateCriticalStatement from "./3-Render/codegen/generators/statements/CriticalGenerator";
import generateSwitchStatement from "./3-Render/codegen/generators/statements/SwitchGenerator";
import type IPlannedSwitch from "./3-Render/codegen/types/IPlannedSwitch";
import type TPlannedCaseLabel from "./3-Render/codegen/types/TPlannedCaseLabel";
import enumGenerator from "./3-Render/codegen/generators/declarationGenerators/EnumGenerator";
import bitmapGenerator from "./3-Render/codegen/generators/declarationGenerators/BitmapGenerator";
import registerGeneratorFor from "./3-Render/codegen/generators/declarationGenerators/RegisterGenerator";
import type IPlannedRegister from "./3-Render/codegen/types/IPlannedRegister";
import type IPlannedFunction from "./3-Render/codegen/types/IPlannedFunction";
import type IPlannedStruct from "./3-Render/codegen/types/IPlannedStruct";
import type IPlannedDimension from "./3-Render/codegen/types/IPlannedDimension";
import type IPlannedCallArgument from "./3-Render/codegen/types/IPlannedCallArgument";
import type TRegisterAccessMode from "../types/TRegisterAccessMode";
import structGenerator from "./3-Render/codegen/generators/declarationGenerators/StructGenerator";
import ArrayDimensionUtils from "./3-Render/codegen/generators/declarationGenerators/ArrayDimensionUtils";
import IPlannedArrayDeclaration from "./3-Render/codegen/types/IPlannedArrayDeclaration";
import IPlannedPostfix from "./3-Render/codegen/types/IPlannedPostfix";
import SubscriptDepthValidator from "./2-Plan/SubscriptDepthValidator";
import TPlannedPostfixOp from "./3-Render/codegen/types/TPlannedPostfixOp";
import TPlannedStringDecl from "./3-Render/codegen/types/TPlannedStringDecl";
import IPlannedStringInit from "./3-Render/codegen/types/IPlannedStringInit";
import TPlannedVariableDecl from "./3-Render/codegen/types/TPlannedVariableDecl";
import TPlannedVariableInitializer from "./3-Render/codegen/types/TPlannedVariableInitializer";
import IPlannedScope from "./3-Render/codegen/types/IPlannedScope";
import TPlannedScopeMember from "./3-Render/codegen/types/TPlannedScopeMember";
import TPlannedScopeVariable from "./3-Render/codegen/types/TPlannedScopeVariable";
import PublicInterface from "./2-Plan/PublicInterface";
import functionGenerator from "./3-Render/codegen/generators/declarationGenerators/FunctionGenerator";
import scopeGenerator from "./3-Render/codegen/generators/declarationGenerators/ScopeGenerator";
import FormatUtils from "../utils/FormatUtils";
import TypeCheckUtils from "../utils/TypeCheckUtils";
import ExpressionUtils from "../utils/ExpressionUtils";
import helperGenerators from "./3-Render/codegen/generators/support/HelperGenerator";
import includeGenerators from "./3-Render/codegen/generators/support/IncludeGenerator";
import commentUtils from "./3-Render/codegen/generators/support/CommentUtils";
import DeclaredTypeInfo from "./2-Plan/DeclaredTypeInfo";
import DeclaredPointer from "../utils/DeclaredPointer";
import type IChainBase from "./2-Plan/types/IChainBase";
import type TTypeInfo from "../types/TTypeInfo";
import memberAccessChain from "./3-Render/codegen/memberAccessChain";
import type IRootHolding from "./3-Render/codegen/types/IRootHolding";
import AssignmentHandlerRegistry from "./3-Render/codegen/assignment/index";
import AssignmentClassifier from "./2-Plan/AssignmentClassifier";
import AssignmentOperatorMapper from "./3-Render/codegen/helpers/AssignmentOperatorMapper";
import buildAssignmentContext from "./2-Plan/AssignmentContextBuilder";
import StringLengthCounter from "./2-Plan/StringLengthCounter";
import CppModeHelper from "./3-Render/codegen/helpers/CppModeHelper";
import generateCast from "./3-Render/codegen/generators/expressions/CastExprGenerator";
import type IPlannedCast from "./3-Render/codegen/types/IPlannedCast";
import ConstExprLowering from "../utils/ConstExprLowering";
import ConstantEvaluator from "../utils/ConstantEvaluator";
import ConstantFold from "../utils/ConstantFold";
import UNRESOLVED_DIMENSION from "../types/UNRESOLVED_DIMENSION";
import dimensionEvalOptions from "./2-Plan/dimensionEvalOptions";
import MemberChainAnalyzer from "./3-Render/codegen/analysis/MemberChainAnalyzer";
import type IBitAccessAnalysis from "../types/IBitAccessAnalysis";
import type TPlannedTargetOp from "../types/TPlannedTargetOp";
import ArgumentGenerator from "./3-Render/codegen/helpers/ArgumentGenerator";
import CppMemberHelper from "./2-Plan/CppMemberHelper";
import IPostfixOp from "../types/IPostfixOp";
import CppConstructorHelper from "../utils/CppConstructorHelper";
import VariableDeclHelper from "./3-Render/codegen/helpers/VariableDeclHelper";
import StringOperationsHelper from "./3-Render/codegen/helpers/StringOperationsHelper";
import MemberSeparatorResolver from "./3-Render/codegen/helpers/MemberSeparatorResolver";
import ParameterDereferenceResolver from "./3-Render/codegen/helpers/ParameterDereferenceResolver";
import PostfixChainBuilder from "./3-Render/codegen/helpers/PostfixChainBuilder";
import SimpleIdentifierResolver from "./3-Render/codegen/helpers/SimpleIdentifierResolver";
import BaseIdentifierBuilder from "./3-Render/codegen/helpers/BaseIdentifierBuilder";
import ISimpleIdentifierDeps from "./3-Render/codegen/types/ISimpleIdentifierDeps";
import IPostfixChainDeps from "./3-Render/codegen/types/IPostfixChainDeps";
import IPostfixOperation from "./3-Render/codegen/types/IPostfixOperation";
import ExpressionUnwrapper from "../utils/ExpressionUnwrapper";
import ParserUtils from "../utils/ParserUtils";
import type ISourcePosition from "../utils/types/ISourcePosition";
import IMemberSeparatorDeps from "./3-Render/codegen/types/IMemberSeparatorDeps";
import IParameterDereferenceDeps from "./3-Render/codegen/types/IParameterDereferenceDeps";
import ISeparatorContext from "./3-Render/codegen/types/ISeparatorContext";
import TypeGenerationHelper from "./3-Render/codegen/helpers/TypeGenerationHelper";
import type IPlannedType from "./3-Render/codegen/types/IPlannedType";
import type IPlannedParameter from "./3-Render/codegen/types/IPlannedParameter";
import type IPlannedDirective from "./3-Render/codegen/types/IPlannedDirective";
import type IPlannedFunctionParameter from "./3-Render/codegen/types/IPlannedFunctionParameter";
import type ITypeAccessors from "../types/ITypeAccessors";
import FunctionContextManager from "./3-Render/codegen/helpers/FunctionContextManager";
import BitRangeHelper from "./3-Render/codegen/helpers/BitRangeHelper";
import invariant from "../utils/invariant";
import AdrProvenance from "../instrumentation/AdrProvenance";
import PassByValueAnalyzer from "./2-Plan/PassByValueAnalyzer";
import ParameterInputAdapter from "./3-Render/codegen/helpers/ParameterInputAdapter";
import ParameterSignatureBuilder from "./3-Render/codegen/helpers/ParameterSignatureBuilder";
import SizeofResolver from "./3-Render/codegen/resolution/SizeofResolver";
import type TSizeofOperand from "./3-Render/codegen/types/TSizeofOperand";
import QualifiedNameGenerator from "../utils/QualifiedNameGenerator";
import MisraSuppressionUtils from "./3-Render/MisraSuppressionUtils";
import QualifiedCName from "../utils/QualifiedCName";
import ToolchainRequirementUtils from "../utils/ToolchainRequirementUtils";
import ScopeUtils from "../utils/ScopeUtils";
import TypeBinding from "../PARSE/3-Declare/TypeBinding";
import type ITargetDescription from "../types/ITargetDescription";
import SymbolTypeResolver from "../utils/TypeResolver";
import CNEXT_TO_C_TYPE_MAP from "../utils/constants/TypeMappings";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import SymbolGuards from "../types/symbols/SymbolGuards";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import type TSymbol from "../types/symbols/TSymbol";
import type ICallbackTypeInfo from "../types/ICallbackTypeInfo";
import BareIdentifier from "../utils/BareIdentifier";

const {
  generateOverflowHelpers: helperGenerateOverflowHelpers,
  generateSafeDivHelpers: helperGenerateSafeDivHelpers,
} = helperGenerators;

const {
  transformIncludeDirective: includeTransformIncludeDirective,
  processPreprocessorDirective: includeProcessPreprocessorDirective,
} = includeGenerators;

const {
  getLeadingComments: commentGetLeadingComments,
  formatLeadingComments: commentFormatLeadingComments,
} = commentUtils;

interface FunctionSignature {
  name: string;
  parameters: Array<{
    name: string;
    baseType: string; // The C-Next type (e.g., 'u32', 'f32')
    isConst: boolean;
    isArray: boolean;
  }>;
}
import CodeGenerator from "./3-Render/codegen/CodeGenerator";
import ToolchainRequirements from "../instrumentation/ToolchainRequirements";
import type TranspileState from "./TranspileState";

/** What render folds a constant chain at: wide enough to hold any i64 */
const WIDEST_SIGNED = "i64";

class CodeGenWalker {
  /**
   * The render-side services. Generators receive THIS object as their
   * orchestrator, not the walker: `IOrchestrator` is implemented over there.
   *
   * Injected with a default rather than constructed in the body, so a test can
   * hold the same instance the walk drives and assert on the state it
   * accumulates. Production never passes one.
   */
  private readonly host: CodeGenerator;

  /**
   * 2.3 Render's per-file state, for callers that hold the WALKER (#1452 box 4).
   *
   * An accessor rather than widening `host`, so `Transpiler` reaches the state
   * without reaching `CodeGenerator`. It was described as narrow on the grounds
   * that `Transpiler` needed one flag off it (ADR-040's ISR typedef); it names
   * `transpileState` 45 times, so what it is narrow about is the OBJECT
   * exposed, not the number of reads.
   *
   * The walk itself does not go through here -- it holds `this.host` directly
   * and spells the state `this.host.state`.
   */
  get transpileState(): TranspileState {
    return this.host.state;
  }

  constructor(host: CodeGenerator = new CodeGenerator()) {
    this.host = host;
  }

  /** Lookup map for primitive type zero initializers */
  private static readonly PRIMITIVE_ZERO_VALUES: ReadonlyMap<string, string> =
    new Map([
      ["bool", "false"],
      ["f32", "0.0f"],
      ["f64", "0.0"],
    ]);

  /** Token stream for comment extraction (ADR-043) */
  private tokenStream: CommonTokenStream | null = null;

  private commentExtractor: CommentScanner | null = null;

  private readonly commentFormatter: CommentFormatter = new CommentFormatter();

  /**
   * Drop the parse state this walker accumulated during a run.
   *
   * #1445 box 2: `tokenStream` and the `CommentScanner` over it were assigned
   * per file in `generate()` and **never cleared**, so after a run the walker
   * still pointed at the LAST file's `CommonTokenStream`. `Transpiler` holds one
   * walker for its whole life and `ServeCommand` holds one `Transpiler` in a
   * static field, so a language server sitting idle retained that stream until
   * the next request overwrote it.
   *
   * This is the residency defect #1301 already fixed for the retained parses,
   * in a different field. That fix cleared a map the orchestrator owned; these
   * two live on the walker, so the orchestrator cannot reach them -- hence a
   * method rather than another `.clear()` in the same `finally`.
   */
  releaseParseState(): void {
    this.tokenStream = null;
    this.commentExtractor = null;
  }

  /** Issue #644: String declaration helper for bounded/array/concat strings */
  /** Issue #644: Array initialization helper for size inference and fill-all */
  /**
   * Run a generator and apply its effects.
   *
   * #1445: takes the generator itself, not a name to look up. `GeneratorRegistry`
   * held three string-keyed maps whose values were stored as
   * `TGeneratorFn<ParserRuleContext>` -- an erasure written with three `as`
   * casts -- so nothing checked that the context handed to a dispatch matched
   * the kind named, and every call site needed an `invariant` to recover the
   * fact that a string lookup can miss. Passing the function infers `T` from
   * the generator and checks the context against it, and the invariants go
   * with the lookup that could fail.
   *
   * Eleven of its fourteen expression registrations were already dead, four of
   * its members had only test callers, and #1285 records the one incident it
   * caused: a second, unreachable implementation kept alive behind
   * `if (generator)` because registration is unconditional, so the guard could
   * never fail and the twin still had to be maintained by hand.
   *
   * **The inference checks the context, not the MEANING of a context-free one.**
   * `T` is inferred, so handing `generateWhile` an `IfStatementContext` is a
   * compile error -- but `generateEnum` and `generateBitmap` are both
   * `TGeneratorFn<string>`, so those two are mutually substitutable and any
   * string satisfies either. For that pair the registry's erasure did not go
   * away, it moved from `ParserRuleContext` into `string`; what catches a
   * swap there is each generator's `invariant` on an unknown key, at run
   * time. Stated because the slice's own commit subject says "a mis-wire is
   * now a type error", which was true of the seven context-typed generators
   * of the day and not of the two that slice converted.
   *
   * There are now ZERO context-typed generators -- the slices after it took
   * the render layer to none, which is this PR's headline result. So the
   * caveat is no longer a minority case: `generateEnum`/`generateBitmap` are
   * the ONLY unguarded substitution left in the family, and the run-time
   * `invariant` is the only thing standing behind it.
   */
  private invokeGenerator<T>(generate: TGeneratorFn<T>, ctx: T): string {
    const result = generate(
      ctx,
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
    this.host.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Run a declaration generator whose definition an included header may own
   * (ADR-029), suppressing only the emitted text.
   *
   * Only the type-forming kinds route here. `struct` deliberately does NOT:
   * its generator suppresses only the typedef and still emits ADR-029's init
   * function, which has external linkage and no other home -- suppressing the
   * whole generator dropped that function once already (#1164). Scope,
   * register, struct and function therefore call `invokeGenerator` directly
   * rather than passing a `false` that made this the same function twice.
   */
  private invokeSuppressibleDeclaration<T>(
    generate: TGeneratorFn<T>,
    ctx: T,
  ): string {
    // The generator still runs when the header owns the definition, so its
    // effects are registered -- returning early would silently drop them,
    // which is how the ADR-029 struct init function was lost (#369/#1164).
    const code = this.invokeGenerator(generate, ctx);
    return this.host.state.declarationPlan().headerOwnsTypeDefinitions
      ? ""
      : code;
  }

  /**
   * Generate a C expression from any expression context.
   * Part of IOrchestrator interface.
   */
  generateExpression(ctx: Parser.ExpressionContext): string {
    return this.invokeGenerator(
      generateTernaryExpr,
      this.planTernary(ctx.ternaryExpression()),
    );
  }

  /**
   * A ternary reduced to its operands (#1445).
   *
   * The child COUNT is the discrimination -- one `orExpression` is a plain
   * expression, three are condition, true arm and false arm -- and that is a
   * question about the tree, so it is asked here. The arms go over as thunks
   * because Issue #992's rule is the generator's: see `TPlannedTernary`.
   */
  private planTernary(ctx: Parser.TernaryExpressionContext): TPlannedTernary {
    const operands = ctx.orExpression();
    if (operands.length === 1) {
      return { kind: "value", code: this.generateOrExpr(operands[0]) };
    }

    return {
      kind: "ternary",
      renderCondition: () => this.generateOrExpr(operands[0]),
      renderTrue: () => this.generateOrExpr(operands[1]),
      renderFalse: () => this.generateOrExpr(operands[2]),
    };
  }

  /**
   * Issue #477: Generate expression with a specific expected type context.
   * Used by return statements to resolve unqualified enum values.
   *
   * #1450 box 4: this was a third hand-rolled save/restore of `expectedType`,
   * beside `withExpectedType` and `withoutExpectedType`, justified by a note
   * reading "uses explicit save/restore (not withExpectedType) to support null
   * values". No caller passes one. Measured rather than argued: throwing here
   * on a falsy argument leaves 1247/1247 fixtures green, and the control --
   * throwing on a TRUTHY one -- fails 663 of them, so the line is reached and
   * the falsy case simply never arrives.
   *
   * The parameter is therefore `string`, not `string | null`. That makes the
   * fact the compiler's to keep rather than a comment's, which matters because
   * the two spellings did OPPOSITE things on null: `withExpectedType(null)` is
   * a no-op by contract, while this cleared the type. Two near-identically
   * named operations disagreeing on their edge case is the trap; deleting the
   * edge case is cheaper than documenting it.
   */
  generateExpressionWithExpectedType(
    ctx: Parser.ExpressionContext,
    expectedType: string,
  ): string {
    return this.host.state.withExpectedType(expectedType, () =>
      this.generateExpression(ctx),
    );
  }

  /**
   * Generate type translation (C-Next type -> C type).
   * Part of IOrchestrator interface.
   */
  generateType(ctx: Parser.TypeContext): string {
    const plan = this.planType(ctx);

    // Track required includes based on type usage
    const requiredInclude = TypeGenerationHelper.getRequiredInclude(plan);
    if (requiredInclude) {
      this.host.state.requireInclude(requiredInclude);
    }

    // Generate the C type using the helper with dependencies
    return TypeGenerationHelper.generate(plan, {
      checkNeedsStructKeyword: (name) =>
        this.host.state.symbolTable.checkNeedsStructKeyword(name),
      isCrossFileDeclaration: (name) =>
        this.host.state.isCrossFileDeclaration(name),
    });
  }

  /**
   * A type context reduced to what the renderer asks of it (#1445).
   *
   * The named branches come from `TypeBinding` -- 1.3 Declare's one ladder --
   * rather than from a second walk here, which is what `TypeGenerationHelper`
   * used to do. `typeBindingDeps` supplies the same two predicates that helper
   * was handed: ADR-057's scope-type test, and this generator's C++-aware
   * `Scope.Type` resolver.
   *
   * An array's alternatives describe its ELEMENT, so the classification is
   * taken from `arrayType()` when there is one. `primitiveName` and `isString`
   * follow the same accessors, and `isArray` is carried because
   * `getRequiredInclude` asks a narrower question than `generate` does -- see
   * its comment.
   */
  private planType(ctx: Parser.TypeContext): IPlannedType {
    const array = ctx.arrayType();
    const accessors: ITypeAccessors = array ?? ctx;
    const deps = this.host.state.typeBindingDeps((identifiers) =>
      this.resolveQualifiedType(identifiers),
    );

    return {
      named: TypeBinding.classifyNamedType(
        accessors,
        this.host.state.currentScopePath,
        deps,
      ),
      isString: accessors.stringType() !== null,
      stringTypeText: accessors.stringType()?.getText(),
      primitiveName: accessors.primitiveType()?.getText() ?? null,
      isArray: array !== null,
      userTypeLine: accessors.userType()?.start?.line,
      text: ctx.getText(),
    };
  }

  /**
   * Generate a unary expression.
   * Part of IOrchestrator interface.
   */
  generateUnaryExpr(ctx: Parser.UnaryExpressionContext): string {
    // #1445: the generator takes the operator and the operand's generated
    // code. The recursion stays here, where the tree is.
    const postfix = ctx.postfixExpression();
    if (postfix) {
      return this.invokeGenerator(generateUnaryExpr, {
        operator: null,
        operandCode: this.generatePostfixExpr(postfix),
        operandType: () => null,
      });
    }

    const operand = ctx.unaryExpression()!;
    const text = ctx.getText();
    const operator =
      text.startsWith("!") ||
      text.startsWith("-") ||
      text.startsWith("~") ||
      text.startsWith("&")
        ? (text[0] as "!" | "-" | "~" | "&")
        : null;

    return this.invokeGenerator(generateUnaryExpr, {
      operator,
      operandCode: this.generateUnaryExpr(operand),
      // lazy: only `~` consults it
      operandType: () => this.directTypeOf(operand),
    });
  }

  /**
   * Generate a postfix expression.
   * Part of IOrchestrator interface.
   * Issue #644: Delegates to extracted PostfixExpressionGenerator.
   */
  /**
   * Resolve the variable that a leading subscript chain indexes (Issue #1106).
   *
   * ADR-016 lets the same variable be reached three ways, and
   * `postfixExpression` parses each differently:
   *
   * - `flags[4][3]`        -- primary is the IDENTIFIER; subscripts start at op 0
   * - `this.flags[4][3]`   -- primary is `this`; `.flags` is op 0, subscripts at 1
   * - `global.flags[4][3]` -- primary is `global`; likewise
   *
   * Returning the resolved name and offset for all three keeps depth
   * validation from having a hole that the bare-identifier form does not.
   *
   * `displayName` is how the DEVELOPER spelled it, because a diagnostic quotes
   * that rather than the resolved name -- `Sensor_flags` does resolve as a
   * bare name, but nobody writes it, and echoing it back reads as a different
   * variable.
   */
  private resolveSubscriptBase(
    ctx: Parser.PostfixExpressionContext,
    rootIdentifier: string | undefined,
    ops: readonly Parser.PostfixOpContext[],
  ): { name: string; displayName: string; opOffset: number } | undefined {
    if (rootIdentifier) {
      return { name: rootIdentifier, displayName: rootIdentifier, opOffset: 0 };
    }

    const prefix = ctx.primaryExpression().getText();
    if (prefix !== "this" && prefix !== "global") {
      return undefined;
    }

    const memberName = ops[0]?.IDENTIFIER()?.getText();
    if (!memberName) {
      return undefined;
    }

    // `this.x` is the scope-qualified variable `Scope_x`; `global.x` is plain `x`.
    const name =
      prefix === "this"
        ? QualifiedNameGenerator.forMember(
            this.host.state.currentScopePath,
            memberName,
          )
        : memberName;
    return { name, displayName: `${prefix}.${memberName}`, opOffset: 1 };
  }

  /**
   * A postfix expression: its primary, and the operations applied to it.
   *
   * What the generator read off the tree was the op KINDS -- an IDENTIFIER is
   * a member access, one or two bracketed expressions are a subscript, neither
   * is a call -- and two facts about the leading subscript run. Both are
   * decided here; the renders they reach are thunks, because generating an
   * index draws a temp name and queues its declaration, so rendering one for
   * an operation the generator has not reached yet would take the name a
   * nearer expression holds today.
   */
  private planPostfixExpression(
    ctx: Parser.PostfixExpressionContext,
  ): IPlannedPostfix {
    const primary = ctx.primaryExpression();
    const ops = ctx.postfixOp();
    const rootIdentifier = primary.IDENTIFIER()?.getText();
    const subscriptBase = this.resolveSubscriptBase(ctx, rootIdentifier, ops);

    // #1445 review: planned FIRST, then counted off the planned ops.
    //
    // This counted off the raw nodes while the write path counted off planned
    // ones, so `SubscriptDepthValidator` -- whose whole purpose is that the two
    // paths "cannot diverge on what counts as a subscript" -- answered that
    // question from two representations behind a `"kind" in op` probe. Planning
    // is pure (it builds thunks and renders nothing), so doing it first costs
    // nothing and leaves the validator one branch and one shape.
    //
    // #1668 (S25): each subscript's kind is the one operand typer's, step by
    // step. A `this.`/`global.` chain consumes its first `.name`, so the
    // typer's steps are the op list's tail.
    const typing = this.host.state.typingContext();
    const chain = OperandTyper.chainOf(ctx, typing);
    const steps = chain.steps;
    const offset = ops.length - steps.length;
    const plannedOps = ops.map((op, i) =>
      this.planPostfixOp(op, steps[i - offset] ?? null),
    );

    return {
      rootIdentifier,
      renderPrimary: () => this.generatePrimaryExpr(primary),
      subscriptBase: subscriptBase
        ? { name: subscriptBase.name, displayName: subscriptBase.displayName }
        : null,
      // Counted through `SubscriptDepthValidator`, the same function AND the
      // same representation the WRITE path uses.
      leadingSubscriptCount: subscriptBase
        ? SubscriptDepthValidator.countLeadingSubscripts(
            plannedOps,
            subscriptBase.opOffset,
          )
        : 0,
      ops: plannedOps,
      // #1668 (C7): the chain's bound base, from the same typed chain
      base: DeclaredTypeInfo.ofChain(
        chain,
        typing.symbols,
        this.host.state.symbolTable,
        this.host.state.targetDescription,
      ),
    };
  }

  /**
   * Which of `postfixOp`'s three shapes this one is. `step` is the one operand
   * typer's step for it (#1668): a subscript's kind, and for a call the value
   * it calls -- everything before it (#1561, #1696).
   */
  private planPostfixOp(
    op: Parser.PostfixOpContext,
    step: IChainStep | null,
  ): TPlannedPostfixOp {
    const typedAs = step?.subscript ?? null;
    const identifier = op.IDENTIFIER();
    if (identifier) {
      return { kind: "member", name: identifier.getText(), step };
    }

    const indexes = op.expression();
    if (indexes.length > 0) {
      // Issue #1094: the final index is the WIDTH on the two-index arm, and
      // folding it is what gets a const or macro width a precomputed mask
      // rather than a runtime one. Captured here rather than indexed inside
      // the thunk so the arity check above is what guarantees it exists.
      const widthExpr = indexes.at(-1);
      // The typer types every subscript it walks, an untyped value's
      // included (the classifier's default for an unknown type)
      invariant(typedAs !== null, "the typer typed this subscript");
      return {
        kind: "subscript",
        indexCount: indexes.length,
        renderIndexes: () =>
          indexes.map((index) => this.generateExpression(index)),
        foldWidth: () =>
          widthExpr === undefined
            ? undefined
            : this.tryEvaluateConstant(widthExpr),
        typedAs,
        step,
      };
    }

    return {
      kind: "call",
      // #1508: ADR-010 is recorded at the CALL rather than at the directive --
      // an `#include` sits in no scope, function or variable, so the matrix's
      // context axis has nothing to ask it.
      line: op.start?.line,
      // ADR-029: a callback-typed value names the function that is its type,
      // by C name -- the key `callbackTypes` holds. A function's own name is
      // not a typed value, so the typer's step has no `before`: null.
      calleeType: () => step?.before?.typeName ?? null,
      planArguments: () => this.planCallArguments(op.argumentList() || null),
    };
  }

  generatePostfixExpr(ctx: Parser.PostfixExpressionContext): string {
    const result = generatePostfixExpression(
      this.planPostfixExpression(ctx),
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
    this.host.applyEffects(result.effects);
    return result.code;
  }

  /**
   * Generate the full precedence chain from or-expression down.
   * Part of IOrchestrator interface.
   */
  /**
   * The binary precedence ladder, collapsed.
   *
   * Ten grammar levels, and nine of them are single-child pass-through levels for
   * almost every expression -- so each `plan*Level` returns its CHILD's plan
   * rather than wrapping it, and a plan ends up only as deep as the
   * expression's real operator nesting.
   *
   * Every operand is a thunk that re-enters the planner one level down. That
   * laziness is in the PLANNER and not merely in a top-level thunk, because
   * `withoutExpectedType` is a dynamic scope over the whole operand subtree:
   * an operand nested any distance under a comparison must render inside the
   * window the renderer opens, and anything rendered at plan time renders
   * outside it (#1032).
   */
  private planBinaryExpr(ctx: Parser.OrExpressionContext): TPlannedBinaryExpr {
    const children = ctx.andExpression();
    if (children.length === 1) {
      return this.planAndLevel(children[0]);
    }
    return {
      kind: "join",
      separator: " || ",
      renderOperands: children.map(
        (child) => () => this.renderBinaryLevel(this.planAndLevel(child)),
      ),
    };
  }

  /**
   * Render a NESTED level, returning its effects to the parent rather than
   * applying them.
   *
   * The top of the ladder goes through `invokeGenerator`, which applies the
   * accumulated effects once. An inner level must not, or an operand's
   * include would be applied while its parent is still deciding whether to
   * emit it.
   */
  private renderBinaryLevel(plan: TPlannedBinaryExpr): IGeneratorOutput {
    return generateBinaryExpr(
      plan,
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
  }

  private planAndLevel(ctx: Parser.AndExpressionContext): TPlannedBinaryExpr {
    const children = ctx.equalityExpression();
    if (children.length === 1) {
      return this.planEqualityLevel(children[0]);
    }
    return {
      kind: "join",
      separator: " && ",
      renderOperands: children.map(
        (child) => () => this.renderBinaryLevel(this.planEqualityLevel(child)),
      ),
    };
  }

  private planEqualityLevel(
    ctx: Parser.EqualityExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.relationalExpression();
    if (children.length === 1) {
      return this.planRelationalLevel(children[0]);
    }

    // #1302: read the operator from the parse tree, not from the text of the
    // whole comparison. `node.getText()` includes both operands, so a string
    // literal CONTAINING "!=" selected inequality -- `t = "a!=b"` generated
    // `strcmp(t, "a!=b") != 0`, compiling clean with the condition inverted.
    const operators = this.getOperatorsFromChildren(ctx);

    // ADR-045: a string operand makes this a strcmp. A type-registry predicate
    // that generates nothing, so it is decided here; the renderer raises the
    // include.
    const isStrcmp =
      this.isStringExpression(children[0]) ||
      this.isStringExpression(children[1]);

    return {
      kind: "comparison",
      defaultOperator: "=",
      operators,
      mapOperator: BinaryExprUtils.mapEqualityOperator,
      // ADR-001 fired only if `=` was written; `!=` is unchanged from C, and
      // occupancy must not be invented for a cell the rule never reached.
      adrLine: operators.includes("=") ? ctx.start?.line : undefined,
      strcmp: isStrcmp ? { isNotEqual: operators[0] === "!=" } : null,
      renderOperands: children.map(
        (child) => () =>
          this.renderBinaryLevel(this.planRelationalLevel(child)),
      ),
    };
  }

  private planRelationalLevel(
    ctx: Parser.RelationalExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.bitwiseOrExpression();
    if (children.length === 1) {
      return this.planBitwiseOrLevel(children[0]);
    }
    return {
      kind: "comparison",
      defaultOperator: "<",
      operators: this.getOperatorsFromChildren(ctx),
      mapOperator: null,
      adrLine: undefined,
      strcmp: null,
      renderOperands: children.map(
        (child) => () => this.renderBinaryLevel(this.planBitwiseOrLevel(child)),
      ),
    };
  }

  private planBitwiseOrLevel(
    ctx: Parser.BitwiseOrExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.bitwiseXorExpression();
    if (children.length === 1) {
      return this.planBitwiseXorLevel(children[0]);
    }
    return {
      kind: "join",
      separator: " | ",
      renderOperands: children.map(
        (child) => () =>
          this.renderBinaryLevel(this.planBitwiseXorLevel(child)),
      ),
    };
  }

  private planBitwiseXorLevel(
    ctx: Parser.BitwiseXorExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.bitwiseAndExpression();
    if (children.length === 1) {
      return this.planBitwiseAndLevel(children[0]);
    }
    return {
      kind: "join",
      separator: " ^ ",
      renderOperands: children.map(
        (child) => () =>
          this.renderBinaryLevel(this.planBitwiseAndLevel(child)),
      ),
    };
  }

  private planBitwiseAndLevel(
    ctx: Parser.BitwiseAndExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.shiftExpression();
    if (children.length === 1) {
      return this.planShiftLevel(children[0]);
    }
    return {
      kind: "join",
      separator: " & ",
      renderOperands: children.map(
        (child) => () => this.renderBinaryLevel(this.planShiftLevel(child)),
      ),
    };
  }

  private planShiftLevel(
    ctx: Parser.ShiftExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.additiveExpression();
    if (children.length === 1) {
      return this.planAdditiveLevel(children[0]);
    }
    return {
      kind: "shift",
      operators: this.getOperatorsFromChildren(ctx),
      renderOperands: children.map(
        (child) => () => this.renderBinaryLevel(this.planAdditiveLevel(child)),
      ),
    };
  }

  private planAdditiveLevel(
    ctx: Parser.AdditiveExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.multiplicativeExpression();
    if (children.length === 1) {
      return this.planMultiplicativeLevel(children[0]);
    }
    return {
      kind: "arithmetic",
      constantValue: this.constantValue(ctx),
      defaultOperator: "+",
      operators: this.getOperatorsFromChildren(ctx),
      // Asked AFTER the operands render, which is where they are asked today.
      // Both read the typer over 1.4's settled declarations, so the order is
      // not load-bearing; it is kept because it is where the plan asks.
      clampType: () => this.compositeClampType(ctx),
      clampBehavior: () => this.compositeClampBehavior(ctx),
      adrLine: ctx.start?.line,
      renderOperands: children.map(
        (child) => () =>
          this.renderBinaryLevel(this.planMultiplicativeLevel(child)),
      ),
    };
  }

  /**
   * #1175: an arithmetic chain's value when it is a constant expression, by
   * the one evaluator, where the tree is in hand. Render used to fold the
   * generated C operand text with `parseInt`.
   *
   * Whether the chain overflows is 2.1's decision, at its destination's type
   * (E0910, ADR-044): one that reaches here fits it. So the value is computed
   * at the widest signed type, which then holds it exactly, and render needs
   * no destination of its own -- `i64 big <- 2147483647 + 1` is 2147483648,
   * which no i32 step could give (#1863 review).
   */
  private constantValue(ctx: ParserRuleContext): string | null {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lowerNode(ctx),
      dimensionEvalOptions(this.transpileState),
      WIDEST_SIGNED,
    );
    const value =
      result.kind === "value"
        ? ConstantEvaluator.toNumber(result.value)
        : undefined;
    return value === undefined ? null : String(value);
  }

  /**
   * #1668 (C6b): a composite's integer type, as the typer settled it -- the
   * answer 2.1's E0869 reads too -- so the clamp helper's width and the
   * conversion check cannot count a different set of operands
   */
  private compositeClampType(ctx: ParserRuleContext): string | null {
    const t = OperandTyper.typeOf(ctx, this.host.state.typingContext());
    return t?.bitWidth === null ? null : (t?.typeName ?? null);
  }

  /** #1668 (C6b): ADR-044's behavior for a composite, PlanTyping's row */
  private compositeClampBehavior(
    ctx: ParserRuleContext,
  ): TOverflowBehavior | null {
    const typing = this.host.state.typingContext();
    return PlanTyping.overflowOf(OperandTyper.valueLeaves(ctx, typing));
  }

  private planMultiplicativeLevel(
    ctx: Parser.MultiplicativeExpressionContext,
  ): TPlannedBinaryExpr {
    const children = ctx.unaryExpression();
    if (children.length === 1) {
      return {
        kind: "leaf",
        render: () => this.generateUnaryExpr(children[0]),
      };
    }
    return {
      kind: "arithmetic",
      constantValue: this.constantValue(ctx),
      defaultOperator: "*",
      operators: this.getOperatorsFromChildren(ctx),
      clampType: () => this.compositeClampType(ctx),
      clampBehavior: () => this.compositeClampBehavior(ctx),
      adrLine: ctx.start?.line,
      // `generateUnaryExpr` applies its own effects, so a leaf contributes
      // none here -- matching the empty array the multiplicative tail passed.
      renderOperands: children.map((child) => () => ({
        code: this.generateUnaryExpr(child),
        effects: [],
      })),
    };
  }

  generateOrExpr(ctx: Parser.OrExpressionContext): string {
    return this.invokeGenerator(generateBinaryExpr, this.planBinaryExpr(ctx));
  }

  /**
   * Get the enum type of an expression.
   * Part of IOrchestrator interface - delegates to private implementation.
   */
  getExpressionEnumType(ctx: Parser.ExpressionContext): string | null {
    // #1445: the resolver takes the expression's TEXT plus a thunk for the
    // struct-member-chain fallback, so it names no parse type. The walk stays
    // here, where the node is.
    //
    // The parameter was `ExpressionContext | RelationalExpressionContext`. The
    // second arm was dead: the only caller is `SwitchGenerator`, which passes
    // `node.expression()`. The resolver's `!("ternaryExpression" in ctx)` guard
    // existed to discriminate the union and could therefore never fire.
    //
    // #1668: the one operand typer's answer, which 2.1's ADR-017 rules read
    // too, so the case label and the E0428/E0434 checks cannot disagree
    // about whether the switch is on an enum. A header's enum has no C-Next
    // enum type: its members are global C names and need no qualifying.
    const t = OperandTyper.typeOf(ctx, this.host.state.typingContext());
    return t?.category === "enum" ? t.enumTypeName : null;
  }

  /**
   * Check if an expression is a string type.
   * Part of IOrchestrator interface.
   * ADR-045: Used to detect string comparisons and generate strcmp().
   * Issue #137: Extended to handle array element access (e.g., names[0])
   * Issue #1030: Extended to handle struct member access (e.g., person.name)
   */
  isStringExpression(ctx: Parser.RelationalExpressionContext): boolean {
    const text = ctx.getText();

    // Check for string literals
    if (text.startsWith('"') && text.endsWith('"')) {
      return true;
    }

    // Check if it's a simple variable of string type
    if (BareIdentifier.matches(text)) {
      const typeInfo = this.host.state.declarationTypeInfo(
        null,
        text,
        ParserUtils.getPosition(ctx),
      );
      if (typeInfo?.isString) {
        return true;
      }
    }

    // Issue #1030: Check for struct member access (e.g., person.name)
    if (this._isStructMemberStringExpression(text, ctx)) {
      return true;
    }

    // Issue #137: Check for array element access (e.g., names[0], arr[i])
    return this._isArrayAccessStringExpression(text, ctx);
  }

  /**
   * Check if array access expression evaluates to a string.
   * Extracted from isStringExpression to reduce cognitive complexity.
   */
  private _isArrayAccessStringExpression(
    text: string,
    ctx: Parser.RelationalExpressionContext,
  ): boolean {
    // Pattern: identifier[expression] or identifier[expression][expression]...
    // BUT NOT if accessing properties that return numbers, not strings
    const arrayAccessMatch = /^([a-zA-Z_]\w*)\[/.exec(text);
    if (!arrayAccessMatch) {
      return false;
    }

    // ADR-045/ADR-058: String/array properties return numeric values, not strings
    // ADR-058: .length deprecated, replaced by .bit_length, .byte_length,
    // .element_count, .char_count
    if (
      text.endsWith(".length") ||
      text.endsWith(".capacity") ||
      text.endsWith(".size") ||
      text.endsWith(".bit_length") ||
      text.endsWith(".byte_length") ||
      text.endsWith(".element_count") ||
      text.endsWith(".char_count")
    ) {
      return false;
    }

    const arrayName = arrayAccessMatch[1];
    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      arrayName,
      ParserUtils.getPosition(ctx),
    );
    if (!typeInfo) {
      return false;
    }

    // Check if it's an ARRAY OF STRINGS (not a single string being indexed)
    // A single string<50> has arrayDimensions=[51] (just the char buffer)
    // An array of strings string<50>[10] has arrayDimensions=[10, 51]
    // Single string indexing (e.g., userName[i]) returns a char, not a string
    // Array of strings indexing (e.g., names[0]) returns a string
    if (typeInfo.isString) {
      // For strings, only treat as string expression if it's an array of strings
      // (arrayDimensions.length > 1 means it's string<N>[M], not just string<N>)
      const dims = typeInfo.arrayDimensions;
      return Array.isArray(dims) && dims.length > 1;
    }

    // Non-string array with string base type
    return Boolean(
      typeInfo.isArray &&
      typeInfo.baseType &&
      TypeCheckUtils.isSizedStringName(typeInfo.baseType),
    );
  }

  /**
   * Check if struct member access expression evaluates to a string.
   * Issue #1030: Handles patterns like person.name, config.key
   */
  private _isStructMemberStringExpression(
    text: string,
    ctx: Parser.RelationalExpressionContext,
  ): boolean {
    // Pattern: identifier.identifier (simple member access)
    // Must not end with a property that returns a number
    if (
      text.endsWith(".char_count") ||
      text.endsWith(".capacity") ||
      text.endsWith(".size") ||
      text.endsWith(".length") ||
      text.endsWith(".bit_length") ||
      text.endsWith(".byte_length") ||
      text.endsWith(".element_count")
    ) {
      return false;
    }

    // Match simple struct.member pattern
    const memberMatch = /^([a-zA-Z_]\w*)\.([a-zA-Z_]\w*)$/.exec(text);
    if (!memberMatch) {
      return false;
    }

    const [, varName, fieldName] = memberMatch;

    // Get the struct variable's type
    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      varName,
      ParserUtils.getPosition(ctx),
    );
    if (!typeInfo) {
      return false;
    }

    // Get the struct type name - it might be directly the baseType
    // or we might need to look it up by the variable's type
    const structTypeName = typeInfo.baseType;
    if (!structTypeName) {
      return false;
    }

    // Look up the field type from the struct
    const fieldType = this.host.state.getStructFieldType(
      structTypeName,
      fieldName,
    );
    if (!fieldType) {
      return false;
    }

    // Check if the field is a string type (e.g., "string<64>")
    return fieldType.startsWith("string");
  }

  /**
   * Extract operators from parse tree children in correct order.
   * Part of IOrchestrator interface - delegates to ParserUtils.
   */
  getOperatorsFromChildren(ctx: ParserRuleContext): string[] {
    return ParserUtils.getOperatorsFromChildren(ctx);
  }

  /**
   * Get simple identifier from expression, or null if complex.
   * Part of IOrchestrator interface - delegates to ExpressionUnwrapper,
   * which is the single implementation (#1445).
   */
  getSimpleIdentifier(ctx: Parser.ExpressionContext): string | null {
    return ExpressionUnwrapper.getSimpleIdentifier(ctx);
  }

  /**
   * Generate function argument with pass-by-reference handling.
   * Part of IOrchestrator interface - delegates to ArgumentGenerator.
   */
  generateFunctionArg(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): string {
    const simpleId = this.boundArgumentName(ctx);
    const declared = this.nameTypeOf(ctx);
    // #1445: thunks closing over `ctx`. `ArgumentGenerator` never read a
    // member off the node -- it threaded it through five callbacks and four
    // private helpers only to hand it back -- so the node stays here, where
    // the tree already is.
    return ArgumentGenerator.generateArg(
      simpleId,
      declared,
      targetParamBaseType,
      {
        generateExpression: () => this.generateExpression(ctx),
        getLvalueType: () => this.getLvalueType(ctx),
        getMemberAccessArrayStatus: () => this.getMemberAccessArrayStatus(ctx),
        isCppMemberConversionRequired: (t) =>
          this.isCppMemberConversionRequired(ctx, t),
        isStringSubscriptAccess: () => this.isStringSubscriptAccess(ctx),
      },
      this.host.state,
    );
  }

  /**
   * A bare-name argument as written, and the C name the one binder gives it
   * (#1760 review): the same answer a read and an assignment target take,
   * through `TypeValidator.resolveBareIdentifier`.
   */
  private boundArgumentName(
    ctx: Parser.ExpressionContext,
  ): { readonly id: string; readonly emitted: string } | null {
    const id = ExpressionUnwrapper.getSimpleIdentifier(ctx);
    if (id === null) return null;
    return { id, emitted: this.boundName(id, ParserUtils.getPosition(ctx)) };
  }

  /** The C name a bare identifier at `at` is emitted under (ADR-057) */
  private boundName(id: string, at: ISourcePosition): string {
    return (
      TypeValidator.resolveBareIdentifier(
        id,
        at,
        (name: string) => this.host.isKnownStruct(name),
        this.host.state,
      ) ?? id
    );
  }

  /**
   * #1668 (C7): the declared type of what an expression NAMES -- a variable
   * spelled bare, `this.x`, `global.x` or `Scope.x`, with nothing applied to
   * it -- and undefined for anything else. The registry reads this replaces
   * were keyed by an argument's rendered text, which only ever matched a
   * name's.
   */
  private nameTypeOf(ctx: Parser.ExpressionContext): TTypeInfo | undefined {
    const typing = this.host.state.typingContext();
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (postfix === null) return undefined;
    const chain = OperandTyper.chainOf(postfix, typing);
    if (chain.steps.length !== DeclaredTypeInfo.nameSteps(chain)) {
      return undefined;
    }
    return DeclaredTypeInfo.ofChain(
      chain,
      typing.symbols,
      this.host.state.symbolTable,
      this.host.state.targetDescription,
    ).typeInfo;
  }

  /**
   * ADR-030 / #996: whether an argument is one element of an array held
   * through pointers -- `handles[i]` of a `Dev[4] handles`, however the array
   * is named: bare, `this.`, `global.`, or `Scope.` from outside the scope.
   * The array's own declaration says so (`isPointer` on an array of handles,
   * from `DeclaredPointer`), for a parameter, a file-scope, local or scope
   * variable, and one declared in an included file alike.
   */
  private isHandleArrayElement(ctx: Parser.ExpressionContext): boolean {
    const typing = this.host.state.typingContext();
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (postfix === null) return false;
    const chain = OperandTyper.chainOf(postfix, typing);
    const subscript = chain.steps[DeclaredTypeInfo.nameSteps(chain)];
    if (subscript?.subscript !== "array_element") return false;
    const array = DeclaredTypeInfo.ofChain(
      chain,
      typing.symbols,
      this.host.state.symbolTable,
      this.host.state.targetDescription,
    ).typeInfo;
    return (array?.isArray ?? false) && (array?.isPointer ?? false);
  }

  /**
   * Issue #304: Get the type of an expression.
   * Part of IOrchestrator interface.
   */
  getExpressionType(ctx: Parser.ExpressionContext): string | null {
    return this.directTypeOf(ctx);
  }

  /** #1668 (C6c): an expression's one type for 2.2, PlanTyping's row */
  private directTypeOf(ctx: ParserRuleContext): string | null {
    return PlanTyping.directTypeName(
      OperandTyper.typeOf(ctx, this.host.state.typingContext()),
    );
  }

  /**
   * The integer type an expression converts from: its one type, or a
   * composite's integer type -- the answer 2.1's E0869 reads
   */
  private integerTypeOf(ctx: ParserRuleContext): string | null {
    return this.directTypeOf(ctx) ?? this.compositeClampType(ctx);
  }

  /** Whether any value leaf is floating, or indeterminate (CompositeType) */
  private hasFloatingLeaf(ctx: ParserRuleContext): boolean {
    const typing = this.host.state.typingContext();
    return CompositeType.anyFloating(OperandTyper.valueLeaves(ctx, typing));
  }

  /**
   * Generate a block (curly braces with statements).
   * Part of IOrchestrator interface.
   */
  generateBlock(ctx: Parser.BlockContext): string {
    const lines: string[] = ["{"];
    const innerIndent = FormatUtils.indent(1); // One level of relative indentation

    for (const stmt of ctx.statement()) {
      // Temporarily increment for any nested context that needs absolute level
      this.host.state.indentLevel++;
      const stmtCode = this.generateStatement(stmt);
      this.host.state.indentLevel--;

      if (stmtCode) {
        // Add one level of indent to each line (relative indentation)
        const indentedLines = stmtCode
          .split("\n")
          .map((line) => innerIndent + line);
        lines.push(indentedLines.join("\n"));
      }
    }

    lines.push("}");

    return lines.join("\n");
  }

  /**
   * Generate a single statement.
   * Part of IOrchestrator interface.
   */
  generateStatement(ctx: Parser.StatementContext): string {
    let result = "";

    if (ctx.variableDeclaration()) {
      result = this.generateVariableDecl(ctx.variableDeclaration()!);
    } else if (ctx.assignmentStatement()) {
      result = this.generateAssignment(ctx.assignmentStatement()!);
    } else if (ctx.expressionStatement()) {
      result =
        this.generateExpression(ctx.expressionStatement()!.expression()) + ";";
    } else if (ctx.ifStatement()) {
      result = this.generateIf(ctx.ifStatement()!);
    } else if (ctx.whileStatement()) {
      result = this.generateWhile(ctx.whileStatement()!);
    } else if (ctx.doWhileStatement()) {
      result = this.generateDoWhile(ctx.doWhileStatement()!);
    } else if (ctx.forStatement()) {
      result = this.generateFor(ctx.forStatement()!);
    } else if (ctx.foreverStatement()) {
      result = this.generateForever(ctx.foreverStatement()!);
    } else if (ctx.switchStatement()) {
      result = this.generateSwitch(ctx.switchStatement()!);
    } else if (ctx.returnStatement()) {
      result = this.generateReturn(ctx.returnStatement()!);
    } else if (ctx.criticalStatement()) {
      // ADR-050: Critical statement for atomic multi-variable operations
      result = this.generateCriticalStatement(ctx.criticalStatement()!);
    } else if (ctx.block()) {
      result = this.generateBlock(ctx.block()!);
    }

    // Issue #250: Prepend any pending temp variable declarations (C++ mode)
    if (this.host.state.pendingTempDeclarations.length > 0) {
      const tempDecls = this.host.state.pendingTempDeclarations.join("\n");
      this.host.state.pendingTempDeclarations = [];
      return tempDecls + "\n" + result;
    }

    return result;
  }

  /**
   * Generate an assignment target.
   * Part of IOrchestrator interface.
   * Issue #387: Unified postfix chain - all patterns now use IDENTIFIER postfixTargetOp*
   *
   * @param opCount how many of the target's postfix operations to render;
   *        all of them unless given. A bit write renders its target without
   *        the final subscript through this same renderer (#1668 review), so
   *        a renamed local, a scope member or a struct parameter is spelled
   *        once, here.
   */
  generateAssignmentTarget(
    ctx: Parser.AssignmentTargetContext,
    opCount?: number,
  ): string {
    const hasGlobal = ctx.GLOBAL() !== null;
    const hasThis = ctx.THIS() !== null;
    const identifier = ctx.IDENTIFIER()?.getText();
    const postfixOps = ctx.postfixTargetOp().slice(0, opCount);

    // SonarCloud S3776: Use SimpleIdentifierResolver for simple identifier case
    if (!hasGlobal && !hasThis && postfixOps.length === 0 && identifier) {
      return SimpleIdentifierResolver.resolve(
        identifier,
        this._buildSimpleIdentifierDeps(),
        ParserUtils.getPosition(ctx),
      );
    }

    // Issue #779: Resolve bare scope member identifiers before postfix chain processing
    // This ensures scope members get their prefix even with array/member access.
    // Also skip known registers - they should be handled by the postfix chain builder
    // to enable proper register validation (requiring global. when shadowed).
    let resolvedIdentifier = identifier ?? "";
    if (!hasGlobal && !hasThis && identifier) {
      const isParameter = this.host.state.currentParameters.has(identifier);
      const isKnownRegister =
        this.host.state.symbols?.knownRegisters.has(identifier);
      // Issue #1100: Parameters with postfix ops (array/bit subscript, member
      // access) must resolve through the same dereference logic as a bare
      // parameter reference (ParameterDereferenceResolver), not skip it.
      // For array/struct/string/etc. parameters this is a no-op (they're
      // already pointer-like, matching the prior behavior verbatim — e.g.
      // `buf[idx]` stays `buf[idx]`). For a scalar parameter that became a
      // pointer because it's modified elsewhere in the function, a bit
      // access (`v[4] <- true`) now correctly dereferences to `(*v)[4]`
      // (which AssignmentContextBuilder reduces to base identifier `(*v)`)
      // instead of assigning through the raw pointer.
      if (isParameter) {
        const paramInfo = this.host.state.currentParameters.get(identifier)!;
        resolvedIdentifier = ParameterDereferenceResolver.resolve(
          identifier,
          paramInfo,
          this._buildParameterDereferenceDeps(),
        );
      } else if (!isKnownRegister) {
        // ADR-057: pass the REAL locality. Hardcoding `false` and skipping
        // locals entirely made this the write-side twin of
        // TypeValidator.resolveBareIdentifier rather than a caller of it, so a
        // shadowing local kept its bare name here while every read was
        // renamed -- `data[1] <- 5` wrote the global and `return data[1]` read
        // the local, in the same function, compiling clean.
        const resolved = TypeValidator.resolveBareIdentifier(
          identifier,
          ParserUtils.getPosition(ctx),
          (name: string) => this.host.isKnownStruct(name),
          this.host.state,
        );
        if (resolved !== null) {
          resolvedIdentifier = resolved;
        }
      }
    }

    // SonarCloud S3776: Use BaseIdentifierBuilder for base identifier
    const safeIdentifier = identifier ?? "";
    const { result: baseResult, firstId } = BaseIdentifierBuilder.build(
      hasGlobal || hasThis ? safeIdentifier : resolvedIdentifier,
      hasGlobal,
      hasThis,
      this.host.state.currentScopePath,
    );

    // No postfix operations - return base
    if (postfixOps.length === 0) {
      return baseResult;
    }

    // SonarCloud S3776: Use PostfixChainBuilder for postfix operations
    const operations = this._extractPostfixOperations(postfixOps);
    const postfixDeps = this._buildPostfixChainDeps(
      firstId,
      hasGlobal,
      hasThis,
      this.targetDeclaration(ctx).rootTypeInfo,
    );

    return PostfixChainBuilder.build(
      baseResult,
      firstId,
      operations,
      postfixDeps,
    );
  }

  /**
   * Generate array dimensions.
   * Part of IOrchestrator interface.
   */
  generateArrayDimensions(dims: Parser.ArrayDimensionContext[]): string {
    return dims.map((d) => this.generateArrayDimension(d)).join("");
  }

  /** Generate single array dimension */
  generateArrayDimension(dim: Parser.ArrayDimensionContext): string {
    // Bug #8 folded only at file scope, where C requires a constant size.
    // #1175: a dimension is a constant wherever it is written (ADR-023: no
    // VLAs), so it folds everywhere, by the one rule
    const expression = dim.expression();
    if (expression) {
      return `[${this.renderDimension(expression)}]`;
    }
    return "[]";
  }

  /** Generate parameter list for function signature */
  generateParameterList(ctx: Parser.ParameterListContext): string {
    return ctx
      .parameter()
      .map((p, index) => this.generateParameter(p, index))
      .join(", ");
  }

  /** Get the raw type name without C conversion */
  getTypeName(ctx: Parser.TypeContext): string {
    // #1285: one ladder. This was the largest of seven copies, and the only one
    // that handled `arrayType` by peeking at two of its six element
    // alternatives -- TypeBinding recurses into all of them.
    const resolved = TypeBinding.resolveName(
      ctx,
      this.host.state.currentScopePath,
      this.host.state.typeBindingDeps((identifiers) =>
        this.resolveQualifiedType(identifiers),
      ),
    );
    // #1508: the other half of ADR-010's promise. A cross-file declaration is
    // reached two ways -- it is CALLED, which the postfix generator records, or
    // its TYPE is named, which is this. A global variable cannot call anything
    // at file scope, so without this site the `global variable` contexts would
    // be permanently unoccupiable and would have had to be declared `off` --
    // recording a claim that an included type cannot be used for a global,
    // which is false.
    //
    // Both sites are one mechanism (provenance at the point of resolution), not
    // the two the matrix guidance warns against mixing: neither depends on a
    // diagnostic, and a fixture is credited once per position either way.
    if (resolved !== null && this.host.state.isCrossFileDeclaration(resolved)) {
      AdrProvenance.record("010", ctx.start?.line);
    }
    return resolved ?? ctx.getText();
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(ctx: Parser.ExpressionContext): number | undefined {
    // Issue #1127: the shared builder, not a fourth inline copy of the same
    // three lookups. This is the orchestrator entry point that
    // ArrayDimensionUtils uses to emit declaration dimensions, so it is on the
    // hot path for exactly the divergences this work closes.
    return this.dimensionValue(ctx);
  }

  /**
   * Get zero initializer for a type.
   * ADR-015: Get the appropriate zero initializer for a type
   * ADR-017: Handle enum types by initializing to first member
   */
  getZeroInitializer(typeCtx: Parser.TypeContext, isArray: boolean): string {
    // Issue #379 / #1004: arrays zero-init with the aggregate brace ({} in
    // C++, {0} in C) regardless of element type.
    if (isArray) {
      return this.host.getAggregateZeroInitBrace();
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this._resolveTypeNameFromContext(typeCtx);
    if (resolved) {
      // Check if enum
      if (this.host.state.symbols!.knownEnums.has(resolved.name)) {
        return this._getEnumZeroValue(resolved.name, resolved.separator);
      }
      // Issue #1004: struct/class zero-init. C++ value-initialization ({})
      // works for every aggregate (including ones whose first field is an
      // enum, where {0} is an invalid int->enum narrowing); C uses {0}.
      return this.host.getAggregateZeroInitBrace();
    }

    // Issue #295: C++ template types use value initialization {}
    if (typeCtx.templateType()) {
      return "{}";
    }

    // Issue #1019: string<N> types use empty string initializer
    if (typeCtx.stringType()) {
      return '""';
    }

    // Primitive types use lookup map
    if (typeCtx.primitiveType()) {
      const primType = typeCtx.primitiveType()!.getText();
      return CodeGenWalker.PRIMITIVE_ZERO_VALUES.get(primType) ?? "0";
    }

    // Default fallback
    return "0";
  }

  /**
   * The parameters a function's context registers, decided (#1445).
   *
   * Part of IOrchestrator: `ScopeGenerator` enters a context for a scoped
   * function, so planning at both call sites would be two derivations of one
   * parameter list.
   */
  planFunctionParameters(
    ctx: Parser.ParameterListContext | null,
  ): readonly IPlannedFunctionParameter[] | null {
    return (
      ctx?.parameter().map((param) => this.planFunctionParameter(param)) ?? null
    );
  }

  /**
   * ADR-029: the C type that a DECLARATION of this type emits.
   *
   * A function-as-type is declared by its `_fp` typedef; everything else is
   * itself. This is the single owner of that consequence, because #1484 showed
   * what happens when each declaration site decides it independently: a
   * parameter and a scope member mapped, a local variable did not, and a `for`
   * init declaration -- a separate grammar rule, `forVarDecl`, that
   * `VariableDeclarationContext` never matches -- did not either. Fixing one
   * site made it disagree with the declaration beside it in the same source.
   *
   * A fifth declaration site should call this rather than repeat the pairing.
   */
  generateDeclaredType(typeCtx: Parser.TypeContext): string {
    const declared = this.generateType(typeCtx);
    return this.host.getCallbackTypedefName(declared) ?? declared;
  }

  /**
   * Issues #1200, #1201: does this callback type need its `_fp` typedef emitted?
   *
   * True when the type is referenced by any field or parameter, not only by a
   * field of a top-level struct. Reading callbackFieldTypes alone missed
   * scope-nested struct fields, scope members and parameters, each of which
   * produced C that referenced a typedef nothing had emitted.
   *
   * This is an EMISSION question -- "must a typedef be written?" -- and it is
   * the only one left here. Its twin, ADR-029's nominal-typing question ("is
   * this function used as a field TYPE?"), was next to it until #1322 moved
   * that rule to pass 2.1 as E0880. The two were deliberately separate then
   * and are separate now for the same reason: merging them once widened the
   * nominal rule as a side effect and rejected a callback assignment that
   * transpiles on main.
   */
  /**
   * ADR-029 + #1491: emit typedefs for callback types this file NAMES but does
   * not DECLARE.
   *
   * `recordCallbackTypedef` fires when a function is emitted, so it covers
   * every type this file declares and none it reaches through an include. A
   * variable typed by an included function-as-type therefore referenced a
   * typedef nothing had emitted.
   *
   * It goes in the `.c`, not the header, unless this file's own public
   * interface names the type -- which `generateCallbackTypedef` already decides
   * via `headerOwnsCallbackTypedef`. That is the rule C libraries follow: a
   * header typedefs the callback types its API uses, and a type needed only
   * inside one translation unit stays there. It is also what stops two files
   * that both name the same included function-as-type from each exporting the
   * typedef and colliding in anything that includes both.
   */
  private emitTypedefsForUndeclaredCallbackTypes(): void {
    for (const funcName of this.host.state.callbackTypeReferences) {
      if (
        !this.host.state.callbackTypes.has(funcName) ||
        this.host.state.emittedCallbackTypedefs.has(funcName)
      ) {
        continue;
      }
      const typedef = this.host.generateCallbackTypedef(funcName);
      if (typedef) {
        this.host.state.pendingCallbackTypedefs.push(typedef);
        this.host.state.emittedCallbackTypedefs.add(funcName);
      }
    }
  }

  isMainFunctionWithArgs(
    name: string,
    paramList: Parser.ParameterListContext | null,
  ): boolean {
    return ParserUtils.isMainFunctionWithArgs(name, paramList);
  }

  /**
   * Issue #558: Check if a parameter is modified using analysis-phase results.
   * This is the unified source of truth for modification tracking.
   */
  private _isCurrentParameterModified(paramName: string): boolean {
    const funcName = this.host.state.currentFunctionName;
    if (!funcName) return false;
    // Through the state's predicate rather than inlining its body a fourth
    // time. The absent-artifact polarity is #1529/#1552's decision and belongs
    // in one place.
    return this.host.state.isParameterModified(funcName, paramName);
  }

  /**
   * Generate a primary expression.
   * Part of IOrchestrator interface for PostfixExpressionGenerator.
   */
  generatePrimaryExpr(ctx: Parser.PrimaryExpressionContext): string {
    // ADR-023: sizeof expression - sizeof(u32) or sizeof(variable)
    if (ctx.sizeofExpression()) {
      return this.generateSizeofExpr(ctx.sizeofExpression()!);
    }
    // ADR-017: Cast expression - (u8)State.IDLE
    if (ctx.castExpression()) {
      return generateCast(
        this.planCast(ctx.castExpression()!),
        this.host.state,
      );
    }
    // ADR-014: Struct initializer - Point { x: 10, y: 20 }
    if (ctx.structInitializer()) {
      return this.generateStructInitializer(ctx.structInitializer()!);
    }
    // ADR-035: Array initializer - [1, 2, 3] or [0*]
    if (ctx.arrayInitializer()) {
      return this.generateArrayInitializer(ctx.arrayInitializer()!);
    }

    // ADR-016: Handle 'this' keyword for scope-local reference
    const text = ctx.getText();
    if (text === "this") {
      return this._resolveThisKeyword();
    }

    // ADR-016: Handle 'global' keyword for global reference
    if (text === "global") {
      return "__GLOBAL_PREFIX__";
    }

    if (ctx.IDENTIFIER()) {
      const id = ctx.IDENTIFIER()!.getText();
      // #1322: `break`/`continue` (ADR-026, E0703) are rejected in pass 2.1.
      return this._resolveIdentifierExpression(
        id,
        ParserUtils.getPosition(ctx),
      );
    }
    if (ctx.literal()) {
      return this._generateLiteralExpression(ctx.literal()!);
    }
    if (ctx.expression()) {
      return `(${this.generateExpression(ctx.expression()!)})`;
    }
    return "";
  }

  /**
   * Issue #551: Check if a type is a known primitive type.
   * Known primitives use pass-by-reference with dereference.
   * Unknown types (external enums, typedefs) use pass-by-value.
   */
  private _isKnownPrimitive(typeName: string): boolean {
    return !!TYPE_MAP[typeName];
  }

  /**
   * PR #681: Build dependencies for parameter dereference resolution.
   * Used by ParameterDereferenceResolver to determine if parameters need dereferencing.
   */
  private _buildParameterDereferenceDeps(): IParameterDereferenceDeps {
    return {
      isFloatType: (typeName: string) => this._isFloatType(typeName),
      isKnownPrimitive: (typeName: string) => this._isKnownPrimitive(typeName),
      knownEnums: this.host.state.symbols!.knownEnums,
      isParameterPassByValue: (funcName: string, paramName: string) =>
        PassByValueAnalyzer.isParameterPassByValueByName(
          funcName,
          paramName,
          this.host.state,
        ),
      currentFunctionName: this.host.state.currentFunctionName,
      maybeDereference: (id: string) =>
        CppModeHelper.maybeDereference(id, this.host.state),
    };
  }

  /**
   * PR #681: Build dependencies for member separator resolution.
   * Used by MemberSeparatorResolver to determine appropriate separators.
   */
  private _buildMemberSeparatorDeps(): IMemberSeparatorDeps {
    return {
      isKnownScope: (name: string) => this.host.isKnownScope(name),
      isKnownRegister: (name: string) =>
        this.host.state.symbols!.knownRegisters.has(name),
      rootMemberSeparator: (holding: IRootHolding) =>
        memberAccessChain.rootMemberSeparator(holding, this.host.state.cppMode),
    };
  }

  /**
   * Issue #517: Check if a type is a C++ class with a user-defined constructor.
   * C++ classes with user-defined constructors are NOT aggregate types,
   * so designated initializers { .field = value } don't work with them.
   * We check for the existence of a constructor symbol (TypeName::ClassName).
   */
  private _isCppClassWithConstructor(typeName: string): boolean {
    return CppConstructorHelper.hasConstructor(
      typeName,
      this.host.state.symbolTable,
    );
  }

  /**
   * Issue #388: Resolve a qualified type from dot notation to the correct output format.
   * For C++ namespace types (like MockLib.Parse.ParseResult), uses :: separator.
   * For C-Next scope types (like Motor.State), uses _ separator.
   *
   * @param identifiers Array of identifier names forming the qualified type
   * @returns The resolved type name with appropriate separator
   */
  private resolveQualifiedType(identifiers: string[]): string {
    if (identifiers.length === 0) {
      return "";
    }

    const firstName = identifiers[0];

    // Check if the first identifier is a C++ scope symbol (namespace, class, enum)
    if (this.host.isCppScopeSymbol(firstName)) {
      // C++ namespace type: join all parts with ::
      return identifiers.join("::");
    }

    // C-Next scope type: join all parts with _
    return QualifiedCName.fromParts(identifiers);
  }

  /**
   * Generate C code from a C-Next program
   * @param tree The parsed C-Next program
   * @param tokenStream Optional token stream for comment preservation (ADR-043)
   * @param options Optional code generator options (e.g., debugMode)
   */
  generate(
    tree: Parser.ProgramContext,
    tokenStream?: CommonTokenStream,
    options?: ICodeGeneratorOptions,
  ): string {
    // ADR-049: the target is decided before codegen, by the orchestrator;
    // this walk only reads it.
    invariant(
      options?.targetDescription,
      "the pipeline always supplies options.targetDescription to generate(); its absence is a caller/API error, not a program error",
    );

    // Reset state for fresh generation (must be before any state assignments)
    this.resetGeneratorState(options.targetDescription);

    // Initialize options and configuration (after reset)
    this.initializeGenerateOptions(options, tokenStream);

    // ADR-055: Use pre-collected symbolInfo from Pipeline (TSymbolInfoAdapter)
    invariant(
      options?.symbolInfo,
      "the pipeline always supplies options.symbolInfo to generate(); its absence is a caller/API error, not a program error",
    );
    this.host.state.symbols = options.symbolInfo;

    // ADR-029 + #1491: register function-as-types reached through an include
    // BEFORE anything can reference one. Must run after `symbols` is set and
    // before the declaration walk, which registers this file's own functions
    // afterwards and correctly overwrites on a name collision.
    this.registerIncludedCallbackTypes();

    // Initialize symbol data
    this.initializeSymbolData();

    // Initialize all helper objects
    this.initializeHelperObjects(tree);

    // Assemble and return the output
    return this.assembleGeneratedOutput(tree, options);
  }

  /**
   * Initialize options and configuration for generate().
   */
  private initializeGenerateOptions(
    options: ICodeGeneratorOptions | undefined,
    tokenStream: CommonTokenStream | undefined,
  ): void {
    this.host.state.debugMode = options?.debugMode ?? false;
    this.host.state.sourcePath = options?.sourcePath ?? null;
    // #1241: Transpiler._analyzeFile sets the provenance file before analyzers
    // run; re-assert it here for API callers that drive the generator directly
    // and never go through that path. (Said `_transpileFile` until #1320
    // hoisted analysis out of it into its own pass -- by the time
    // `_transpileFile` runs, every file's analyzers are already done.)
    AdrProvenance.beginFile(this.host.state.sourcePath);
    this.host.state.cnxIncludeRewrites =
      options?.cnxIncludeRewrites ?? new Map<string, string>();
    this.host.state.includeKinds =
      options?.includeKinds ?? new Map<string, EFileType>();
    this.host.state.cppMode = options?.cppMode ?? false;
    this.host.state.pendingTempDeclarations = [];
    this.host.state.tempVarCounter = 0;
    this.host.state.pendingCppClassAssignments = [];

    this.tokenStream = tokenStream ?? null;
    this.commentExtractor = this.tokenStream
      ? new CommentScanner(this.tokenStream)
      : null;
  }

  /**
   * Reset all generator state for a fresh generation pass.
   */
  private resetGeneratorState(targetDescription: ITargetDescription): void {
    // One reset, because there is one state. Two classes stood here --
    // `CodeGenState.reset(targetCapabilities)` and `TranspilerState.reset()` --
    // and merging them under #1452 left the second call clobbering the first's
    // argument, so `--target` silently fell back to the default capabilities.
    this.host.state.reset(targetDescription);

    // Set generator reference for handlers to use
    // #1652 removed `ICodeGenApi`'s four parse-node members, and every one that
    // remains is implemented on the host. The walker used to be assigned here
    // and forward all five, which made a sixth member two places to write.
    this.host.state.generator = this.host;
  }

  /**
   * Initialize symbol data and const values from symbol table.
   */
  private initializeSymbolData(): void {
    const symbols = this.host.state.symbols!;

    // Copy symbol data to this.host.state.scopeMembers
    for (const [scopeName, members] of symbols.scopeMembers) {
      this.host.state.setScopeMembers(scopeName, new Set(members));
    }

    // #1664 box 7: const values are not seeded here. A dimension folds with
    // `dimensionEvalOptions(state, position)`, what 1.4 settled as visible
    // there.
  }

  /**
   * Initialize all helper objects needed for code generation.
   */
  private initializeHelperObjects(tree: Parser.ProgramContext): void {
    // Collect function/callback information
    this.collectFunctionsAndCallbacks(tree);
  }

  /**
   * Assemble the final generated output.
   */
  private assembleGeneratedOutput(
    tree: Parser.ProgramContext,
    options: ICodeGeneratorOptions | undefined,
  ): string {
    const output: string[] = [];

    // Issue #1143: every file carries its mode's baseline. Recorded here rather
    // than assumed by consumers, so "what does this file need?" has exactly one
    // answer source even for the trivial case.
    ToolchainRequirements.record(
      this.host.state.cppMode ? "baseline-cpp" : "baseline-c",
    );

    // 2.2 Plan's fact, recorded where it is KNOWN rather than recovered from
    // text. `captureEmissionFacts` used to regex `#include` lines back out of
    // the rendered `output` array, so a fact the parse tree carries was
    // serialized to text and re-derived from it -- the pass boundary running
    // backwards inside one method. Both producers append here instead.
    const sourceIncludeTargets: string[] = [];

    // Self-include for extern "C" linkage
    // Issue #1164: this used to ask a second predicate that saw only scope
    // members, so a file exporting types, consts or top-level functions got a
    // header nothing included. Same question, same answer source as the header
    // itself.
    // #1515: supplied by the caller, which asked `PublicInterface`. Not read
    // off `ICodeGenSymbols`, where 1.3 Declare used to put it.
    if (options?.hasPublicInterface && this.host.state.sourcePath) {
      const pathToUse =
        options?.sourceRelativePath ||
        this.host.state.sourcePath.replace(/^.*[\\/]/, "");
      // Issue #933: Use .hpp extension in C++ mode to match header file
      // Issue #1319: read the run's extension; do not re-derive it from the mode
      const ext = this.host.state.outputExtensions.header;
      const headerName = pathToUse.replace(/\.cnx$|\.cnext$/, ext);
      output.push(`#include "${headerName}"`, "");
      sourceIncludeTargets.push(`"${headerName}"`);
      this.host.state.selfIncludeAdded = true;
    }

    // Process include directives
    sourceIncludeTargets.push(...this.processIncludeDirectives(tree, output));

    // Process preprocessor directives
    this.processPreprocessorDirectives(tree, output);

    // 2.2 Plan: the declaration decisions, settled BEFORE anything is rendered.
    // Unlike the emission plan below, neither answer depends on what rendering
    // turns out to produce, so Render reads them rather than interpreting the
    // state they came from.
    this.host.state.declarationPlanOrNull = DeclarationPlan.build(
      tree.declaration().map((decl) => CodeGenWalker.declarationKindOf(decl)),
      this.host.state.selfIncludeAdded,
    );

    // Generate declarations
    const declarations = this.generateAllDeclarations(tree);

    // 2.2 Plan: every "does this file need X?" question the declarations above
    // raised is answered ONCE, here, from state that is warm for exactly this
    // long. Nothing below reads a `needs*` flag.
    const plan = EmissionPlan.build(
      this.captureEmissionFacts(sourceIncludeTargets),
    );

    // The plan decided WHICH toolchain capabilities these helpers need and at
    // which sites; registering them is part of that decision, not part of
    // formatting. `addGeneratedHelpers` used to do it while pushing the text,
    // which made the renderer a writer of state something downstream reads.
    CodeGenWalker.registerPlannedToolchain(plan);

    // 2.3 Render: format the plan. These two decide nothing.
    this.addAutoIncludes(output, plan);
    this.addGeneratedHelpers(output, plan);

    // Add the declarations
    output.push(...declarations);

    // Issue #1143: the banner is built last and prepended, because none of the
    // requirement state exists until generateAllDeclarations() above has run.
    // Computing it at the top -- where the banner used to be pushed -- could
    // only ever describe an empty requirement set.
    return [...this.buildBanner(), ...output].join("\n");
  }

  /**
   * The file's own header comment, including what its output costs.
   *
   * Only requirements above the mode's baseline are listed, so an ordinary C99
   * file is unchanged. The point is that the requirement travels with the
   * artifact: someone handed a generated .c can see what it needs without
   * having the .cnx, the transpiler, or this repository.
   *
   * Emitted on the .c/.cpp only. The companion header does not contain the
   * constructs -- the IRQ wrappers, the static asserts and the helpers are all
   * emitted into the implementation file -- so repeating the line there would
   * claim a cost the header does not carry.
   */
  private buildBanner(): readonly string[] {
    const sourcePath = this.host.state.sourcePath;
    const generatedLine = sourcePath
      ? ` * Generated by C-Next Transpiler from: ${basename(sourcePath)}`
      : " * Generated by C-Next Transpiler";

    const lines = ["/**", generatedLine, " * A safer C for embedded systems"];

    const requires = ToolchainRequirementUtils.describeForBanner(
      this.host.getToolchainRequirements(),
      this.host.state.cppMode ? "cpp" : "c",
    );
    for (const line of requires) {
      lines.push(` * ${line}`);
    }

    lines.push(" */", "");
    return lines;
  }

  /**
   * Process all include directives and add to output.
   */
  private processIncludeDirectives(
    tree: Parser.ProgramContext,
    output: string[],
  ): string[] {
    const targets: string[] = [];
    // #1322: ADR-010's two rejections (E0503, E0504) used to run here, with a
    // line number threaded in as a NUMBER and spent on `Line N` prose while the
    // diagnostic reported `1:0`. Both are decided in pass 2.1, which also means
    // the second derivation of the angle search path that stood on the line
    // above -- narrower than the one discovery built, and blind to `--include`
    // -- is gone rather than duplicated.
    for (const includeDir of tree.includeDirective()) {
      const leadingComments = this.getLeadingComments(includeDir);
      output.push(...this.formatLeadingComments(leadingComments));

      // Issue #850: Add MISRA suppression for banned headers
      const includeText = includeDir.getText();
      const suppression =
        MisraSuppressionUtils.getMisraSuppressionComment(includeText);
      if (suppression) {
        output.push(suppression);
      }
      const line = this.transformIncludeDirective(includeText);
      output.push(line);
      const target = CodeGenWalker.extractIncludeTarget(line);
      if (target !== null) {
        targets.push(target);
      }
    }

    if (tree.includeDirective().length > 0) {
      output.push("");
    }

    return targets;
  }

  /**
   * Process all preprocessor directives and add to output.
   */
  private processPreprocessorDirectives(
    tree: Parser.ProgramContext,
    output: string[],
  ): void {
    for (const ppDir of tree.preprocessorDirective()) {
      const leadingComments = this.getLeadingComments(ppDir);
      output.push(...this.formatLeadingComments(leadingComments));
      const result = this.processPreprocessorDirective(ppDir);
      if (result) {
        output.push(result);
      }
    }

    if (tree.preprocessorDirective().length > 0) {
      output.push("");
    }
  }

  /**
   * Generate all declarations from the tree.
   */
  /**
   * What a declaration is, in the terms 2.2 Plan's ordering asks about.
   *
   * The parse tree stops here: `DeclarationPlan` takes kinds, not contexts,
   * so a pass outside the parse layer does not grow a dependency on ANTLR to
   * answer a question about order (#1317).
   */
  private static declarationKindOf(
    decl: Parser.DeclarationContext,
  ): TDeclarationKind {
    if (decl.functionDeclaration() !== null) return "function";
    if (decl.scopeDeclaration() !== null) return "scope";
    return "other";
  }

  private generateAllDeclarations(tree: Parser.ProgramContext): string[] {
    const sourceOrder = tree.declaration();

    // Issue #1212, #1449, #1450: WHICH declaration the callback typedef block
    // precedes is decided by 2.2 Plan and read off the plan here. WHERE that
    // lands in the emitted array is arithmetic, and stays here -- the index
    // depends on how many leading-comment lines were pushed, which is a fact
    // about text rather than a decision about what C should exist.
    const precedes = this.host.state.declarationPlan().callbackTypedefsPrecede;

    const declarations: string[] = [];
    let firstFunctionIndex: number | null = null;

    for (const [index, decl] of sourceOrder.entries()) {
      const leadingComments = this.getLeadingComments(decl);
      declarations.push(...this.formatLeadingComments(leadingComments));

      if (index === precedes) {
        firstFunctionIndex = declarations.length;
      }

      const code = this.generateDeclaration(decl);
      if (code) {
        declarations.push(code);
      }
    }

    this.emitTypedefsForUndeclaredCallbackTypes();

    const typedefs = this.host.state.pendingCallbackTypedefs;
    if (typedefs.length > 0) {
      // One blank line either side of the block, and none between the typedefs
      // themselves -- they are one group of related declarations, and the
      // generated C is read by people auditing it.
      declarations.splice(
        firstFunctionIndex ?? declarations.length,
        0,
        "",
        ...typedefs,
        "",
      );
      this.host.state.pendingCallbackTypedefs = [];
    }

    return declarations;
  }

  /**
   * Add auto-generated includes based on usage.
   */
  /**
   * Print the system includes the plan decided on.
   *
   * Deliberately holds no condition. It used to hold five `if (needs*)` tests
   * plus a dedup that re-parsed `#include` lines already in `output` -- so the
   * emitted text was an input to the decision, and the answer depended on how
   * much of the file had been rendered. Both moved into `EmissionPlan`.
   */
  private addAutoIncludes(output: string[], plan: IEmissionPlan): void {
    if (plan.systemIncludes.length === 0) return;
    output.push(
      ...plan.systemIncludes.map((target) => `#include ${target}`),
      "",
    );
  }

  /**
   * Freeze this file's emission questions while `CodeGenState` still holds
   * them.
   *
   * The `.c` counterpart of `Transpiler._captureHeaderEmissionFacts`, and
   * captured at the same kind of moment: `this.host.state.reset()` runs per file,
   * so every field below is correct for exactly the window between this file's
   * declarations being generated and the next file's `generate()`.
   *
   * Nothing here reads rendered text. `existingIncludeTargets` arrives from the
   * two places that KNOW it -- the self-include, and `processIncludeDirectives`
   * as it walks the tree -- so the plan decides the final set rather than a
   * renderer subtracting one list from another, and no fact is recovered from
   * the output it was rendered into. This comment described the opposite until
   * `02df0e77`, which is the same commit that stopped it being true.
   */
  private captureEmissionFacts(
    existingIncludeTargets: readonly string[],
  ): IEmissionFacts {
    return {
      cppMode: this.host.isCppMode(),
      needsStdint: this.host.state.needsStdint,
      needsStdbool: this.host.state.needsStdbool,
      needsString: this.host.state.needsString,
      needsCMSIS: this.host.state.needsCMSIS,
      needsLimits: this.host.state.needsLimits,
      needsFloatStaticAssert: this.host.state.needsFloatStaticAssert,
      needsIrqWrappers: this.host.state.needsIrqWrappers,
      needsISR: this.host.state.needsISR,
      selfIncludeAdded: this.host.state.selfIncludeAdded,
      existingIncludeTargets,
      clampOps: this.host.state.usedClampOps,
      castHelpers: this.host.state.usedCastHelpers,
      safeDivOps: this.host.state.usedSafeDivOps,
      floatAssertSites: ToolchainRequirements.takeDeferredSites(
        "float_static_assert",
      ),
      irqWrapperSites: ToolchainRequirements.takeDeferredSites("irq_wrappers"),
    };
  }

  /**
   * Extract the include target (`<header.h>` or `"header.h"`) from a line,
   * or null if the line is not a plain `#include` directive.
   */
  private static extractIncludeTarget(line: string): string | null {
    const match = /^#include\s+(<[^>]+>|"[^"]+")\s*$/.exec(line.trim());
    return match ? match[1] : null;
  }

  /**
   * Add generated helpers (static asserts, IRQ wrappers, typedefs, etc.).
   */
  /**
   * Print the deferred blocks and helpers the plan decided on.
   *
   * Every `if` below tests a decision the plan already made, never a question.
   * The float assert's keyword arrives WITH the requirement key it costs, so
   * the two cannot disagree -- #1143 kept them in step by computing both from
   * one ternary at this site; the plan keeps them in step by making them two
   * fields of one record, and the ternary is gone from here.
   *
   * Requirements are still recorded into `CodeGenState` rather than read off
   * the plan by the banner, because the banner also carries requirements this
   * plan does not yet own (the mode baseline, C++ initializer forms, atomics).
   * Recording a decision someone else made is transcription, not derivation.
   */
  /**
   * Register the toolchain capabilities the plan's helper blocks need.
   *
   * Separated from `addGeneratedHelpers` so that rendering a block and
   * declaring what the block requires are not the same act: the plan already
   * holds both the keys and the sites, and a renderer that writes them is a
   * renderer making state visible downstream. Order is unchanged -- this runs
   * immediately after the plan is built, and nothing between reads a toolchain
   * requirement.
   */
  private static registerPlannedToolchain(plan: IEmissionPlan): void {
    for (const block of [plan.floatStaticAssert, plan.irqWrappers]) {
      if (block === null) continue;
      for (const key of block.requirements) {
        ToolchainRequirements.record(key, block.sites);
      }
    }
  }

  private addGeneratedHelpers(output: string[], plan: IEmissionPlan): void {
    const floatAssert = plan.floatStaticAssert;
    if (floatAssert !== null) {
      output.push(
        `${floatAssert.keyword}(sizeof(float) == 4, "Float bit indexing requires 32-bit float");`,
        `${floatAssert.keyword}(sizeof(double) == 8, "Float bit indexing requires 64-bit double");`,
        "",
      );
    }

    const irq = plan.irqWrappers;
    if (irq !== null) {
      output.push(...this.generateIrqWrappers());
    }

    if (plan.isrTypedef) {
      output.push(
        "/* ADR-040: ISR function pointer type */",
        "typedef void (*ISR)(void);",
        "",
      );
    }

    const helpers = this.generateOverflowHelpers(plan.clampOps);
    if (helpers.length > 0) {
      output.push(...helpers);
    }

    const safeDivHelpers = this.generateSafeDivHelpers(plan.safeDivOps);
    if (safeDivHelpers.length > 0) {
      output.push(...safeDivHelpers);
    }

    output.push(
      ...helperGenerators.generateCastHelpers(
        plan.castHelpers,
        this.host.isCppMode(),
      ),
    );
  }

  /**
   * ADR-010: Transform #include directives, converting .cnx to .h or .hpp
   * Delegates to IncludeGenerator
   * Issue #941: Now passes cppMode for .hpp extension in C++ mode
   * Issue #1467: passes the resolved include paths. Codegen does not decide
   * which header an include names -- PathResolver did, during discovery.
   */
  private transformIncludeDirective(includeText: string): string {
    return includeTransformIncludeDirective(includeText, {
      sourcePath: this.host.state.sourcePath,
      rewrites: this.host.state.cnxIncludeRewrites,
      kinds: this.host.state.includeKinds,
      headerExtension: this.host.state.outputExtensions.header,
    });
  }

  /**
   * Collect function and callback information.
   * Issue #60: Symbol collection extracted to SymbolCollector.
   * This method handles function signatures and callback types (not yet extracted).
   */
  private collectFunctionsAndCallbacks(tree: Parser.ProgramContext): void {
    for (const decl of tree.declaration()) {
      // ADR-016: Handle scope declarations for function tracking
      if (decl.scopeDeclaration()) {
        this._collectScopeFunctions(decl.scopeDeclaration()!);
        continue;
      }

      // ADR-029: Track callback field types in structs
      if (decl.structDeclaration()) {
        this._collectStructCallbackFields(decl.structDeclaration()!);
        continue;
      }

      // Track top-level functions
      if (decl.functionDeclaration()) {
        this._collectTopLevelFunction(decl.functionDeclaration()!);
      }
    }
  }

  /**
   * Collect scoped functions and their callback types
   */
  private _collectScopeFunctions(
    scopeDecl: Parser.ScopeDeclarationContext,
  ): void {
    const scopeName = scopeDecl.IDENTIFIER().getText();

    // Scope context for scoped type resolution (`this.Type`), restored on exit
    // even if a member throws.
    this.host.state.withScopePath(scopeName, () => {
      // #1281/#1285: functions first, THEN everything that can reference one.
      // A struct field naming a scope-local function-as-type is qualified through
      // isScopeType and then looked up in callbackTypes -- which this loop is
      // what fills. Walking members in source order made the answer depend on
      // whether the function happened to be declared above the struct, so
      // `Config` before `tickSource` resolved the field BARE and emitted a
      // header naming something that is not a type. Registering every function
      // before reading any reference makes the order irrelevant, which is the
      // same declaration-order invariant ADR-057 states for the symbols layer's
      // Pass 0b.
      for (const member of scopeDecl.scopeMember()) {
        const funcDecl = member.functionDeclaration();
        if (funcDecl) {
          // #1298: resolve the scope PATH rather than reading back mutable
          // state, so the generated name does not depend on when it is asked.
          this._registerScopeFunction(
            this.host.state.program?.scopePathOf(scopeName) ?? scopeName,
            funcDecl,
          );
        }
      }

      for (const member of scopeDecl.scopeMember()) {
        // Issue #1200: a struct nested in a scope has callback fields just like a
        // top-level one, and a scope member variable can itself be callback-typed.
        // Neither was walked here, so neither ever registered its type.
        if (member.structDeclaration()) {
          this._collectStructCallbackFields(member.structDeclaration()!);
          continue;
        }
        if (member.variableDeclaration()) {
          const varType = this.getTypeName(
            member.variableDeclaration()!.type(),
          );
          this.host.state.notePublicCallbackTypeReference(varType);
        }
      }
    });
  }

  /**
   * Register one scope function: its qualified name, signature, and ADR-029
   * callback type. Extracted so the pre-pass above and nothing else owns the
   * registration -- it must complete for every function in the scope before any
   * reference to one is resolved.
   */
  private _registerScopeFunction(
    declaringScopePath: string,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    const funcName = funcDecl.IDENTIFIER().getText();
    // Track fully qualified function name: Scope_function
    const fullName = QualifiedNameGenerator.forFunctionInScope(
      declaringScopePath,
      funcName,
      this.host.state.program,
    );
    this.host.state.knownFunctions.add(fullName);
    // ADR-013: Track function signature for const checking
    const sig = this.extractFunctionSignature(
      fullName,
      funcDecl.parameterList() ?? null,
    );
    this.host.state.functionSignatures.set(fullName, sig);
    // ADR-029: Register scoped function as callback type
    this.registerCallbackType(fullName, funcDecl);
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(funcDecl.block());
  }

  /**
   * Collect callback field types from struct declaration
   */
  private _collectStructCallbackFields(
    structDecl: Parser.StructDeclarationContext,
  ): void {
    const structName = structDecl.IDENTIFIER().getText();

    for (const member of structDecl.structMember()) {
      const fieldName = member.IDENTIFIER().getText();
      const fieldType = this.getTypeName(member.type());

      // Track callback field types (needed for typedef generation)
      if (this.host.state.callbackTypes.has(fieldType)) {
        this.host.state.callbackFieldTypes.set(
          `${structName}.${fieldName}`,
          fieldType,
        );
      }
      this.host.state.notePublicCallbackTypeReference(fieldType);
    }
  }

  /**
   * Collect top-level function and register as callback type
   */
  private _collectTopLevelFunction(
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    const name = funcDecl.IDENTIFIER().getText();
    this.host.state.knownFunctions.add(name);
    // ADR-013: Track function signature for const checking
    const sig = this.extractFunctionSignature(
      name,
      funcDecl.parameterList() ?? null,
    );
    this.host.state.functionSignatures.set(name, sig);
    // ADR-029: Register function as callback type
    this.registerCallbackType(name, funcDecl);
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(funcDecl.block());
  }

  /**
   * A parameter as the function CONTEXT needs it (#1445).
   *
   * Distinct from `planParameter`, which serves the signature adapter, and the
   * two disagree on purpose -- see `IPlannedFunctionParameter` for the two
   * places and why. This one's `isArray` admits either spelling, and its
   * dimensions are folded to VALUES for ADR-036 bounds checking rather than
   * rendered as C text.
   */
  private planFunctionParameter(
    ctx: Parser.ParameterContext,
  ): IPlannedFunctionParameter {
    const typeCtx = ctx.type();
    // Check both C-Next style (u8[8] param) and legacy style (u8 param[8])
    const cStyleDimensions = ctx.arrayDimension();
    const arrayType = typeCtx.arrayType();
    const isArray = cStyleDimensions.length > 0 || arrayType !== null;
    const stringType = arrayType
      ? arrayType.stringType()
      : typeCtx.stringType();
    const capacity = stringType?.INTEGER_LITERAL();

    return {
      name: ctx.IDENTIFIER().getText(),
      isConst: ctx.constModifier() !== null,
      isArray,
      arrayDimensions: this.foldParameterDimensions(
        cStyleDimensions,
        arrayType,
        isArray,
      ),
      stringCapacity: capacity
        ? Number.parseInt(capacity.getText(), 10)
        : undefined,
      type: this.planType(typeCtx),
    };
  }

  /**
   * A parameter's dimensions as VALUES, for ADR-036 bounds checking.
   *
   * Issue #1159: fold through the shared evaluator, and keep the slot when the
   * size does not fold so dimension i still matches subscript i.
   * `parseIntegerLiteral` alone folds literals only, so a const-sized
   * parameter recorded `UNRESOLVED_DIMENSION` and lost ADR-036 bounds checking
   * while the signature folded the same const -- `void fill(u8[SIZE] buf)`
   * emitted `uint8_t buf[6]` and still accepted `buf[9]`.
   */
  private foldParameterDimensions(
    cStyleDimensions: Parser.ArrayDimensionContext[],
    arrayType: Parser.ArrayTypeContext | null,
    isArray: boolean,
  ): readonly number[] {
    if (!isArray) return [];

    // C-style first, which E0874 admits only for `main(string args[])`.
    if (cStyleDimensions.length > 0) {
      // One entry per dimension: its value, or UNRESOLVED_DIMENSION for an
      // unsized `[]` -- never omitted, or every later dimension shifts
      return cStyleDimensions.map((dimension) => {
        const expression = dimension.expression();
        return (
          (expression && this.dimensionValue(expression)) ??
          UNRESOLVED_DIMENSION
        );
      });
    }

    if (!arrayType) return [];

    return arrayType.arrayTypeDimension().flatMap((dimension) => {
      const expression = dimension.expression();
      if (!expression) return [];
      return [this.dimensionValue(expression) ?? UNRESOLVED_DIMENSION];
    });
  }

  /**
   * ADR-013: Extract function signature from parameter list
   */
  private extractFunctionSignature(
    name: string,
    params: Parser.ParameterListContext | null,
  ): FunctionSignature {
    const parameters: Array<{
      name: string;
      baseType: string;
      isConst: boolean;
      isArray: boolean;
    }> = [];

    if (params) {
      for (const param of params.parameter()) {
        const paramName = param.IDENTIFIER().getText();
        const isConst = param.constModifier() !== null;
        // arrayDimension() returns an array (due to grammar's *), so check length
        // Also check C-Next style array type (e.g., u8[8] param)
        const isArray =
          param.arrayDimension().length > 0 ||
          param.type().arrayType() !== null;
        const baseType = this.getTypeName(param.type());
        // Issue #1201: a parameter naming a callback type needs that type's
        // typedef emitted, exactly as a struct field does.
        this.host.state.notePublicCallbackTypeReference(baseType);
        parameters.push({ name: paramName, baseType, isConst, isArray });
      }
    }

    return { name, parameters };
  }

  /**
   * ADR-029 / #1484: record the callback types named by LOCAL variable
   * declarations in a function body.
   *
   * The three sites that already record a reference -- struct fields, scope
   * member variables, and parameters via `extractFunctionSignature` -- all walk
   * DECLARATIONS. A local variable lives inside a statement, so none of them
   * reach it, and a callback type named only by a local had its `_fp` typedef
   * omitted from the very output that used it: correct type name, no typedef,
   * `unknown type name 'onTick_fp'`.
   *
   * Runs in the pre-pass rather than during generation because
   * `recordCallbackTypedef` consumes this set as each function is emitted; a
   * reference discovered while generating a later body would arrive after the
   * decision it exists to inform.
   */
  private _collectLocalCallbackTypeReferences(
    body: Parser.BlockContext | null,
  ): void {
    if (!body) {
      return;
    }
    const visit = (node: ParserRuleContext): void => {
      // Both declaration forms a body can hold. `forVarDecl` is its own
      // grammar rule, so a `for` init is NOT a VariableDeclarationContext --
      // missing it left `for (onTick f <- onTick; ...)` referencing a typedef
      // nothing emitted.
      if (
        node instanceof Parser.VariableDeclarationContext ||
        node instanceof Parser.ForVarDeclContext
      ) {
        this.host.state.callbackTypeReferences.add(
          this.getTypeName(node.type()),
        );
      }
      for (let i = 0; i < node.getChildCount(); i++) {
        const child = node.getChild(i);
        if (child instanceof ParserRuleContext) {
          visit(child);
        }
      }
    };
    visit(body);
  }

  /**
   * ADR-029: the typedef name for a function-as-type. One encoder, so the
   * declaration site and every reference cannot spell it differently.
   */
  private static callbackTypedefName(functionName: string): string {
    return `${functionName}_fp`;
  }

  /**
   * ADR-029 + ADR-006: what one parameter of a callback typedef MEANS -- its
   * rendered type and its pointer semantics.
   *
   * Extracted because two callers build an `ICallbackTypeInfo`: the parse-tree
   * path, for functions declared in this file, and the symbol path, for
   * functions reached through an include (#1491). They differ only in how they
   * OBTAIN a type name. What they must not differ on is what that name means,
   * and two copies of this decision could only ever agree by coincidence.
   *
   * `renderType` is a thunk on purpose: the parse-tree renderer records
   * required includes as a side effect, and the callback branch must not fire
   * it -- it did not before this was extracted, and eager evaluation would add
   * an include nobody asked for.
   */
  private callbackParamShape(
    typeName: string,
    isArray: boolean,
    renderType: () => string,
  ): {
    type: string;
    isStruct: boolean;
    isString: boolean;
    isOpaqueHandle: boolean;
  } {
    // ADR-006: struct-ness drives reference semantics.
    const isStruct = this.host.isKnownStruct(typeName);

    // ADR-029: a parameter whose type is itself a function-as-type.
    const cbInfo = this.host.state.callbackTypes.get(typeName);
    if (cbInfo) {
      // Function pointers are already pointers.
      return {
        type: cbInfo.typedefName,
        isStruct,
        isString: false,
        isOpaqueHandle: false,
      };
    }

    // ADR-045: a `string<N>` parameter is `char*` in C. Decided HERE, not in
    // either caller's renderer, because that is where the two disagreed: the
    // parse-tree renderer answered `char` (the ELEMENT type) and the symbol
    // renderer answered `string<8>` (C-Next surface syntax, not C at all, and
    // rejected by cc while the transpiler exited 0). Both are now wrong in one
    // place instead of differently wrong in two -- which is the property this
    // method exists to hold, and the one its comment already claimed.
    if (!isArray && TypeCheckUtils.isSizedStringName(typeName)) {
      return {
        type: "char*",
        isStruct: false,
        isString: true,
        isOpaqueHandle: false,
      };
    }

    // ADR-030: an opaque handle is a pointer in the typedef exactly as it is in
    // the prototype -- `Dev*` in C and C++ alike, and an array of them an array
    // of pointers (#996). The typedef IS the function's type, so it reads the
    // decision the prototype reads rather than asking struct-ness, which never
    // answered for an incomplete type: `typedef void (*aPoke_fp)(Dev)` stood
    // beside `void aPoke(Dev* d)`. Not ADR-006 reference semantics, so not
    // `isStruct` -- which is also what keeps an unmodified handle free of the
    // auto-const its prototype never takes.
    if (this.host.state.isHeldThroughPointer(typeName)) {
      return {
        type: renderType(),
        isStruct: false,
        isString: false,
        isOpaqueHandle: true,
      };
    }

    // ADR-006: a struct parameter is a pointer in C and a reference in C++,
    // which the formatter spells from `isStruct`.
    return {
      type: renderType(),
      isStruct,
      isString: false,
      isOpaqueHandle: false,
    };
  }

  /**
   * ADR-029 + #1491: a function reached through an include is a type HERE too.
   *
   * `registerCallbackType` walks only this file's own declarations, so an
   * included function-as-type was never registered and a variable declared
   * with it emitted the FUNCTION's name where a type belongs --
   * `sharedHelper viaInclude` rather than `sharedHelper_fp viaInclude` -- which
   * does not compile. The analyzer half of the same bug reported the call as
   * E0422; fixing that alone only moved the failure from cnext to cc.
   *
   * The signature is READ FROM THE SYMBOL, not re-derived from a parse tree
   * this file does not have -- "after 1.3, nothing may compute a symbol's
   * name." That is also what makes it safe: a symbol's `arrayDimensions` are
   * already const-folded, which is the property the parse-tree path works to
   * establish for MISRA Rule 18.8.
   *
   * Registration is unconditional; EMISSION stays gated by
   * `headerOwnsCallbackTypedef`, which intersects with `callbackTypeReferences`.
   * So a visible function nobody uses as a type still yields no typedef and
   * cannot trip MISRA Rule 2.3 (unused type declarations).
   *
   * Local declarations register afterwards and overwrite, which is the right
   * precedence: a name declared here wins over the same name reached through
   * an include.
   */
  private registerIncludedCallbackTypes(): void {
    const symbols = this.host.state.symbols;
    if (!symbols) {
      return;
    }

    // The per-file VISIBLE set: what this file declares, plus what its includes
    // contribute via mergeExternalSymbols. Keyed by transpiled C name.
    for (const cName of symbols.functionReturnTypes.keys()) {
      if (this.host.state.callbackTypes.has(cName)) {
        continue;
      }

      // Run-wide identity lookup -- the exact-name index, never the bare-name
      // one, which returns empty for every scoped symbol (#1139).
      const symbol = this.host.state.symbolTable
        .getOverloadsByCName(cName)
        .find(
          (candidate) =>
            candidate.sourceLanguage === ESourceLanguage.CNext &&
            SymbolGuards.isFunction(candidate as TSymbol),
        ) as IFunctionSymbol | undefined;

      if (symbol) {
        this.host.state.callbackTypes.set(
          cName,
          this.callbackInfoFromSymbol(cName, symbol),
        );
      }
    }
  }

  /**
   * Build an `ICallbackTypeInfo` from a resolved function symbol.
   *
   * The symbol carries the resolved return type and parameters, so nothing here
   * re-resolves a name. Parameter meaning is delegated to `callbackParamShape`,
   * the same decision the parse-tree path makes.
   */
  private callbackInfoFromSymbol(
    cName: string,
    symbol: IFunctionSymbol,
  ): ICallbackTypeInfo {
    const toCType = (typeName: string): string =>
      CNEXT_TO_C_TYPE_MAP[typeName] ?? typeName;

    return {
      functionName: cName,
      returnType: toCType(SymbolTypeResolver.getTypeName(symbol.returnType)),
      parameters: symbol.parameters.map((param) => {
        const typeName = SymbolTypeResolver.getTypeName(param.type);
        // Spread, not re-listed: a field the shape gains reaches this builder
        // and the parse-tree one alike (#1552 was one of them dropping one).
        const shape = this.callbackParamShape(typeName, param.isArray, () =>
          toCType(typeName),
        );
        return {
          name: param.name,
          ...shape,
          isConst: CodeGenWalker.typedefParamIsConst(
            cName,
            param.name,
            param.isConst,
            shape.isStruct,
            shape.isString,
            this.host.state,
          ),
          isArray: param.isArray,
          // Already folded to literals by the symbols layer, which is exactly
          // what MISRA Rule 18.8 needs -- a dimension that is still an
          // identifier makes the typedef a variably-modified type.
          arrayDims: (param.arrayDimensions ?? [])
            .map((dimension) => `[${dimension}]`)
            .join(""),
        };
      }),
      typedefName: CodeGenWalker.callbackTypedefName(cName),
    };
  }

  /**
   * ADR-029: is this `_fp` typedef parameter const?
   *
   * THE decision for both typedef emitters -- the local one below, which reads
   * a parse tree, and `callbackInfoFromSymbol`, which reads a resolved symbol
   * for a function reached through an include. They already shared the
   * parameter SHAPE via `callbackParamShape`; sharing the shape while each
   * re-derived the const is what let them disagree with the prototype, and
   * with each other, at the same time:
   *
   * - the local path asked the per-file accumulator during the declaration
   *   walk, before any body had filled it, so a modifying body read as
   *   unmodified and the typedef gained a `const` the prototype lacked (#1529)
   * - the included path asked the symbol's `isAutoConst`, which only ever gets
   *   set on the header's own copy of a parameter, so it was absent and the
   *   typedef LOST a `const` the declaring file had emitted (#1552). Both files
   *   then defined one typedef name incompatibly -- a hard `error: conflicting
   *   types`, not a warning, at transpile exit 0
   *
   * Auto-const (#268) qualifies only what the prototype renders as a pointer,
   * which for a typedef parameter is a struct or a string.
   */
  private static typedefParamIsConst(
    funcName: string,
    paramName: string,
    isExplicitConst: boolean,
    isStruct: boolean,
    isString: boolean,
    state: TranspileState,
  ): boolean {
    if (isExplicitConst) {
      return true;
    }
    if (!isStruct && !isString) {
      return false;
    }
    return !state.isParameterModifiedAnywhere(funcName, paramName);
  }

  /**
   * ADR-029: Register a function as a callback type
   * The function name becomes both a callable function and a type for callback fields
   */
  private registerCallbackType(
    name: string,
    funcDecl: Parser.FunctionDeclarationContext,
  ): void {
    const returnType = this.generateType(funcDecl.type());
    const parameters: ICallbackTypeInfo["parameters"] = [];

    if (funcDecl.parameterList()) {
      for (const param of funcDecl.parameterList()!.parameter()) {
        const paramName = param.IDENTIFIER().getText();
        const typeName = this.getTypeName(param.type());
        const isConst = param.constModifier() !== null;
        const dims = param.arrayDimension();
        const arrayTypeCtx = param.type().arrayType();
        const isArray = dims.length > 0 || arrayTypeCtx !== null;

        // Spread below, not re-listed, exactly as `callbackInfoFromSymbol`
        // does: a field the shape gains reaches both typedef builders.
        const shape = this.callbackParamShape(typeName, isArray, () =>
          this.generateType(param.type()),
        );

        // The typedef must carry the SAME const the prototype carries, or the
        // two are incompatible pointer types and every assignment of the
        // function to a variable of its own type warns. One decision, shared
        // with the included-function path below -- #1529 and #1552 were this
        // expression and its twin disagreeing with the prototype in OPPOSITE
        // directions, which is what a second derivation of one fact buys.
        const isEffectivelyConst = CodeGenWalker.typedefParamIsConst(
          name,
          paramName,
          isConst,
          shape.isStruct,
          shape.isString,
          this.host.state,
        );

        let arrayDims: string;
        if (dims.length > 0) {
          arrayDims = dims.map((d) => this.generateArrayDimension(d)).join("");
        } else if (arrayTypeCtx) {
          // Generate all dimensions from arrayType (supports multi-dimensional)
          // Issue #1127: fold the same way ParameterInputAdapter does. Emitting
          // the identifier here made one const render two ways in a single .c
          // -- `void OnData(uint8_t buf[6])` beside
          // `typedef void (*OnData_fp)(uint8_t buf[SIZE])` -- and the typedef
          // form is a variably-modified type, which MISRA C:2012 Rule 18.8
          // forbids and which gcc warns about under its variable-length-array
          // diagnostic.
          arrayDims = arrayTypeCtx
            .arrayTypeDimension()
            .map((d) => {
              const expr = d.expression();
              if (!expr) {
                return "[]";
              }
              return `[${this.renderDimension(expr)}]`;
            })
            .join("");
        } else {
          arrayDims = "";
        }
        parameters.push({
          name: paramName,
          ...shape,
          isConst: isEffectivelyConst,
          isArray,
          arrayDims,
        });
      }
    }

    this.host.state.callbackTypes.set(name, {
      functionName: name,
      returnType,
      parameters,
      typedefName: CodeGenWalker.callbackTypedefName(name),
    });
  }

  /**
   * ADR-029: Check if a function is used as a callback type (field type in a struct)
   */
  /**
   * ADR-017: Check if an expression represents an integer literal or numeric type.
   * Used to detect comparisons between enums and integers.
   */
  /**
   * ADR-045: Check if an expression is a string concatenation.
   *
   * #1445: the shape question is `ExpressionUnwrapper`'s and the capacity
   * question is `StringOperationsHelper`'s, so neither has to hold both.
   */
  private _getStringConcatOperands(
    ctx: Parser.ExpressionContext,
  ): IStringConcatOps | null {
    const operands = ExpressionUnwrapper.getAdditionOperandTexts(ctx);
    if (operands === null) return null;

    return StringOperationsHelper.getStringConcatOperands(
      operands[0],
      operands[1],
      this.declaredTypeAt(ctx),
    );
  }

  /**
   * ADR-045: Check if an expression is a substring extraction.
   *
   * The indexes go over as a thunk rather than as generated code: generating
   * one queues a pending temp declaration in some shapes, and only the helper
   * knows whether this is a substring at all. See its comment.
   */
  private _getSubstringOperands(
    ctx: Parser.ExpressionContext,
  ): ISubstringOps | null {
    const subscript = ExpressionUnwrapper.getSubscriptedIdentifier(ctx);
    if (subscript === null) return null;

    return StringOperationsHelper.getSubstringOperands(
      subscript.name,
      () => subscript.indexes.map((index) => this.generateExpression(index)),
      this.declaredTypeAt(ctx),
    );
  }

  /**
   * #1668 (C7): a bare name's declared type where `ctx` is, for a helper
   * that holds only an operand's text
   */
  private declaredTypeAt(
    ctx: ParserRuleContext,
  ): (name: string) => TTypeInfo | undefined {
    const at = ParserUtils.getPosition(ctx);
    return (name) => this.host.state.declarationTypeInfo(null, name, at);
  }

  private _isFloatType(typeName: string): boolean {
    return TypeCheckUtils.isFloat(typeName);
  }

  /**
   * Check if an expression is an lvalue that needs & when passed to functions.
   * This includes member access (cursor.x) and array access (arr[i]).
   * Returns the type of lvalue or null if not an lvalue.
   */
  private getLvalueType(
    ctx: Parser.ExpressionContext,
  ): "member" | "array" | null {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return null;

    const ops = postfix.postfixOp();
    const result = CppMemberHelper.getLastPostfixOpType(
      this._toPostfixOps(ops),
    );

    // Function calls are not lvalues
    if (result === "function") return null;
    return result;
  }

  /**
   * Does this member access need a temp variable in C++ mode?
   *
   * Issue #251/#252/#256. True when passing a struct member to a function would
   * fail C++ compilation:
   * 1. Const struct parameter member -> non-const parameter (const T* -> T* invalid)
   * 2. External C struct members of bool/enum type -> u8 parameter (type mismatch)
   * 3. Array element member access (arr[i].member) with external struct elements
   *
   * #1450: this REPORTS `CppMemberHelper`'s answer, which is 2.2 Plan's. All
   * that happens here is parse-tree navigation -- unwrap the postfix, find the
   * base identifier, and pick WHICH of the two Plan questions applies. Named
   * `isCppMemberConversionRequired` until the #1589 review, which is the spelling
   * that says this module decides it.
   */
  private isCppMemberConversionRequired(
    ctx: Parser.ExpressionContext,
    targetParamBaseType?: string,
  ): boolean {
    if (!this.host.state.cppMode) return false;
    if (!targetParamBaseType) return false;

    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return false;

    const primary = postfix.primaryExpression();
    if (!primary) return false;
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const ops = postfix.postfixOp();

    // Case 1: Direct parameter member access (cfg.value)
    const paramInfo = this.host.state.currentParameters.get(baseId);
    if (paramInfo) {
      return CppMemberHelper.needsParamMemberConversion(
        paramInfo,
        targetParamBaseType,
      );
    }

    // Case 2: Array element or function return member access
    return this.isComplexMemberConversionRequired(
      ops,
      baseId,
      targetParamBaseType,
      postfix,
    );
  }

  /**
   * Convert parser PostfixOpContext to IPostfixOp interface for CppMemberHelper.
   */
  private _toPostfixOps(ops: Parser.PostfixOpContext[]): IPostfixOp[] {
    return ops.map((op) => ({
      hasExpression: op.expression() !== null,
      hasIdentifier: op.IDENTIFIER() !== null,
      hasArgumentList: op.argumentList() !== null,
      textEndsWithParen: op.getText().endsWith(")"),
    }));
  }

  /**
   * Case 2: array element or function return member access -- arr[i].member,
   * getConfig().member (issue #256).
   *
   * Gathers the inputs `CppMemberHelper` needs (the variable's type info, the
   * postfix ops adapted to `IPostfixOp`) and reports its answer.
   */
  private isComplexMemberConversionRequired(
    ops: Parser.PostfixOpContext[],
    baseId: string,
    targetParamBaseType: string,
    at: Parser.PostfixExpressionContext,
  ): boolean {
    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      baseId,
      ParserUtils.getPosition(at),
    );
    return CppMemberHelper.needsComplexMemberConversion(
      this._toPostfixOps(ops),
      typeInfo,
      targetParamBaseType,
    );
  }

  /**
   * Issue #246: Check if an expression is a subscript access on a string variable.
   * For example, buf[0] where buf is a string<N>.
   * Used to determine when to cast char* to uint8_t* etc.
   */
  private isStringSubscriptAccess(ctx: Parser.ExpressionContext): boolean {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return false;

    const ops = postfix.postfixOp();
    const hasPostfixOps = ops.length > 0;
    const lastOpHasExpression =
      hasPostfixOps && ops.at(-1)!.expression() !== null;

    // Get the base identifier
    const primary = postfix.primaryExpression();
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return false;

    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      baseId,
      ParserUtils.getPosition(postfix),
    );
    const paramInfo = this.host.state.currentParameters.get(baseId);

    return CppMemberHelper.isStringSubscriptPattern(
      hasPostfixOps,
      lastOpHasExpression,
      typeInfo,
      paramInfo?.isString ?? false,
    );
  }

  /**
   * Issue #308: Check if a member access expression is accessing an array member.
   * For example, result.data where data is a u8[6] array member.
   * When passing such expressions to functions, the array should naturally decay
   * to a pointer, so we should NOT add & operator.
   *
   * Note: Currently handles single-level member access only (e.g., result.data).
   * Nested access like outer.inner.data would require traversing the postfix chain
   * to resolve intermediate struct types. This is acceptable since issue #308
   * involves single-level access patterns.
   *
   * Issue #355: Check if struct field info is available for a member access.
   * Used for defensive code generation - when we don't have field info,
   * we skip potentially dangerous conversions.
   *
   * @returns "array" if definitely an array, "not-array" if definitely not,
   *          "unknown" if struct field info is not available
   */
  private getMemberAccessArrayStatus(
    ctx: Parser.ExpressionContext,
  ): "array" | "not-array" | "unknown" {
    const postfix = ExpressionUnwrapper.getPostfixExpression(ctx);
    if (!postfix) return "not-array";

    const ops = postfix.postfixOp();
    if (ops.length === 0) return "not-array";

    // Last operator must be member access (.identifier)
    const lastOp = ops.at(-1)!;
    const memberName = lastOp.IDENTIFIER()?.getText();
    if (!memberName) return "not-array";

    // Get the base identifier to find the struct type
    const primary = postfix.primaryExpression();
    if (!primary) return "not-array";
    const baseId = primary.IDENTIFIER()?.getText();
    if (!baseId) return "not-array";

    // Look up the struct type from either:
    // 1. The declaration the name binds here (#1668)
    // 2. Parameter: currentParameters.get(baseId).baseType
    let structType: string | undefined;

    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      baseId,
      ParserUtils.getPosition(postfix),
    );
    if (typeInfo) {
      structType = typeInfo.baseType;
    } else {
      const paramInfo = this.host.state.currentParameters.get(baseId);
      if (paramInfo) {
        structType = paramInfo.baseType;
      }
    }

    if (!structType) return "not-array";

    // Check if this struct member is an array
    const memberInfo = this.host.getMemberTypeInfo(structType, memberName);

    // Issue #355: If memberInfo is undefined, we don't have struct field info
    // This could mean the header wasn't parsed - return "unknown" for defensive generation
    if (!memberInfo) {
      return "unknown";
    }

    return memberInfo.isArray ? "array" : "not-array";
  }

  private generateDeclaration(ctx: Parser.DeclarationContext): string {
    // ADR-016: Handle scope declarations (renamed from namespace)
    if (ctx.scopeDeclaration()) {
      return this.generateScope(ctx.scopeDeclaration()!);
    }
    if (ctx.registerDeclaration()) {
      return this.generateRegister(ctx.registerDeclaration()!);
    }
    // Issue #369: Skip struct/enum/bitmap definitions when self-include is added
    // These types will be defined in the included header file
    // Issue #1164: the struct generator decides for itself what a self-include
    // suppresses. Returning early here also skipped its callback-field effects
    // and dropped the ADR-029 init function, which the header never carries.
    if (ctx.structDeclaration()) {
      return this.generateStruct(ctx.structDeclaration()!);
    }
    // ADR-017: Handle enum declarations
    if (ctx.enumDeclaration()) {
      return this.generateEnum(ctx.enumDeclaration()!);
    }
    // ADR-034: Handle bitmap declarations
    if (ctx.bitmapDeclaration()) {
      return this.generateBitmap(ctx.bitmapDeclaration()!);
    }
    if (ctx.functionDeclaration()) {
      return this.generateFunction(ctx.functionDeclaration()!);
    }
    if (ctx.variableDeclaration()) {
      return this.generateVariableDecl(ctx.variableDeclaration()!) + "\n";
    }
    return "";
  }

  /**
   * The kinds a generated header can DEFINE, in the order it emits their
   * sections (#1300). Iterating kind-outer is what gives the `.c` the header's
   * ordering: a struct naming an enum declared below it must still come second,
   * and the two files disagreeing on that was an exit-0 miscompile.
   */
  private static readonly SCOPE_TYPE_KINDS: ReadonlyArray<{
    readonly kind: IPlannedScope["typeDefinitions"][number]["kind"];
    readonly declarationOf: (
      member: Parser.ScopeMemberContext,
    ) => { IDENTIFIER(): { getText(): string } } | null;
  }> = [
    { kind: "enum", declarationOf: (m) => m.enumDeclaration() },
    { kind: "bitmap", declarationOf: (m) => m.bitmapDeclaration() },
    { kind: "struct", declarationOf: (m) => m.structDeclaration() },
  ];

  /**
   * An ADR-016 scope: its members, and the types it contributes to the `.c`.
   *
   * Everything a member RENDERS is left unevaluated. `generateScope` calls
   * `setCurrentScope` before it renders anything, and every type name resolves
   * against the path that sets -- a bare `Flags` inside `scope Chip` is
   * `Chip__Flags`. Resolving one here would resolve it against the OUTER path
   * and emit the wrong name with nothing failing.
   *
   * What IS decided here is the structure: which members exist, which kind each
   * is, which types the header already defines, and whether Issue #282 skips a
   * private const scalar. Those are pure reads of the declaration.
   */
  private planScope(ctx: Parser.ScopeDeclarationContext): IPlannedScope {
    const name = ctx.IDENTIFIER().getText();

    // #1298: thread the whole scope PATH, not a leaf name, so every member
    // qualifies against every outer component instead of re-joining one level.
    // `getOrCreateScope` is the same resolver `setCurrentScopeByPath` uses, and
    // it is cached, so this is one decision asked twice -- not two decisions.
    const declaringScopePath =
      this.host.state.program?.scopePathOf(name) ?? name;
    const members = ctx.scopeMember();

    return {
      name,
      declaringScopePath,
      typeDefinitions: this.planScopeTypeDefinitions(
        members,
        declaringScopePath,
      ),
      members: members.map((member) =>
        this.planScopeMember(member, declaringScopePath),
      ),
    };
  }

  /**
   * #1300: the types this scope defines in the `.c` -- the complement of what
   * the header defines, asked per symbol rather than re-derived from
   * visibility. Those two answers agree only until a public signature drags a
   * private type into the header, and then the type is defined twice and the C
   * compiler rejects it.
   */
  private planScopeTypeDefinitions(
    members: readonly Parser.ScopeMemberContext[],
    declaringScopePath: string,
  ): IPlannedScope["typeDefinitions"] {
    return CodeGenWalker.SCOPE_TYPE_KINDS.flatMap(({ kind, declarationOf }) =>
      members
        .map(declarationOf)
        .filter((declaration) => declaration !== null)
        .map((declaration) =>
          this.scopeTypeCNameIfAbsentFromHeader(
            declaration!,
            declaringScopePath,
          ),
        )
        .filter((cName): cName is string => cName !== null)
        .map((cName) => ({ kind, cName })),
    );
  }

  /** This type's transpiled C name, or null when the header already defines it. */
  private scopeTypeCNameIfAbsentFromHeader(
    nameNode: { IDENTIFIER(): { getText(): string } },
    declaringScopePath: string,
  ): string | null {
    const fullName = QualifiedNameGenerator.forMember(
      declaringScopePath,
      nameNode.IDENTIFIER().getText(),
    );
    const definedInHeader =
      this.host.state.sourcePath !== null &&
      PublicInterface.definesTypeInHeader(
        this.host.state.symbolTable,
        this.host.state.sourcePath,
        fullName,
      );
    return definedInHeader ? null : fullName;
  }

  /** Which of the four kinds this member is, and what rendering it needs. */
  private planScopeMember(
    member: Parser.ScopeMemberContext,
    declaringScopePath: string,
  ): TPlannedScopeMember {
    // #1241: recorded at the MEMBER's position, so a variable member and a
    // function member land in different matrix contexts instead of both
    // crediting whichever line the `scope` keyword sits on. Carried for every
    // member, including the ones nothing is emitted for.
    const adrLine = member.start?.line;

    // ADR-016, via the one helper the symbols layer also asks (#1300). Codegen
    // used to recompute this, so the header and the body decided visibility
    // independently.
    const isPrivate = ScopeUtils.getMemberVisibility(member) === "private";

    const varDecl = member.variableDeclaration();
    if (varDecl) {
      return {
        kind: "variable",
        adrLine,
        variable: this.planScopeVariable(
          varDecl,
          declaringScopePath,
          isPrivate,
        ),
      };
    }

    const funcDecl = member.functionDeclaration();
    if (funcDecl) {
      const parameterList = funcDecl.parameterList();
      return {
        kind: "function",
        adrLine,
        isPrivate,
        fullName: QualifiedNameGenerator.forFunctionInScope(
          declaringScopePath,
          funcDecl.IDENTIFIER().getText(),
          this.host.state.program,
        ),
        declaredTypeText: funcDecl.type().getText(),
        renderReturnType: () => this.generateType(funcDecl.type()),
        planParameters: () => this.planFunctionParameters(parameterList),
        renderBody: () => this.generateBlock(funcDecl.block()),
        renderParameterList: () =>
          parameterList ? this.generateParameterList(parameterList) : "void",
      };
    }

    const regDecl = member.registerDeclaration();
    if (regDecl) {
      return {
        kind: "register",
        adrLine,
        planRegister: () => this.planRegister(regDecl),
      };
    }

    return { kind: "other", adrLine };
  }

  /** Which of the three shapes a scope variable is emitted in. */
  private planScopeVariable(
    varDecl: Parser.VariableDeclarationContext,
    declaringScopePath: string,
    isPrivate: boolean,
  ): TPlannedScopeVariable {
    const fullName = QualifiedNameGenerator.forMember(
      declaringScopePath,
      varDecl.IDENTIFIER().getText(),
    );

    // Issue #375: constructor syntax.
    //
    // #1322: the arguments are no longer VALIDATED here -- the const check that
    // stood beside this resolution is E0432 in pass 2.1, and it was the second
    // of two implementations of one decision.
    const constructorArgList = varDecl.constructorArgumentList();
    if (constructorArgList) {
      return {
        kind: "constructor",
        fullName,
        isPrivate,
        args: constructorArgList
          .IDENTIFIER()
          .map((arg) =>
            QualifiedNameGenerator.forMember(declaringScopePath, arg.getText()),
          ),
        renderType: () => this.generateType(varDecl.type()),
      };
    }

    // Issue #500: check for an array BEFORE skipping -- arrays must be emitted.
    // Both spellings count: C-style trailing dimensions and the C-Next arrayType.
    const isConst = varDecl.constModifier() !== null;
    const shape = CodeGenWalker.readArrayShape(varDecl);
    const arrayDims = shape.arrayDims;
    const arrayTypeCtx = shape.arrayTypeCtx;
    const isArray = shape.isArray;

    // Issue #282: a private const scalar is inlined at its uses, not emitted at
    // file scope. Issue #500 exempts arrays, which cannot be inlined. Decided
    // before any render, so a skipped declaration registers no include.
    if (isPrivate && isConst && !isArray) {
      return { kind: "skipped" };
    }

    // Issue #998: the one modifier builder, which validates the atomic/volatile
    // mutual exclusion. Scope variables are file scope, and the initializer does
    // not affect volatile/atomic handling.
    const modifiers = VariableModifierBuilder.build(
      varDecl,
      false,
      false,
      false,
    );

    return {
      kind: "regular",
      fullName,
      isPrivate,
      isConst,
      isArray,
      declarationLine: varDecl.start?.line,
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      renderType: () => this.generateType(varDecl.type()),
      renderArrayTypeDimensions: () =>
        ArrayDimensionUtils.renderArrayTypeDimensions(
          this.planArrayTypeDimensions(arrayTypeCtx, varDecl),
        ),
      renderCStyleDimensions:
        arrayDims.length > 0
          ? () => this.generateArrayDimensions(arrayDims)
          : null,
      renderStringCapacityDimension: () =>
        ArrayDimensionUtils.renderStringCapacityDimension(
          this.planStringCapacity(varDecl.type()),
        ),
      renderInitializer: () => this.renderScopeInitializer(varDecl, isArray),
    };
  }

  /**
   * A scope variable's initializer.
   *
   * Issue #872: `expectedType` is what puts the MISRA C:2012 Rule 7.2 `U`
   * suffix on an unsigned literal. Issue #992: `withDeclarationInit` suppresses
   * compound literals at file scope, for GCC 9-12 compatibility.
   *
   * The type is rendered again here rather than reused from the declaration:
   * the caller's copy may have become a callback typedef or gained a `*`, and
   * the expected type of the INITIALIZER is the declared type, not the emitted
   * one. Two questions, two answers.
   */
  private renderScopeInitializer(
    varDecl: Parser.VariableDeclarationContext,
    isArray: boolean,
  ): string {
    const initializer = varDecl.expression();
    if (initializer) {
      const typeName = this.generateType(varDecl.type());
      const state = this.host.state;
      state.resetArrayInitTracking();
      const rendered = state.withExpectedType(typeName, () =>
        state.withDeclarationInit(
          () => ` = ${this.generateExpression(initializer)}`,
        ),
      );
      // #1824 review: an omitted size is emitted from 1.3's count (the
      // planner), so the list rendered here must have exactly that many
      // elements -- the same check the statement renderer makes.
      const omitsSize =
        varDecl
          .type()
          .arrayType()
          ?.arrayTypeDimension()
          .some((dim) => !dim.expression()) ?? false;
      if (omitsSize && state.wasArrayInit()) {
        ArrayInitHelper.assertInferredSize(
          varDecl.IDENTIFIER().getText(),
          this.countedSize(varDecl),
          state,
        );
      }
      return rendered;
    }
    // ADR-015: Zero initialization for uninitialized scope variables
    return ` = ${this.getZeroInitializer(varDecl.type(), isArray)}`;
  }

  private generateScope(ctx: Parser.ScopeDeclarationContext): string {
    return this.invokeGenerator(scopeGenerator, this.planScope(ctx));
  }

  private generateRegister(ctx: Parser.RegisterDeclarationContext): string {
    return this.invokeGenerator(
      registerGeneratorFor(this.host.getState().currentScopePath),
      this.planRegister(ctx),
    );
  }

  /**
   * An ADR-004 register binding, decided (#1445).
   *
   * Part of IOrchestrator: `ScopeGenerator` dispatches the same generator for
   * a register inside a scope, and planning at both sites would be two
   * derivations of one register.
   *
   * The ORDER matters and is the node-walking order: the base address is
   * generated before the members, because each generation registers effects
   * on `CodeGenState`.
   *
   * `cType` comes from `generateType`, the single ADR-057 resolution point --
   * a bare `Flags` inside `scope Chip` arrives as `Chip__Flags` and an
   * explicit `global.Flags` arrives as `Flags`. Nothing downstream may
   * re-qualify it.
   */
  planRegister(ctx: Parser.RegisterDeclarationContext): IPlannedRegister {
    const baseAddress = this.generateExpression(ctx.expression());

    return {
      name: ctx.IDENTIFIER().getText(),
      baseAddress,
      members: ctx.registerMember().map((member) => {
        const cType = this.generateType(member.type());
        const offset = this.generateExpression(member.expression());
        return {
          name: member.IDENTIFIER().getText(),
          cType,
          access: member.accessModifier().getText() as TRegisterAccessMode,
          offset,
        };
      }),
    };
  }

  /**
   * A struct declaration, decided (#1445).
   *
   * `getTypeName` is the one eager read, because every field needs it -- it is
   * the key `callbackTypes` and `knownEnums` are looked up by. The four
   * renders stay thunks: each runs on only some branches, and each can
   * register effects, so rendering them all would emit effects for fields that
   * do not use them. See `IPlannedStructField`.
   */
  private planStruct(ctx: Parser.StructDeclarationContext): IPlannedStruct {
    return {
      name: ctx.IDENTIFIER().getText(),
      fields: ctx.structMember().map((member) => {
        const typeCtx = member.type();
        // Use optional chaining for mock compatibility in tests
        const arrayType = typeCtx.arrayType?.() ?? null;
        // ADR-036: arrayDimension() returns an array, for multi-dimensional
        // support
        const nameDimensions = member.arrayDimension();

        return {
          name: member.IDENTIFIER().getText(),
          typeName: this.getTypeName(typeCtx),
          hasNameDimensions: nameDimensions.length > 0,
          hasTypeDimensions: arrayType !== null,
          renderCType: () => this.generateType(typeCtx),
          renderTypeDimensions: () =>
            ArrayDimensionUtils.renderArrayTypeDimensions(
              this.planArrayTypeDimensions(arrayType),
            ),
          renderNameDimensions: () =>
            this.generateArrayDimensions(nameDimensions),
          renderZeroInitializer: () => this.getZeroInitializer(typeCtx, false),
        };
      }),
    };
  }

  /**
   * An array TYPE's dimensions, decided (#1445).
   *
   * Issue #1159: a dimension that folds to a compile-time constant is emitted
   * as its value. Emitting the identifier makes `u8[SIZE] buf` a VLA while the
   * matching local declaration folds to `uint8_t b[6]` -- the same const
   * rendered two ways in one .c. Expression generation is the fallback, and it
   * stays behind a thunk because a caller may not emit these dimensions at all.
   */
  planArrayTypeDimensions(
    ctx: Parser.ArrayTypeContext | null,
    declaration: Parser.VariableDeclarationContext | null = null,
  ): readonly IPlannedDimension[] | null {
    if (ctx === null) return null;

    return ctx.arrayTypeDimension().map((dimension) => {
      const expression = dimension.expression();
      // #1664 box 3: an omitted size is the declaration's count, the number
      // the `.h` states, for every declaration renderer that asks here.
      if (!expression) {
        return { renderSize: () => String(this.omittedSizeOf(declaration)) };
      }

      return {
        renderSize: () => this.renderDimension(expression),
      };
    });
  }

  /**
   * A call's arguments, decided (#1445).
   *
   * Four of the five fields are thunks because exactly ONE render happens
   * per argument and the generator decides which -- see
   * `IPlannedCallArgument`. `simpleIdentifier` is eager: it is a pure tree
   * walk, and Issue #268's pass-through tracking reads it for every argument
   * before any of them renders.
   */
  planCallArguments(
    ctx: Parser.ArgumentListContext | null,
  ): readonly IPlannedCallArgument[] | null {
    if (ctx === null) return null;

    return ctx.expression().map((expression) => ({
      simpleIdentifier: this.getSimpleIdentifier(expression),
      declared: this.nameTypeOf(expression),
      expressionType: () => this.getExpressionType(expression),
      isArray: () =>
        OperandTyper.decaysToPointer(
          OperandTyper.typeOf(expression, this.host.state.typingContext()),
        ),
      isHandleArrayElement: () => this.isHandleArrayElement(expression),
      render: () => this.generateExpression(expression),
      renderByReference: (targetParamBaseType: string | undefined) =>
        this.generateFunctionArg(expression, targetParamBaseType),
    }));
  }

  /** A bounded string type's declared capacity, or null (#1445). */
  planStringCapacity(ctx: Parser.TypeContext): number | null {
    const literal = ctx.stringType()?.INTEGER_LITERAL();
    return literal ? Number.parseInt(literal.getText(), 10) : null;
  }

  private generateStruct(ctx: Parser.StructDeclarationContext): string {
    return this.invokeGenerator(structGenerator, this.planStruct(ctx));
  }

  /**
   * ADR-017: Generate enum declaration
   * enum State { IDLE, RUNNING, ERROR <- 255 }
   * -> typedef enum { State_IDLE = 0, State_RUNNING = 1, State_ERROR = 255 } State;
   *
   * Delegates to extracted EnumGenerator.
   */
  private generateEnum(ctx: Parser.EnumDeclarationContext): string {
    return this.invokeSuppressibleDeclaration(
      enumGenerator,
      ctx.IDENTIFIER().getText(),
    );
  }

  /**
   * ADR-034: Generate bitmap declaration
   * bitmap8 MotorFlags { Running, Direction, Mode[3], Reserved[2] }
   * -> typedef uint8_t MotorFlags; (with field layout comment)
   *
   * Delegates to extracted generator if registered.
   */
  private generateBitmap(ctx: Parser.BitmapDeclarationContext): string {
    return this.invokeSuppressibleDeclaration(
      bitmapGenerator,
      ctx.IDENTIFIER().getText(),
    );
  }

  /**
   * The struct type for an initializer: explicit if written, else inferred
   * from the expected type at this position.
   *
   * #1322: an assertion now. ADR-014's rejection -- a literal no position can
   * type -- is E0357 in pass 2.1, which halts before this runs. Its sibling
   * E0356 (a redundant WRITTEN type) is gone with the grammar alternative it
   * rejected, so this takes no node: there is one source for the type.
   */
  private _resolveStructInitializerTypeName(): string {
    invariant(
      this.host.state.expectedType,
      "a struct initializer takes its type from its position -- E0357 " +
        "rejects this in pass 2.1, before this runs",
    );
    return this.host.state.expectedType;
  }

  /**
   * ADR-014: Generate struct initializer
   * { x: 10, y: 20 } -> (Point){ .x = 10, .y = 20 } (type inferred from context)
   *
   * #1322: there is no explicit-type syntax. `Point { x: 10 }` was a grammar
   * alternative that no position accepted, and it is removed.
   */
  private generateStructInitializer(
    ctx: Parser.StructInitializerContext,
  ): string {
    const typeName = this._resolveStructInitializerTypeName();
    const fieldList = ctx.fieldInitializerList();

    // Issue #517: Check if this is a C++ class with a user-defined constructor.
    // C++ classes with user-defined constructors are NOT aggregate types,
    // so designated initializers { .field = value } don't work with them.
    // We check the SymbolTable for a constructor symbol (TypeName::TypeName).
    const isCppClass =
      this.host.state.cppMode && this._isCppClassWithConstructor(typeName);

    // Issue #834: For named struct tags (no typedef), we need 'struct' prefix in C mode
    const needsStructKeyword =
      !this.host.state.cppMode &&
      this.host.state.symbolTable.checkNeedsStructKeyword(typeName);
    const castType = TypeGenerationHelper.generateUserType(
      typeName,
      needsStructKeyword,
    );

    // #1322: an empty-initializer branch stood here, reachable only through the
    // written form `Point {}` -- the inferred alternative has always required a
    // field list. That alternative is removed, so `fieldInitializerList()` is
    // non-nullable in the generated parser and `{}` is a parse error. The
    // branch went with it rather than being left as a shape nothing can build.

    // Get field type info for nested initializers
    // Issue #831: SymbolTable is the single source of truth for struct fields
    // (both C-Next and C/C++ header structs)
    const structFieldTypes =
      this.host.state.symbolTable?.getStructFieldTypes(typeName);

    const fields = fieldList.fieldInitializer().map((field) => {
      const fieldName = field.IDENTIFIER().getText();
      const fieldType = this._resolveFieldType(fieldName, structFieldTypes);
      const value = this.host.state.withExpectedType(fieldType, () =>
        this.generateExpression(field.expression()),
      );
      return { fieldName, value };
    });

    // Issue #517: For C++ classes, store assignments for later and return {}
    if (isCppClass) {
      for (const { fieldName, value } of fields) {
        this.host.state.pendingCppClassAssignments.push(
          `${fieldName} = ${value};`,
        );
      }
      return "{}";
    }

    // For C-Next/C structs, generate designated initializer.
    // Issue #1143: `.field = value` is C99 in C mode (baseline, free) but
    // C++20 in C++ mode -- GCC and Clang accept it earlier as an extension,
    // which is how this repo's own -std=c++14 harness compiles the output.
    // The text is identical in both modes, so the mode has to be recorded
    // here; no probe over the output could recover it.
    if (this.host.state.cppMode) {
      ToolchainRequirements.record("cpp-designated-initializer");
    }
    const fieldInits = fields.map((f) => `.${f.fieldName} = ${f.value}`);

    return this.formatStructInitializer(typeName, castType, fieldInits);
  }

  private formatStructInitializer(
    typeName: string,
    castType: string,
    fieldInits: string[],
  ): string {
    const initializer: string = `{ ${fieldInits.join(", ")} }`;

    // In a declaration initializer context, use plain designated initializer — no type cast
    // prefix needed, and compound literals are not C99 constant expressions so they fail
    // at file scope on GCC < 13.
    if (this.host.state.inDeclarationInit) {
      return initializer;
    }

    // Issue #882: In C++ mode, anonymous structs/unions must use plain brace init.
    // Compound literals like (struct { ... }){ ... } create incompatible types in C++
    // because each struct { ... } definition creates a distinct nominal type.
    if (
      this.host.state.cppMode &&
      (typeName.startsWith("struct {") || typeName.startsWith("union {"))
    ) {
      return initializer;
    }

    if (!this.host.state.inFunctionBody) {
      return initializer;
    }

    // Issue #1143: a compound literal is C99, but is not ISO C++ at any
    // version -- GCC and Clang accept it as an extension.
    if (this.host.state.cppMode) {
      ToolchainRequirements.record("cpp-compound-literal");
    }
    return `(${castType})${initializer}`;
  }

  /**
   * Resolve the C type string for a named struct field, converting C++ underscore-separated
   * names to :: notation. Returns undefined if the field is not in the type map.
   * Issue #502: C-Next stores C++ types with _ separator; codegen needs ::.
   */
  private _resolveFieldType(
    fieldName: string,
    structFieldTypes: Map<string, string> | undefined,
  ): string | undefined {
    if (!structFieldTypes?.has(fieldName)) return undefined;
    const fieldType = structFieldTypes.get(fieldName)!;
    if (!QualifiedCName.isQualified(fieldType)) return fieldType;
    const parts = QualifiedCName.split(fieldType);
    if (parts.length > 1 && this.host.isCppScopeSymbol(parts[0])) {
      return parts.join("::");
    }
    return fieldType;
  }

  /**
   * ADR-035: Generate array initializer
   * [1, 2, 3] -> {1, 2, 3}
   * [0*] -> {0} (fill-all syntax)
   * Returns: { elements: string, count: number } for size inference
   */
  private generateArrayInitializer(
    ctx: Parser.ArrayInitializerContext,
  ): string {
    // Check for fill-all syntax: [value*]
    if (ctx.expression() && ctx.getChild(2)?.getText() === "*") {
      // Fill-all: [0*] -> {0}
      const fillValue = this.generateExpression(ctx.expression()!);
      // Store element count as 0 to signal fill-all (size comes from declaration)
      this.host.state.lastArrayInitCount = 0;
      this.host.state.lastArrayFillValue = fillValue;
      return `{${fillValue}}`;
    }

    // Regular list: [1, 2, 3] -> {1, 2, 3}
    const elements = ctx.arrayInitializerElement();
    const generatedElements: string[] = [];

    for (const elem of elements) {
      if (elem.expression()) {
        generatedElements.push(this.generateExpression(elem.expression()!));
      } else if (elem.structInitializer()) {
        generatedElements.push(
          this.generateStructInitializer(elem.structInitializer()!),
        );
      } else if (elem.arrayInitializer()) {
        // Nested array for multi-dimensional
        generatedElements.push(
          this.generateArrayInitializer(elem.arrayInitializer()!),
        );
      }
    }

    // Store element count for size inference
    this.host.state.lastArrayInitCount = generatedElements.length;
    this.host.state.lastArrayFillValue = undefined;

    return `{${generatedElements.join(", ")}}`;
  }

  /**
   * A function declaration, decided (#1445).
   *
   * The return type is rendered HERE, before the context is entered, because
   * that is where the node-walking version rendered it.
   * `isMainFunctionWithArgs` and the first parameter's name are pure reads of
   * the tree, so moving them ahead of the context changes nothing they can
   * observe.
   *
   * The body and the parameter list stay unrendered: Issue #268 makes their
   * ORDER the generator's decision, and it cannot own that if it is handed
   * two strings.
   */
  private planFunction(
    ctx: Parser.FunctionDeclarationContext,
  ): IPlannedFunction {
    const parameterList = ctx.parameterList() ?? null;
    const name = ctx.IDENTIFIER().getText();

    return {
      name,
      returnType: this.generateType(ctx.type()),
      returnTypeText: ctx.type().getText(),
      isMainWithArgs: this.isMainFunctionWithArgs(name, parameterList),
      firstParameterName: parameterList?.parameter()[0]?.IDENTIFIER().getText(),
      parameters: this.planFunctionParameters(parameterList),
      renderBody: () => this.generateBlock(ctx.block()),
      renderParameterList: parameterList
        ? () => this.generateParameterList(parameterList)
        : null,
    };
  }

  private generateFunction(ctx: Parser.FunctionDeclarationContext): string {
    // #1285: no inline fallback. This used to carry a second, parallel
    // implementation guarded by `if (generator)` against a registry lookup
    // that could never miss, so the twin was unreachable and still had to be
    // kept in step by hand. #1445 deleted the registry as well, so there is no
    // lookup left to guard -- this wrapper is now indistinguishable from its
    // eleven siblings, which is the point.
    return this.invokeGenerator(functionGenerator, this.planFunction(ctx));
  }

  private generateParameter(
    ctx: Parser.ParameterContext,
    paramIndex?: number,
  ): string {
    const typeName = this.getTypeName(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // #1322: a C-style or unbounded array parameter is E0874/E0875 in pass
    // 2.1 (ADR-036).

    // Pre-compute CodeGenState-dependent values
    const isModified = this._isCurrentParameterModified(name);

    // Issue #895: For callback-compatible functions, determine pointer/value
    // from the typedef signature, not from normal C-Next pass-by-value rules
    const callbackInfo =
      paramIndex === undefined
        ? null
        : FunctionContextManager.getCallbackTypedefParamInfo(
            paramIndex,
            this.host.state,
          );
    const isPassByValue = callbackInfo
      ? !callbackInfo.isParamPointer
      : this._isPassByValueType(typeName, name);
    // #1545: the FUNCTION-level question, which is the one the header asks.
    // Reading `callbackInfo !== null` here asked a per-PARAMETER question, so a
    // parameter the typedef does not describe (past its arity, or of a shape
    // TypedefParamParser cannot read) took auto-const in the .c while the .h
    // suppressed it for every parameter of the function -- `error: conflicting
    // types`, the same defect one parameter over.
    const isCallbackCompatible =
      FunctionContextManager.callbackTypedefType(this.host.state) !== undefined;

    // Build normalized input using adapter
    // Issue #895: Force pass-by-reference and const from typedef signature
    const forcePassByReference = callbackInfo?.isParamPointer ?? false;
    const forceConst = callbackInfo?.isParamConst ?? false;

    // ADR-030 / #1722: the parameter was registered when this function's
    // context was entered -- FunctionGenerator and ScopeGenerator both render
    // the list before exiting it -- and the registry holds the one
    // opaque-handle decision. Reading it here makes the `T*` this signature
    // spells and the bare `p` a whole-value use renders one answer, rather
    // than two answers that happen to agree.
    const registered = this.host.state.currentParameters.get(name);
    invariant(
      registered,
      `a parameter is registered in its function's context before the signature renders ('${name}')`,
    );

    const input = ParameterInputAdapter.fromAST(this.planParameter(ctx), {
      callbackTypes: this.host.state.callbackTypes,
      isKnownStruct: (t) => {
        if (this.host.isKnownStruct(t)) return true;
        // ADR-057: check qualified name for scope-local struct types only
        const qualified = this.host.state.currentScopePath
          ? QualifiedNameGenerator.forMember(
              this.host.state.currentScopePath,
              t,
            )
          : t;
        return this.host.state.symbols?.knownStructs.has(qualified) ?? false;
      },
      typeMap: TYPE_MAP,
      isModified,
      isPassByValue,
      isCallbackCompatible,
      forcePassByReference,
      forceConst,
      // #1545: the one named accessor, which is also what _isPassByValueType
      // asks, so the auto-const rule and the pass-by-value decision cannot
      // disagree about what an enum is. `t` arrives from getTypeName, which
      // resolves through the ADR-057 isScopeType predicate, so this is already
      // the qualified lookup the scope rule calls for.
      isKnownEnum: (t) => this.host.state.isKnownEnum(t),
      // Issue #995: Opaque handles should not get auto-const
      isOpaqueHandle: registered.isOpaqueHandle ?? false,
    });

    // Use shared builder with C/C++ mode
    return ParameterSignatureBuilder.build(
      input,
      CppModeHelper.refOrPtr(this.host.state),
    );
  }

  /**
   * A parameter reduced to what ADR-006's signature adapter asks of it (#1445).
   *
   * Three provenance positions are carried, not one: ADR-013 is recorded
   * against the parameter, the string type or the array type depending on
   * which branch of the adapter fires, and #1241 derives matrix occupancy from
   * those positions.
   *
   * The dimensions go over as a thunk. A parameter whose type IS a callback
   * returns from the adapter before any dimension is needed, and a dimension
   * that is not a compile-time constant goes through expression generation,
   * which can queue a pending temp declaration -- so rendering one that is
   * then discarded leaks it.
   */
  private planParameter(ctx: Parser.ParameterContext): IPlannedParameter {
    const typeCtx = ctx.type();
    const arrayType = typeCtx.arrayType();
    const stringType = arrayType
      ? arrayType.stringType()
      : typeCtx.stringType();
    const capacity = stringType?.INTEGER_LITERAL();

    return {
      name: ctx.IDENTIFIER().getText(),
      isConst: ctx.constModifier() !== null,
      typeName: this.getTypeName(typeCtx),
      mappedType: this.generateType(typeCtx),
      renderDimensions: arrayType
        ? () =>
            arrayType
              .arrayTypeDimension()
              .map((dimension) => this.renderArrayDimension(dimension))
        : null,
      isString: stringType !== null,
      stringCapacity: capacity
        ? Number.parseInt(capacity.getText(), 10)
        : undefined,
      line: ctx.start?.line,
      stringTypeLine: stringType?.start?.line,
      arrayTypeLine: arrayType?.start?.line,
    };
  }

  /**
   * One array dimension of a parameter, as C should say it.
   *
   * Issue #1159: fold a compile-time constant to its value first. Emitting the
   * identifier makes `u8[SIZE] buf` a VLA parameter (`uint8_t buf[SIZE]`)
   * while the matching local declaration folds to `uint8_t b[6]` -- the same
   * const rendered two ways in one .c, and a construct CLAUDE.md rules out.
   * Expression generation stays as the fallback for dimensions that are
   * genuinely not constant.
   */
  private renderArrayDimension(
    dimension: Parser.ArrayTypeDimensionContext,
  ): string {
    const expression = dimension.expression();
    if (!expression) {
      return "";
    }

    return this.renderDimension(expression);
  }

  /**
   * #1175: a dimension as the .c writes it -- its value, or, for one only C
   * can evaluate (a header macro), the C the .h writes too, from the one
   * printer. It used to fall back to the runtime expression generator, which
   * wrote `cnx_clamp_add_u8(A, A)` where the .h wrote `A+A`, and `2` where
   * the .h wrote `1--1`. `ConstantFold.settled` is the .h's decision too. A
   * dimension with no value never reaches render: 2.1 rejects it (E0909,
   * E0910).
   */
  private renderDimension(expression: Parser.ExpressionContext): string {
    // ADR-036: a dimension is a constant expression in every context, so a
    // fixture occupies the matrix cell it is written in
    AdrProvenance.record("036", expression.start?.line);
    const dimension = ConstantFold.settled(
      ConstExprLowering.lower(expression),
      dimensionEvalOptions(this.transpileState),
    );
    invariant(
      dimension !== null,
      `2.1 rejects a dimension with no value (E0909, E0910) before render: '${expression.getText()}'`,
    );
    return String(dimension);
  }

  /** A dimension's value, by the one evaluator; undefined when it has none */
  private dimensionValue(
    expression: Parser.ExpressionContext,
  ): number | undefined {
    return ConstExprLowering.valueOf(
      expression,
      dimensionEvalOptions(this.transpileState),
    );
  }

  /**
   * Check if type should use pass-by-value semantics
   */
  private _isPassByValueType(typeName: string, name: string): boolean {
    // ISR, float, enum types
    if (typeName === "ISR") return true;
    if (this._isFloatType(typeName)) return true;
    if (this.host.state.symbols?.knownEnums.has(typeName)) return true;

    // Small unmodified primitives
    if (
      this.host.state.currentFunctionName &&
      PassByValueAnalyzer.isParameterPassByValueByName(
        this.host.state.currentFunctionName,
        name,
        this.host.state,
      )
    ) {
      return true;
    }

    // Callback-compatible functions: struct params become pass-by-value to
    // match C function pointer typedef signatures.
    //
    // #1450: this used to say "a full fix requires parsing the typedef
    // signature to determine which", citing #895. That fix IS #895 --
    // `TypedefParamParser` parses the signature ("Used by Issue #895 to
    // determine if callback params should be pointers or values") and
    // `getCallbackTypedefParamInfo` is the path that consumes it. #895 closed
    // 2026-02-23, so the note described work that had already landed and
    // pointed at a closed issue as if it were the tracker.
    //
    // What is left here is the FALLBACK, reached only when the typedef type
    // cannot be resolved -- the caller prefers `callbackInfo` and only calls
    // this when that is null. Measured: throwing inside the branch leaves
    // 1247/1247 fixtures green, while throwing immediately above it fires
    // repeatedly, so the line is reached and the condition is simply never
    // true in the corpus. Not deleted on that evidence: a corpus that does not
    // reach a branch is not a user base that does not, and the third conjunct
    // (`isKnownStruct`) is the one no fixture satisfies.
    //
    // #1545 attempted to route this through
    // `this.host.state.callbackTypedefTypeFor` so that "is this function
    // callback-compatible" had ONE spelling. Reverted here on the reasoning
    // directly above: requiring the typedef type to resolve would make this
    // branch unreachable in precisely the case it exists to serve. The
    // divergence from the auto-const decision is deliberate, not an oversight,
    // and #1603 is where whether an unresolvable typedef should fail open is
    // decided -- for both, in one place, rather than by quietly aligning the
    // spellings here.
    if (
      this.host.state.currentFunctionName &&
      this.host.state.program
        ?.callbackCompatibleFunctions()
        .has(this.host.state.currentFunctionName) &&
      this.host.isKnownStruct(typeName)
    ) {
      return true;
    }

    return false;
  }

  /**
   * One variable declaration, in whichever of three forms it takes.
   *
   * ## This planner WRITES, and the order is the contract
   *
   * `inferVariableType` renders; `trackLocalVariable` records the local's
   * name for the walk. What a name is typed as is not written here: it binds
   * through 1.4's lexical frames (#1668, C8), which is why
   * `string<32> s <- s + "x"` is detected as a concatenation and rejected
   * E0864 for "capacity 33", the 32 read off `s`'s own declaration (#1643
   * tracks that the name binds in its own initializer at all). The steps are
   * still the sequence the renderer used to perform,
   * with the rendering lifted out of it.
   */
  private planVariableDecl(
    ctx: Parser.VariableDeclarationContext,
  ): TPlannedVariableDecl {
    // Issue #375: Check for C++ constructor syntax - early return
    const constructorArgList = ctx.constructorArgumentList();
    if (constructorArgList) {
      return this.planConstructorDecl(ctx, constructorArgList);
    }

    // Issue #696: Use helper for modifier extraction and validation
    // Issue #852 (MISRA Rule 8.5): hasInitializer and cppMode drive extern
    const modifiers = VariableModifierBuilder.build(
      ctx,
      this.host.state.inFunctionBody,
      ctx.expression() !== null,
      this.host.state.cppMode,
    );

    const name = ctx.IDENTIFIER().getText();
    const typeCtx = ctx.type();

    // #1322: a C-style array declaration (u16 arr[8]) is E0874 in pass 2.1
    // (ADR-036), raised by `ArrayDeclarationAnalyzer`.
    const type = this._inferVariableType(ctx, name);

    // Track local variable metadata
    this._trackLocalVariable(name);

    // ADR-057: the identifier this declaration is EMITTED under. Computed once,
    // here, because the string and array forms below return before the plain
    // declaration is assembled -- a second call would be a second place
    // deciding the same thing. Registries keep the source name; only the
    // generated text moves.
    const emittedName = this.host.state.emittedLocalName(name);

    // ADR-045: string types have their own three forms
    const stringPlan = this.planStringDecl(
      ctx,
      typeCtx,
      ctx.expression() ?? null,
      ctx.arrayDimension(),
    );
    if (stringPlan) {
      return {
        kind: "string",
        string: stringPlan,
        emittedName,
        modifiers,
        isConst: ctx.constModifier() !== null,
      };
    }

    // Statements rather than an object literal, because the ORDER matters and
    // an object literal's property order is not something a reader checks:
    // the array half renders its type dimensions eagerly, and it must do so
    // before anything the initializer renders.
    const array = this.planArrayDeclaration(ctx, typeCtx);
    const initializer = this.planVariableInitializer(ctx, typeCtx);

    return {
      kind: "plain",
      sourceName: name,
      emittedName,
      modifierPrefix: VariableModifierBuilder.toPrefix(modifiers),
      type,
      array,
      initializer,
    };
  }

  /**
   * Issue #375: `Type name(arg, arg);` -- C++ constructor syntax.
   *
   * #1322: the "is not declared" (E0433) and "must be const" (E0432)
   * rejections that stood here are authored in pass 2.1, which halts before
   * codegen -- so an argument reaching this line is declared and const. The two
   * copies of that rule also decided const-ness two different ways;
   * `IDeclaredVar.isConst` is now the single answer.
   *
   * What survives is NAME resolution, which is codegen's own question: a scope
   * member is emitted by its qualified C name.
   */
  private planConstructorDecl(
    ctx: Parser.VariableDeclarationContext,
    argListCtx: Parser.ConstructorArgumentListContext,
  ): TPlannedVariableDecl {
    const type = this.generateType(ctx.type());
    const name = ctx.IDENTIFIER().getText();

    // #1668: what each argument NAMES, by the one binder -- a scope member
    // is emitted by its C name, a shadowing local by its ADR-057 name. It is
    // the same answer a function argument takes (#1760 review): this was a
    // second spelling of that decision beside ArgumentGenerator's own.
    const args = argListCtx.IDENTIFIER().map((argNode) =>
      this.boundName(argNode.getText(), {
        line: argNode.symbol.line,
        column: argNode.symbol.column,
      }),
    );

    // Track as local variable if inside function body
    if (this.host.state.inFunctionBody) {
      this.host.state.registerLocalVariable(name);
    }

    return {
      kind: "constructor",
      type,
      // ADR-057: emit under the name registration decided on, not the source one.
      emittedName: this.host.state.emittedLocalName(name),
      args,
    };
  }

  /**
   * The two spellings of "this declaration is an array", read once.
   *
   * C-Next admits trailing C-style dimensions (`u32 a[4]`) and the arrayType
   * prefix (`u32[4] a`), so "is this an array" is their disjunction --
   * `IPlannedArrayDeclaration` says it is decided once, and it was being
   * re-derived at a second site from the same node.
   *
   * The scope-side copy gates a BEHAVIORAL arm, which is why this is not
   * cosmetic: Issue #282 inlines a private const scalar at its uses and Issue
   * #500 exempts arrays. Two spellings of this disjunction disagreeing emits an
   * array that should have been inlined, or inlines one that had to be emitted.
   *
   * `arrayType?.()` keeps the scope path's defensive call -- `TypeContext`
   * always carries the rule, but a hand-built context in a unit test need not.
   */
  private static readArrayShape(ctx: Parser.VariableDeclarationContext): {
    arrayDims: Parser.ArrayDimensionContext[];
    arrayTypeCtx: Parser.ArrayTypeContext | null;
    isArray: boolean;
  } {
    const arrayDims = ctx.arrayDimension();
    const arrayTypeCtx = ctx.type().arrayType?.() ?? null;

    return {
      arrayDims,
      arrayTypeCtx,
      isArray: arrayDims.length > 0 || arrayTypeCtx !== null,
    };
  }

  /**
   * The array half of a declaration (ADR-035/ADR-036).
   *
   * `arrayTypeDimensions` is rendered HERE rather than handed over as a thunk,
   * and that is the one placement worth checking. It renders unconditionally
   * once the declaration is an array, before the initializer branch chooses
   * whether to use it, and one sub-branch discards it. A thunk would skip the
   * render on exactly that sub-branch and drop whatever effects the dimension
   * expressions raised.
   */
  private planArrayDeclaration(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
  ): IPlannedArrayDeclaration {
    const shape = CodeGenWalker.readArrayShape(ctx);
    const arrayDims = shape.arrayDims;
    const arrayTypeCtx = shape.arrayTypeCtx;

    if (!shape.isArray) {
      return {
        isArray: false,
        hasEmptyDimension: false,
        hasEmptyArrayTypeDimension: false,
        declaredSize: null,
        arrayTypeDimensions: "",
        renderCStyleDimensions: () => "",
        init: null,
      };
    }

    const typeDims = arrayTypeCtx?.arrayTypeDimension() ?? [];
    const hasEmptyArrayTypeDimension = typeDims.some(
      (dim) => !dim.expression(),
    );
    const hasEmptyDimension =
      arrayDims.some((dim) => !dim.expression()) || hasEmptyArrayTypeDimension;
    const initializer = ctx.expression();
    // #1822: the inferred path emits its one counted size as the whole suffix,
    // which is right only for a one-dimensional array. E0892 rejects every
    // other empty dimension in pass 2.1.
    invariant(
      !hasEmptyDimension || typeDims.length + arrayDims.length === 1,
      `an array that omits a size is one-dimensional -- E0892 rejects '${ctx.IDENTIFIER().getText()}' in pass 2.1, before this runs`,
    );

    return {
      isArray: true,
      hasEmptyDimension,
      hasEmptyArrayTypeDimension,
      // #1644: one evaluator, and one FUNCTION -- the type's dimensions and the
      // trailing ones are the same question asked of two lists. They were two
      // methods that had to be kept in step by hand, and the comment saying so
      // is what this deletes.
      // #1664 box 3: an inferred size is the declaration's, not a count of
      // what render is about to emit.
      declaredSize: hasEmptyDimension
        ? this.countedSize(ctx)
        : (this.foldFirstDimension(typeDims) ??
          this.foldFirstDimension(arrayDims)),
      // One renderer for the type's dimensions, not two. This used to call a
      // private twin of `ArrayDimensionUtils.renderArrayTypeDimensions` that
      // re-derived the same rule -- fold a constant, else generate, `[]` when
      // unsized -- from the same node. They agreed only because both folded
      // through `tryEvaluateConstant`, which is the "by coincidence" shape the
      // house rule names. Still eager: the util calls each `renderSize` inside
      // its `map`, so dimension effects are raised exactly where they were.
      arrayTypeDimensions: ArrayDimensionUtils.renderArrayTypeDimensions(
        this.planArrayTypeDimensions(arrayTypeCtx, ctx),
      ),
      renderCStyleDimensions: () => this.generateArrayDimensions(arrayDims),
      init: initializer
        ? {
            renderExpression: () => this.generateExpression(initializer),
            renderTypeName: () => this.getTypeName(typeCtx),
            renderDimensions: () => this.generateArrayDimensions(arrayDims),
          }
        : null,
    };
  }

  /**
   * #1664 box 3: what this declaration says, as 1.3 recorded it and 1.4
   * settled it -- the facts the `.h` is written from. The name binds to its
   * own declaration from the end of the name on (LexicalFrames), so asking
   * there reads this declaration, never one it shadows.
   */
  private declaredHere(
    ctx: Parser.VariableDeclarationContext,
  ): TTypeInfo | undefined {
    const name = ctx.IDENTIFIER().symbol;
    const text = name.text ?? "";
    return this.host.state.declarationTypeInfo(null, text, {
      line: name.line,
      column: name.column + text.length,
    });
  }

  /**
   * The size 1.3 counted for this declaration's one omitted dimension, or
   * null when there is none to read: only a one-dimensional declaration is
   * counted (E0892), and an uncounted size is `UNRESOLVED_DIMENSION`, 0.
   */
  private countedSize(ctx: Parser.VariableDeclarationContext): number | null {
    const rank =
      (ctx.type().arrayType()?.arrayTypeDimension().length ?? 0) +
      ctx.arrayDimension().length;
    const size = this.declaredHere(ctx)?.arrayDimensions?.[0];
    return rank === 1 && size !== undefined && size > 0 ? size : null;
  }

  /** An omitted size as rendered: the declaration's count, asserted. */
  private omittedSizeOf(
    declaration: Parser.VariableDeclarationContext | null,
  ): number {
    const size = declaration === null ? null : this.countedSize(declaration);
    invariant(
      size !== null,
      `an omitted array size is counted from a one-dimensional declaration's list or string literal -- E0892 rejects '${declaration?.IDENTIFIER().getText() ?? "a struct field"}' in pass 2.1, before this runs`,
    );
    return size;
  }

  /**
   * The folded value of the first dimension in a list, or null.
   *
   * Through the one evaluator (`dimensionValue`): the size
   * used to expand a fill-all must equal the size emitted in the declarator, or
   * the array is the declared length with the wrong contents (#1644).
   */
  private foldFirstDimension(
    dims: readonly {
      expression(): Parser.ExpressionContext | null;
    }[],
  ): number | null {
    const sizeExpr = dims[0]?.expression();
    if (!sizeExpr) {
      return null;
    }
    return this.dimensionValue(sizeExpr) ?? null;
  }

  /**
   * How a variable's initializer is rendered (ADR-015 when there is none).
   */
  private planVariableInitializer(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
  ): TPlannedVariableInitializer {
    const initializer = ctx.expression();
    if (!initializer) {
      return {
        kind: "zero",
        render: (isArray) => this.getZeroInitializer(typeCtx, isArray),
      };
    }

    return {
      kind: "expression",
      renderTypeName: () => this.getTypeName(typeCtx),
      renderExpression: () => this.generateExpression(initializer),
      resolveExpressionType: () => this.getExpressionType(initializer),
    };
  }

  /**
   * Which of ADR-045's three string forms this declaration takes, or null when
   * it is not a string at all.
   *
   * #1445 box 3: `StringDeclHelper` used to be handed the `TypeContext` and do
   * this navigation itself.
   *
   * WHERE it is called from was load-bearing while a per-file registry was
   * filled as the walk went; #1668 (C8) deleted it. The variable's own name
   * binds through 1.4's lexical frames wherever this is called, so
   * `string<32> s <- s + "x"` is detected as a concatenation and rejected
   * E0864 for "capacity 33", the 32 read off `s`'s own declaration. (That the name resolves at all is a separate defect,
   * #1643.)
   */
  private planStringDecl(
    ctx: Parser.VariableDeclarationContext,
    typeCtx: Parser.TypeContext,
    expression: Parser.ExpressionContext | null,
    trailingDims: Parser.ArrayDimensionContext[],
  ): TPlannedStringDecl | null {
    // Issue #1029: string array in arrayType syntax -- `string<32>[4] items`
    const arrayTypeCtx = typeCtx.arrayType?.();
    const arrayStringCtx = arrayTypeCtx?.stringType?.();
    if (arrayTypeCtx && arrayStringCtx) {
      // ADR-045: a sized string is copied and measured with <string.h>
      this.host.state.requireInclude("string");
      return this.planStringArray(
        ctx,
        arrayTypeCtx,
        arrayStringCtx,
        expression,
        trailingDims,
      );
    }

    const stringCtx = typeCtx.stringType();
    if (!stringCtx) {
      return null;
    }

    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      // Unsized string - requires const and a literal to infer from. Its
      // capacity is the declaration's (#1664 box 3).
      return {
        kind: "unsized",
        initText: expression?.getText() ?? null,
        declaredCapacity: this.declaredHere(ctx)?.stringCapacity ?? null,
      };
    }

    // ADR-045: a sized string is copied and measured with <string.h>
    this.host.state.requireInclude("string");
    return {
      kind: "bounded",
      capacity: Number.parseInt(intLiteral.getText(), 10),
      init: expression ? this.planStringInit(expression) : null,
    };
  }

  /**
   * The four ways a bounded string's initializer can be written, ready to be
   * asked in ADR-045's order.
   *
   * `concat` is eager because deciding it reads the typer and generates
   * nothing. The other two are unevaluated: `renderSubstring`
   * generates the index expressions once it decides the source IS a string,
   * and `render` generates the whole initializer -- either can request an
   * include or queue a C++ temp, so raising those effects for an arm that is
   * not taken would change the emitted C.
   */
  private planStringInit(
    expression: Parser.ExpressionContext,
  ): IPlannedStringInit {
    return {
      concat: this._getStringConcatOperands(expression),
      renderSubstring: () => this._getSubstringOperands(expression),
      text: expression.getText(),
      sourceCapacity: StringOperationsHelper.getStringExprCapacity(
        expression.getText(),
        this.declaredTypeAt(expression),
      ),
      render: () => this.generateExpression(expression),
    };
  }

  /**
   * Issue #1029: `string<32>[4] items`.
   */
  private planStringArray(
    ctx: Parser.VariableDeclarationContext,
    arrayTypeCtx: Parser.ArrayTypeContext,
    stringCtx: Parser.StringTypeContext,
    expression: Parser.ExpressionContext | null,
    trailingDims: Parser.ArrayDimensionContext[],
  ): TPlannedStringDecl {
    const intLiteral = stringCtx.INTEGER_LITERAL();
    if (!intLiteral) {
      // Unsized string array - not supported
      invariant(
        false,
        "a string array states its element capacity -- E0862 rejects an unsized one in pass 2.1",
      );
    }

    const dims = arrayTypeCtx.arrayTypeDimension();
    // The one planner every declaration renders its type's dimensions with
    // (#1824 review). This arm had its own loop: the same fold (Issue #1127:
    // `string<32>[COUNT] items` must not be a VLA), a raw-text fallback, and,
    // until #1664 box 3, `[]` for an omitted size, left to C to count.
    let dimensions = ArrayDimensionUtils.renderArrayTypeDimensions(
      this.planArrayTypeDimensions(arrayTypeCtx, ctx),
    );

    // Any trailing dimensions from the variable declaration. Unconditional on
    // this arm -- every string array emits its dimensions, initializer or not
    // -- so the effects this raises are raised exactly as often as before.
    dimensions += this.generateArrayDimensions(trailingDims);

    return {
      kind: "array",
      elementCapacity: Number.parseInt(intLiteral.getText(), 10),
      dimensions,
      // #1644: the SAME call the loop above renders the declarator with. The
      // size used to expand a fill-all must equal the size emitted in `[...]`,
      // or the array is the declared length with the wrong contents.
      // An omitted size is the declaration's count; a written one folds.
      declaredSize: dims[0]?.expression()
        ? this.foldFirstDimension(dims)
        : this.countedSize(ctx),
      renderInit: expression ? () => this.generateExpression(expression) : null,
    };
  }

  private generateVariableDecl(ctx: Parser.VariableDeclarationContext): string {
    // Issue #792: Delegate to VariableDeclHelper
    return VariableDeclHelper.renderVariableDecl(
      this.planVariableDecl(ctx),
      this.host.state,
    );
  }

  /**
   * Issue #696: Infer variable type, handling nullable C pointer types.
   * Issue #895 Bug B: Infer pointer type from C function return type.
   */
  private _inferVariableType(
    ctx: Parser.VariableDeclarationContext,
    name: string,
  ): string {
    // ADR-029 / #1484: a local variable declared with a function-as-type emits
    // that function's `_fp` typedef. Asked of `generateDeclaredType`, which owns
    // that consequence for every declaration site.
    const type = this.generateDeclaredType(ctx.type());

    // #958, #895 Bug B and ADR-046: whether the declaration is a C pointer is
    // `DeclaredPointer`'s decision, read off the declaration's type info
    // (#1668) -- the answer every later read of this name gets -- so the
    // emitted type only follows it. Bound just past the declarator, where
    // the name comes into scope.
    const declarator = ctx.IDENTIFIER().symbol;
    const info = this.host.state.declarationTypeInfo(null, name, {
      line: declarator.line,
      column: declarator.column + 1,
    });
    return DeclaredPointer.spell(type, info?.isPointer ?? false);
  }

  /**
   * Issue #696: Track a local variable's name. Its const value, if any, is
   * 1.4's, read where a dimension is folded (#1664 box 7).
   */
  private _trackLocalVariable(name: string): void {
    if (!this.host.state.inFunctionBody) {
      return;
    }

    this.host.state.registerLocalVariable(name);
  }

  /**
   * Get zero initializer for an enum type.
   * Returns member with value 0, or first member, or casted 0.
   * ADR-017: Enums initialize to first member
   */
  private _getEnumZeroValue(
    enumName: string,
    separator: string = QualifiedCName.SEPARATOR,
  ): string {
    const members = this.host.state.symbols!.enumMembers.get(enumName);
    if (!members) {
      return `(${enumName})0`;
    }

    // Find member with explicit value 0
    for (const [memberName, value] of members.entries()) {
      if (value === 0) {
        return `${enumName}${separator}${memberName}`;
      }
    }

    // Fall back to first member
    const firstMember = members.keys().next().value;
    if (firstMember) {
      return `${enumName}${separator}${firstMember}`;
    }

    return `(${enumName})0`;
  }

  /**
   * Resolve full type name from any TypeContext variant.
   * Returns { name, separator } or null if not a named type.
   * ADR-016: Handles scoped, global, qualified, and user types
   */
  private _resolveTypeNameFromContext(
    typeCtx: Parser.TypeContext,
  ): { name: string; separator: string } | null {
    // #1285: ask for named types by name. Everything else -- string, array,
    // template, primitive, `void` -- returns null and is handled by the
    // caller's own chain, which is where it was always handled. An enumerated
    // list of alternatives to SKIP would have to be kept in step with the
    // grammar from ~3000 lines away, and getting it wrong fails open.
    const name = TypeBinding.resolveNamedType(
      typeCtx,
      this.host.state.currentScopePath,
      this.host.state.typeBindingDeps((parts) =>
        this.resolveQualifiedType(parts),
      ),
    );
    if (name === null) {
      return null;
    }

    // Issue #388: a C++ namespace type comes back `::`-joined.
    const separator = name.includes("::") ? "::" : QualifiedCName.SEPARATOR;
    return { name, separator };
  }

  /**
   * Generate a safe bit mask expression.
   * Avoids undefined behavior when width >= 32 for 32-bit integers.
   * @param width The width expression (may be a literal or expression)
   * @param isF64 If true, generate 64-bit masks with ULL suffix (for f64 bit indexing)
   */
  /**
   * Analyze a member chain target to detect bit access at the end.
   * Issue #644: Delegates to MemberChainAnalyzer.
   */
  /** Public for handler access via this.host.state.generator */
  /**
   * Dispatched through `ICodeGenApi` via `this.host.state.requireGenerator()`, so
   * no call site ever names this class. knip cannot follow that indirection.
   *
   * @public
   */
  analyzeMemberChainForBitAccess(
    targetCtx: Parser.AssignmentTargetContext,
    lastStep: IChainStep | undefined,
  ): IBitAccessAnalysis {
    // #1668 (C12): what the last subscript indexes is the typer's answer,
    // typed once with the target (`IChainBase.last`)
    return MemberChainAnalyzer.analyze(
      lastStep,
      targetCtx.postfixTargetOp().map((op) => this.planTargetOp(op)),
    );
  }

  /**
   * One postfix step of an assignment target, as the chain walk needs it.
   *
   * #1445: `postfixTargetOp` is `.IDENTIFIER`, `[e]` or `[e, e]`, so the only
   * thing the walk read off a node was which of those it is. The indexes stay
   * unrendered behind a thunk -- most chains are not bit accesses, and
   * rendering an index queues a pending temp declaration in some shapes. See
   * `TPlannedTargetOp`.
   */
  private planTargetOp(op: Parser.PostfixTargetOpContext): TPlannedTargetOp {
    const member = op.IDENTIFIER();
    if (member) {
      return { kind: "member", name: member.getText() };
    }

    const indexes = op.expression();
    return {
      kind: "subscript",
      indexCount: indexes.length,
      renderIndexes: () =>
        indexes.map((index) => this.generateExpression(index)),
      foldWidth: () =>
        indexes.length === 2 ? this.tryEvaluateConstant(indexes[1]) : undefined,
    };
  }

  /** #1668 (C7): what an assignment target writes, by the one binder */
  private targetDeclaration(
    target: Parser.AssignmentTargetContext,
  ): IChainBase {
    const typing = this.host.state.typingContext();
    return DeclaredTypeInfo.ofChain(
      OperandTyper.chainOf(target, typing),
      typing.symbols,
      this.host.state.symbolTable,
      this.host.state.targetDescription,
    );
  }

  /**
   * The type an assignment's value is rendered against: what the target
   * holds, as the typer types it -- its C-Next name, or, where C-Next does
   * not fix the width (a header `size_t`), the header's spelling, so the
   * output is the same on every target -- with `::` for a C++ namespace's
   * type. #1760 review: three walkers derived it from the target's shape,
   * and a header `uint8_t` field came back as that spelling, which the
   * MISRA C:2012 Rule 10.3 cast does not read, while a scalar's bit range
   * and a bitmap field had none at all. A slice's value is serialized at
   * its own width, so it has none (#1085).
   */
  private assignedValueType(
    targetCtx: Parser.AssignmentTargetContext,
    target: IChainBase,
  ): string | null {
    if (target.last?.subscript === "array_slice") return null;
    const written = OperandTyper.typeOfTarget(
      targetCtx,
      this.host.state.typingContext(),
    );
    const name = written?.cType ?? written?.typeName ?? null;
    return name === null
      ? null
      : CppNamespaceUtils.convertToCppNamespace(
          name,
          this.host.state.symbolTable,
        );
  }

  private generateAssignment(ctx: TAssignmentSite): string {
    const targetCtx = ctx.assignmentTarget();

    // #1668 (C7): what the target writes, bound once -- the expected type
    // below and every classifier rule and handler read this
    const target = this.targetDeclaration(targetCtx);
    const expectedType = this.assignedValueType(targetCtx, target);
    // withExpectedType restores expectedType however the render exits
    const value = this.host.state.withExpectedType(expectedType, () =>
      this.generateExpression(ctx.expression()),
    );

    // #1322: the operator was mapped to its C form here and used for nothing
    // but the `isCompound` flag that `AssignmentValidator` took. ADR-065's
    // handlers do their own mapping from `ctx`, so both are gone with it.

    // #1322: `AssignmentValidator.validate` was called here, and by the end of
    // the relocation it validated nothing -- ADR-013's const rule is E0877,
    // ADR-017's enum rule E0428, ADR-024's conversions E0868/E0869, ADR-036's
    // bounds E0854, ADR-004's `ro` write E0871 and ADR-029's callback typing
    // E0879/E0880, every one of them authored in pass 2.1 at the target's own
    // position. What was left was this single line of emission bookkeeping
    // wrapped in a class named for the job it no longer did, so the class is
    // deleted rather than left as a misleading name over a side effect.
    //
    // Writing to a float invalidates its bit-shadow: the union copy is stale
    // until the next read refreshes it. Only a whole-variable assignment does
    // this -- writing THROUGH a member or an element does not rebind the float.
    if (targetCtx.postfixTargetOp().length === 0) {
      const assignedName = targetCtx.IDENTIFIER()?.getText();
      if (assignedName !== undefined) {
        this.host.state.floatShadowCurrent.delete(
          BitRangeHelper.getShadowVarName(assignedName),
        );
      }
    }

    // ADR-065: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(ctx, {
      target,
      state: this.host.state,
      // Already rendered, inside the expectedType window above -- never again.
      generatedValue: () => value,
      generateAssignmentTarget: (target, opCount) =>
        this.generateAssignmentTarget(target, opCount),
      analyzeMemberChainForBitAccess: (target, lastStep) =>
        this.analyzeMemberChainForBitAccess(target, lastStep),
      generateExpression: (expr) => this.generateExpression(expr),
      tryEvaluateConstant: (expr) => this.tryEvaluateConstant(expr),
      expressionType: (expr) => this.directTypeOf(expr),
      integerExpressionType: (expr) => this.integerTypeOf(expr),
      hasFloatingOperand: (expr) => this.hasFloatingLeaf(expr),
      toCOperator: (cnextOp, line) =>
        AssignmentOperatorMapper.toCOperator(cnextOp, line),
    });
    // ADR-065: Handlers access CodeGenState directly, no deps needed
    const assignmentKind = AssignmentClassifier.classify(
      assignCtx,
      this.host.state,
    );
    const handler = AssignmentHandlerRegistry.getHandler(assignmentKind);
    return handler(assignCtx);
  }

  /**
   * Build dependencies for SimpleIdentifierResolver
   */
  private _buildSimpleIdentifierDeps(): ISimpleIdentifierDeps {
    return {
      getParameterInfo: (name: string) =>
        this.host.state.currentParameters.get(name),
      // A target with no postfix op is the parameter's whole value, written
      // as the read side reads it (#1760 second review: `p = (*q);`)
      resolveParameter: (name: string, paramInfo: TParameterInfo) =>
        memberAccessChain.wholeParamValue(
          ParameterDereferenceResolver.resolve(
            name,
            paramInfo,
            this._buildParameterDereferenceDeps(),
          ),
          paramInfo,
          this.host.state.cppMode,
        ),
      resolveBareIdentifier: (name: string, at: ISourcePosition) =>
        TypeValidator.resolveBareIdentifier(
          name,
          at,
          (n: string) => this.host.isKnownStruct(n),
          this.host.state,
        ),
    };
  }

  /**
   * Extract postfix operations from parser contexts
   */
  private _extractPostfixOperations(
    postfixOps: Parser.PostfixTargetOpContext[],
  ): IPostfixOperation[] {
    return postfixOps.map((op) => {
      const expressions = op.expression();
      return {
        memberName: op.IDENTIFIER()?.getText() ?? null,
        indexCount: expressions.length,
        // #1652: the nodes stay closed over HERE, in the walk. What crosses
        // into the render layer is a count and a function returning strings.
        renderIndexes: () =>
          expressions.map((expr) => this.generateExpression(expr)),
      };
    });
  }

  /**
   * Build dependencies for PostfixChainBuilder
   */
  private _buildPostfixChainDeps(
    firstId: string,
    hasGlobal: boolean,
    hasThis: boolean,
    rootTypeInfo: TTypeInfo | undefined,
  ): IPostfixChainDeps {
    // How the root is held: the one answer the read path reads too (#1760
    // review: a local #895 made a pointer took `.`)
    const holding = memberAccessChain.rootHolding(
      this.host.state.currentParameters.get(firstId),
      rootTypeInfo,
      this.host,
    );
    const isCppAccess = hasGlobal && this.host.isCppScopeSymbol(firstId);
    const separatorDeps = this._buildMemberSeparatorDeps();

    const separatorCtx: ISeparatorContext =
      MemberSeparatorResolver.buildContext(
        {
          firstId,
          hasGlobal,
          hasThis,
          currentScopePath: this.host.state.currentScopePath,
          holding,
          isCppAccess,
        },
        separatorDeps,
      );

    return {
      getSeparator: (isFirstOp: boolean, identifierChain: string[]) =>
        MemberSeparatorResolver.getSeparator(
          isFirstOp,
          identifierChain,
          separatorCtx,
          separatorDeps,
        ),
    };
  }

  /**
   * What a `return` carries. `node.expression()` was asked twice here -- once
   * as a predicate and once with `!` -- which is what a union states once.
   */
  private planReturn(ctx: Parser.ReturnStatementContext): TPlannedReturn {
    const exprCtx = ctx.expression();
    if (!exprCtx) {
      return { kind: "void" };
    }

    return {
      kind: "value",
      render: (expectedType) =>
        expectedType
          ? this.generateExpressionWithExpectedType(exprCtx, expectedType)
          : this.generateExpression(exprCtx),
    };
  }

  /**
   * An `if`, with the strlen-cache counts it needs before anything renders.
   *
   * The counts are eager because counting walks the tree and emits nothing.
   * The three branches are thunks because `generateIf` has to flush the
   * condition's pending temps before either branch renders (Issue #250).
   *
   * The counts cover the condition and the THEN block only, never the else.
   * That asymmetry is preserved rather than tidied: the cache declaration is
   * emitted in front of the whole statement, but widening the counts would
   * cache a length read only on a path the declaration's own value may not
   * describe.
   */
  private planIf(ctx: Parser.IfStatementContext): IPlannedIf {
    const conditionCtx = ctx.expression();
    const statements = ctx.statement();
    const thenStmt = statements[0];

    const lengthCounts = StringLengthCounter.countExpression(
      conditionCtx,
      this.host.state,
    );
    const thenBlock = thenStmt.block();
    if (thenBlock) {
      StringLengthCounter.countBlockInto(
        thenBlock,
        lengthCounts,
        this.host.state,
      );
    }

    return {
      lengthCounts,
      renderCondition: () => this.generateExpression(conditionCtx),
      renderThen: () => this.generateStatement(thenStmt),
      renderElse:
        statements.length > 1
          ? () => this.generateStatement(statements[1])
          : null,
    };
  }

  /** A `while`: condition then body. */
  private planWhile(ctx: Parser.WhileStatementContext): IPlannedLoop {
    return {
      renderCondition: () => this.generateExpression(ctx.expression()),
      renderBody: () => this.generateStatement(ctx.statement()),
    };
  }

  /**
   * A `do ... while` (ADR-027): the same two parts as `while`, and the
   * generator calls them in the other order. Note the body is a BLOCK here and
   * a statement there -- which is exactly the difference a thunk hides.
   */
  private planDoWhile(ctx: Parser.DoWhileStatementContext): IPlannedLoop {
    return {
      renderCondition: () => this.generateExpression(ctx.expression()),
      renderBody: () => this.generateBlock(ctx.block()),
    };
  }

  /** An ADR-068 `forever`: a body and nothing else. */
  private planForever(ctx: Parser.ForeverStatementContext): IPlannedForever {
    return { renderBody: () => this.generateBlock(ctx.block()) };
  }

  /**
   * A variable declared in a `for` header.
   *
   * `typeName` is eager, and that is the one ordering claim worth checking:
   * today it renders before `registerLocalVariable`, and planning is also
   * before it, so the relative order holds. The dimensions and the initializer
   * are thunks because registration sits between them and the type -- it is
   * what yields the EMITTED name (ADR-057), and an initializer rendered ahead
   * of it would resolve the loop variable's own name against the outer scope.
   */
  private planForVarDecl(ctx: Parser.ForVarDeclContext): IPlannedForVarDecl {
    // Issue #696: Use shared modifier builder
    const modifiers = VariableModifierBuilder.buildSimple(ctx);
    // #1484: a `for` init declares a variable like any other, including one
    // typed by an ADR-029 function-as-type.
    const typeName = this.generateDeclaredType(ctx.type());
    const arrayDims = ctx.arrayDimension();
    const initCtx = ctx.expression();

    return {
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      typeName,
      declaredName: ctx.IDENTIFIER().getText(),
      renderArrayDimensions:
        arrayDims.length > 0
          ? () => this.generateArrayDimensions(arrayDims)
          : null,
      renderInitializer: initCtx
        ? (expectedType) =>
            this.generateExpressionWithExpectedType(initCtx, expectedType)
        : null,
    };
  }

  /**
   * An assignment in a `for` header -- the init form and the update form
   * alike.
   *
   * #1647: rendered by `generateAssignment`, the statement path itself, so
   * the header is classified and handled exactly as a statement is: ADR-044's
   * clamp and MISRA C:2012 Rule 7.2's suffix included. Only the terminator
   * differs, since a header clause is an expression, not a statement.
   */
  private planForAssignment(site: TAssignmentSite): IPlannedForAssignment {
    return {
      render: () => {
        const statement = this.generateAssignment(site);
        if (!statement.endsWith(";")) {
          throw new Error(
            `Internal error: a for-header assignment rendered as '${statement}', not one statement`,
          );
        }
        return statement.slice(0, -1);
      },
    };
  }

  /** A `for` header and its body. */
  private planFor(ctx: Parser.ForStatementContext): IPlannedFor {
    const forUpdate = ctx.forUpdate();

    return {
      init: this.planForInit(ctx.forInit()),
      // `for (;;)` is E0707 in pass 2.1, so the controlling expression is
      // guaranteed present here.
      renderCondition: () => this.generateExpression(ctx.expression()!),
      update: forUpdate ? this.planForAssignment(forUpdate) : null,
      renderBody: () => this.generateStatement(ctx.statement()),
    };
  }

  /** Which of the two `for` init forms this header uses, if either. */
  private planForInit(ctx: Parser.ForInitContext | null): IPlannedFor["init"] {
    const varDecl = ctx?.forVarDecl();
    if (varDecl) {
      return { kind: "varDecl", plan: this.planForVarDecl(varDecl) };
    }

    const assignment = ctx?.forAssignment();
    if (assignment) {
      return {
        kind: "assignment",
        plan: this.planForAssignment(assignment),
      };
    }

    return null;
  }

  private generateIf(ctx: Parser.IfStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateIf,
      this.planIf(ctx),
    );
  }

  private generateWhile(ctx: Parser.WhileStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateWhile,
      this.planWhile(ctx),
    );
  }

  private generateDoWhile(ctx: Parser.DoWhileStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateDoWhile,
      this.planDoWhile(ctx),
    );
  }

  private generateFor(ctx: Parser.ForStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateFor,
      this.planFor(ctx),
    );
  }

  private generateForever(ctx: Parser.ForeverStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateForever,
      this.planForever(ctx),
    );
  }

  private generateReturn(ctx: Parser.ReturnStatementContext): string {
    return this.invokeGenerator(
      controlFlowGenerators.generateReturn,
      this.planReturn(ctx),
    );
  }

  /**
   * ADR-050: Generate critical statement with PRIMASK wrapper
   * Ensures atomic execution of multi-variable operations
   */
  private generateCriticalStatement(
    ctx: Parser.CriticalStatementContext,
  ): string {
    // #1445: the block is rendered here, where the tree is, and the generator
    // wraps it. `generateBlock` still runs before the wrapper's irq_wrappers
    // effect is applied, so effect order is unchanged.
    return this.invokeGenerator(generateCriticalStatement, {
      blockCode: this.generateBlock(ctx.block()),
      line: ctx.start?.line,
    });
  }

  /**
   * An ADR-025 switch statement, decided (#1445).
   *
   * The subject is rendered here, and its enum type asked for, in that order
   * -- which is the node-walking order, and both can register effects.
   *
   * A case label's SIX alternatives are asked in the grammar's order, first
   * match wins, exactly as the generator asked them. Each body stays a thunk:
   * rendering a statement registers effects, and the generator decides how
   * deep each line indents.
   */
  private planSwitch(ctx: Parser.SwitchStatementContext): IPlannedSwitch {
    const subjectExpression = ctx.expression();
    const subject = this.generateExpression(subjectExpression);
    const subjectEnumType =
      this.getExpressionEnumType(subjectExpression) ?? undefined;
    const defaultCase = ctx.defaultCase();

    return {
      subject,
      subjectEnumType,
      cases: ctx.switchCase().map((switchCase) => ({
        labels: switchCase
          .caseLabel()
          .map((label) => this.planCaseLabel(label)),
        renderBody: () => this.renderStatements(switchCase.block()),
      })),
      renderDefaultBody: defaultCase
        ? () => this.renderStatements(defaultCase.block())
        : null,
    };
  }

  /**
   * Which of `caseLabel`'s six alternatives matched, and what it carries.
   *
   * The order is the grammar's and the generator's: qualified type,
   * identifier, integer, hex, binary, char. A char literal is its own arm
   * because it is the one that ignores a leading minus.
   */
  private planCaseLabel(ctx: Parser.CaseLabelContext): TPlannedCaseLabel {
    // A minus is the first child, for a negative literal.
    const negative =
      ctx.children !== null && ctx.children[0]?.getText() === "-";

    const qualified = ctx.qualifiedType();
    if (qualified) {
      return {
        kind: "qualified",
        parts: qualified.IDENTIFIER().map((id) => id.getText()),
      };
    }

    const identifier = ctx.IDENTIFIER();
    if (identifier) {
      return { kind: "identifier", name: identifier.getText() };
    }

    const integer = ctx.INTEGER_LITERAL();
    if (integer) {
      return { kind: "numeric", text: integer.getText(), negative };
    }

    const hex = ctx.HEX_LITERAL();
    if (hex) {
      return { kind: "numeric", text: hex.getText(), negative };
    }

    const binary = ctx.BINARY_LITERAL();
    if (binary) {
      return { kind: "binary", text: binary.getText(), negative };
    }

    const char = ctx.CHAR_LITERAL();
    if (char) {
      return { kind: "char", text: char.getText() };
    }

    return { kind: "none" };
  }

  /** Every statement of a block, rendered in order. */
  private renderStatements(ctx: Parser.BlockContext): readonly string[] {
    return ctx
      .statement()
      .map((statement) => this.generateStatement(statement));
  }

  private generateSwitch(ctx: Parser.SwitchStatementContext): string {
    return this.invokeGenerator(generateSwitchStatement, this.planSwitch(ctx));
  }

  /**
   * Resolve 'this' keyword to scope marker
   * ADR-016: 'this' returns a marker that postfixOps will transform to Scope_member
   */
  private _resolveThisKeyword(): string {
    // #1322: the `!currentScopePath` guard that stood here is now E0431 in 2.1,
    // with a real position. It threw the same string from four places in
    // `output/`, and every one reached the user as `1:0`.
    return "__THIS_SCOPE__";
  }

  /**
   * Resolve an identifier in a primary expression context
   * Handles: main args, parameters, local variables, scope resolution, enum members
   */
  private _resolveIdentifierExpression(
    id: string,
    at: ISourcePosition,
  ): string {
    // Special case: main function's args parameter -> argv
    if (this.host.state.mainArgsName && id === this.host.state.mainArgsName) {
      return "argv";
    }

    // ADR-006: Check if it's a function parameter
    const paramInfo = this.host.state.currentParameters.get(id);
    if (paramInfo) {
      return ParameterDereferenceResolver.resolve(
        id,
        paramInfo,
        this._buildParameterDereferenceDeps(),
      );
    }

    // ADR-016: Resolve bare identifier using local -> scope -> global priority
    const resolved = TypeValidator.resolveBareIdentifier(
      id,
      at,
      (name: string) => this.host.isKnownStruct(name),
      this.host.state,
    );
    if (resolved !== null) {
      // Issue #741: Check if this is a private const that should be inlined
      const constValue =
        this.host.state.symbols!.scopePrivateConstValues.get(resolved);
      if (constValue !== undefined) {
        return constValue;
      }
      return resolved;
    }

    // Issue #452: Check if identifier is an unqualified enum member reference
    const enumResolved = this._resolveUnqualifiedEnumMember(id);
    if (enumResolved !== null) {
      return enumResolved;
    }

    return id;
  }

  /**
   * Resolve an unqualified identifier as an enum member
   * Issue #452: Uses expectedType for type-aware resolution, falls back to searching all enums
   * @returns The qualified enum member access, or null if not an enum member
   */
  private _resolveUnqualifiedEnumMember(id: string): string | null {
    // Issue #872: MISRA contexts set expectedType for U suffix but suppress enum resolution
    // Bare enum resolution in function args was never allowed and requires ADR approval to change
    if (this.host.state.suppressBareEnumResolution) {
      // Fall through to error handling below - don't resolve bare enums
    } else if (
      // Type-aware resolution: check only the expected enum type
      this.host.state.expectedType &&
      this.host.state.symbols!.knownEnums.has(this.host.state.expectedType)
    ) {
      const members = this.host.state.symbols!.enumMembers.get(
        this.host.state.expectedType,
      );
      if (members?.has(id)) {
        return `${this.host.state.expectedType}${this.host.getScopeSeparator(false)}${id}`;
      }
      // Not a member of the expected enum: falls through to the assertion
      // below. Before #1322 this returned null and the bare name was emitted
      // into C when another enum declared it.
    }

    // #1322: a bare member with no enum naming its position is E0424 in pass
    // 2.1 (ADR-017). Reaching here with a match means the emission would put a
    // bare `RED` into C, so it is asserted rather than guessed at.
    const matchingEnums: string[] = [];
    for (const [enumName, members] of this.host.state.symbols!.enumMembers) {
      if (members.has(id)) {
        matchingEnums.push(enumName);
      }
    }
    invariant(
      matchingEnums.length === 0,
      `a bare enum member is resolved by its position -- E0424 rejects '${id}' ` +
        `(declared by ${matchingEnums.join(", ")}) here in pass 2.1, before this runs`,
    );
    return null;
  }

  /**
   * Generate a literal expression with C++ mode handling
   * Uses extracted literal generator
   */
  private _generateLiteralExpression(ctx: Parser.LiteralContext): string {
    const result = generateLiteral(
      ctx.getText(),
      this.host.getState(),
      this.transpileState,
    );
    this.host.applyEffects(result.effects);

    // Issue #304/#644: Transform NULL → nullptr in C++ mode
    if (result.code === "NULL") {
      return CppModeHelper.nullLiteral(this.host.state);
    }

    return result.code;
  }

  /**
   * ADR-017: Generate cast expression
   * C mode:   (u8)State.IDLE -> (uint8_t)State_IDLE
   * C++ mode: (u8)State.IDLE -> static_cast<uint8_t>(State_IDLE)
   * Issue #267: Use C++ casts when cppMode is enabled
   */
  /**
   * What rendering a cast needs. The render order is fixed HERE, not in the
   * generator: the target type is rendered before the operand because
   * `generateType` may register an include and rendering the operand may
   * allocate a `cnx_tmp<N>`, and swapping them renames temps in emitted C.
   *
   * #1322: ADR-024's cast rules -- narrowing and sign change -- are E0869 in
   * pass 2.1. They stood here as two throws that reached the user as `1:0`.
   */
  private planCast(ctx: Parser.CastExpressionContext): IPlannedCast {
    const targetType = this.generateType(ctx.type());
    const targetTypeName = ctx.type().getText();
    const operandCode = this.generateUnaryExpr(ctx.unaryExpression());
    const operand = OperandTyper.typeOf(
      ctx.unaryExpression(),
      this.host.state.typingContext(),
    );
    const operandType = PlanTyping.castSourceType(operand);

    return {
      targetType,
      targetTypeName,
      operandCode,
      operandType,
      clampForm: CodeGenWalker.clampFormOf(
        operand,
        operandType,
        targetTypeName,
      ),
    };
  }

  /**
   * ADR-024's saturation, and #1668's single-evaluation form of it: a cast
   * whose operand has a side effect -- a call, or a volatile or atomic read,
   * as the one operand typer reports -- calls a helper, so the operand is
   * evaluated once. A pure operand keeps the bounded ternary.
   */
  private static clampFormOf(
    operand: IOperandType | null,
    operandType: string | null,
    targetTypeName: string,
  ): IPlannedCast["clampForm"] {
    if (!CastRequirement.requiresClamping(operandType, targetTypeName)) {
      return null;
    }
    return operand?.hasSideEffect ? "helper" : "inline";
  }

  /**
   * ADR-023: Generate sizeof expression
   * Delegates to SizeofResolver which uses this.host.state.
   */
  private generateSizeofExpr(ctx: Parser.SizeofExpressionContext): string {
    return SizeofResolver.generate(
      this.planSizeofOperand(ctx),
      this.host.state,
    );
  }

  /**
   * Which of `sizeof`'s four shapes this is, and the names each one needs.
   *
   * #1445: the discrimination is here because it is a question about which
   * grammar alternative matched. `generateType` for the qualified arm goes
   * over as a thunk -- `a.b` may turn out to be a member access, and
   * rendering it as a type would register an include for a type the program
   * never names. See `TSizeofOperand`.
   */
  private planSizeofOperand(
    ctx: Parser.SizeofExpressionContext,
  ): TSizeofOperand {
    const typeCtx = ctx.type();
    if (typeCtx) {
      const qualified = typeCtx.qualifiedType();
      if (qualified) {
        const identifiers = qualified.IDENTIFIER();
        return {
          kind: "qualified-type",
          firstName: identifiers[0].getText(),
          memberName: identifiers[1].getText(),
          renderTypeName: () => this.generateType(typeCtx),
        };
      }
      // The whole type's text, not the userType's: that is what this arm has
      // always been given, and the two differ for a type carrying dimensions.
      if (typeCtx.userType()) {
        return { kind: "user-type", text: typeCtx.getText() };
      }
      return { kind: "plain-type", cTypeName: this.generateType(typeCtx) };
    }

    const expression = ctx.expression()!;
    return {
      kind: "expression",
      simpleIdentifier: ExpressionUnwrapper.getSimpleIdentifier(expression),
      hasSideEffects: this.hasSideEffects(expression),
      code: this.generateExpression(expression),
    };
  }

  /**
   * True when the text contains an identifier followed by `(`, as
   * /[a-zA-Z_]\w*\s*\(/ did -- scanned rather than matched, because that
   * pattern retries \w* from every position when no `(` follows (S8786).
   *
   * The match may begin anywhere inside a word run, so the run before the
   * parenthesis needs only to contain one letter or underscore: "9a8(" matches
   * (starting at 'a') while "99(" does not.
   */
  private static _hasIdentifierBeforeParen(text: string): boolean {
    for (let index = 0; index < text.length; index += 1) {
      if (text[index] !== "(") {
        continue;
      }
      let cursor = index - 1;
      while (cursor >= 0 && /\s/.test(text[cursor])) {
        cursor -= 1;
      }
      let sawIdentifierStart = false;
      while (cursor >= 0 && /\w/.test(text[cursor])) {
        if (/[a-zA-Z_]/.test(text[cursor])) {
          sawIdentifierStart = true;
        }
        cursor -= 1;
      }
      if (sawIdentifierStart) {
        return true;
      }
    }
    return false;
  }

  /**
   * ADR-023: Check if expression has side effects (E0602)
   * Side effects include: assignments, function calls
   */
  private hasSideEffects(expr: Parser.ExpressionContext): boolean {
    const text = expr.getText();

    // Check for assignment operators
    if (text.includes("<-")) return true;
    if (text.includes("+<-")) return true;
    if (text.includes("-<-")) return true;
    if (text.includes("*<-")) return true;
    if (text.includes("/<-")) return true;
    if (text.includes("%<-")) return true;
    if (text.includes("&<-")) return true;
    if (text.includes("|<-")) return true;
    if (text.includes("^<-")) return true;
    if (text.includes("<<<-")) return true;
    if (text.includes(">><-")) return true;

    // Check for function calls by looking for identifier followed by (
    // This is a heuristic - looking for "name(" pattern that's not a cast
    if (CodeGenWalker._hasIdentifierBeforeParen(text)) {
      // Could be a function call - walk the tree to confirm
      return this.hasPostfixFunctionCall(expr);
    }

    return false;
  }

  /**
   * ADR-023: Check if expression contains a function call (postfix with argumentList)
   */
  private hasPostfixFunctionCall(expr: Parser.ExpressionContext): boolean {
    return ExpressionUtils.hasFunctionCall(expr);
  }

  /**
   * Generate temp variable declarations for string lengths that are accessed 2+ times.
   * Returns the declarations as a string and populates the lengthCache.
   */
  /**
   * Generate all needed overflow helper functions
   * Delegates to HelperGenerator
   *
   * Takes the ops from the PLAN, not from `CodeGenState`. Reading the state
   * here while the plan also carried them was the fact in two places with the
   * renderer using the other one -- the duplicate path this pass exists to
   * remove, reintroduced by the pass itself.
   */
  private generateOverflowHelpers(clampOps: readonly string[]): string[] {
    return helperGenerateOverflowHelpers(
      new Set(clampOps),
      this.host.state.debugMode,
    );
  }

  /**
   * Generate platform-portable IRQ wrappers for critical sections (ADR-050, Issue #778)
   *
   * Generates code that works on:
   * - ARM platforms (bare-metal or Arduino): Uses inline assembly for PRIMASK access
   * - AVR Arduino: Uses SREG save/restore pattern
   * - Other platforms: Falls back to CMSIS intrinsics
   *
   * This avoids dependencies on CMSIS headers which may not be available on all platforms
   * (e.g., Teensy 4.x via Arduino.h doesn't expose __get_PRIMASK/__set_PRIMASK).
   */
  private generateIrqWrappers(): string[] {
    return [
      "// ADR-050: Platform-portable IRQ wrappers for critical sections",
      "#if defined(__arm__) || defined(__ARM_ARCH)",
      "// ARM platforms (including ARM Arduino like Teensy 4.x, Due, Zero)",
      "// Provide inline assembly PRIMASK access to avoid CMSIS header dependencies",
      "__attribute__((always_inline)) static inline uint32_t __cnx_get_PRIMASK(void) {",
      "    uint32_t result;",
      '    __asm volatile ("MRS %0, primask" : "=r" (result));',
      "    return result;",
      "}",
      "__attribute__((always_inline)) static inline void __cnx_set_PRIMASK(uint32_t mask) {",
      '    __asm volatile ("MSR primask, %0" :: "r" (mask) : "memory");',
      "}",
      "#if defined(ARDUINO)",
      "static inline void __cnx_disable_irq(void) { noInterrupts(); }",
      "#else",
      "__attribute__((always_inline)) static inline void __cnx_disable_irq(void) {",
      '    __asm volatile ("cpsid i" ::: "memory");',
      "}",
      "#endif",
      "#elif defined(__AVR__)",
      "// AVR Arduino: use SREG for interrupt state",
      "// SREG is declared by avr-libc's <avr/io.h>, cli() by its <avr/interrupt.h>",
      "#include <avr/io.h>",
      "#include <avr/interrupt.h>",
      "// Note: Uses PRIMASK naming for API consistency across platforms (AVR has no PRIMASK)",
      "// Returns uint8_t which is implicitly widened to uint32_t at call sites - this is intentional",
      "static inline uint8_t __cnx_get_PRIMASK(void) { return SREG; }",
      "static inline void __cnx_set_PRIMASK(uint8_t mask) { SREG = mask; }",
      "static inline void __cnx_disable_irq(void) { cli(); }",
      "#else",
      "// Fallback: assume CMSIS is available",
      "static inline void __cnx_disable_irq(void) { __disable_irq(); }",
      "static inline uint32_t __cnx_get_PRIMASK(void) { return __get_PRIMASK(); }",
      "static inline void __cnx_set_PRIMASK(uint32_t mask) { __set_PRIMASK(mask); }",
      "#endif",
      "",
    ];
  }

  /**
   * Process a preprocessor directive
   * Delegates to IncludeGenerator
   */
  /**
   * Which of `defineDirective`'s four alternatives matched.
   *
   * Early returns rather than a ternary chain: as one expression this was two
   * nested ternaries and SonarCloud S3358 flagged both (introduced by this
   * card's slice 12, caught by the PR-scoped issue list while the quality gate
   * still read OK -- which is why the list is the standard here and the gate
   * is not).
   */
  private static defineDirectiveKind(
    define: Parser.DefineDirectiveContext,
  ): IPlannedDirective["kind"] {
    if (define.DEFINE_FUNCTION()) return "define-function";
    if (define.DEFINE_WITH_VALUE()) return "define-value";
    if (define.DEFINE_FLAG()) return "define-flag";
    return "define-other";
  }

  private processPreprocessorDirective(
    ctx: Parser.PreprocessorDirectiveContext,
  ): string | null {
    // #1445: the generator takes the directive's SHAPE and its text.
    // `getText()` is the concatenated token text, handed over VERBATIM --
    // rebuilding it from source positions would change the emitted line. The
    // generator trims, because trimming is string work and that is where its
    // test can reach it.
    const define = ctx.defineDirective();
    if (define) {
      return includeProcessPreprocessorDirective({
        kind: CodeGenWalker.defineDirectiveKind(define),
        text: define.getText(),
      });
    }

    const conditional = ctx.conditionalDirective();
    if (conditional) {
      return includeProcessPreprocessorDirective({
        kind: "conditional",
        text: conditional.getText(),
      });
    }

    return includeProcessPreprocessorDirective({ kind: "none", text: "" });
  }

  /**
   * Get comments that appear before a parse tree node
   */
  private getLeadingComments(ctx: {
    start?: { tokenIndex: number } | null;
  }): IComment[] {
    return commentGetLeadingComments(ctx, this.commentExtractor);
  }

  /**
   * Format leading comments with current indentation
   */
  private formatLeadingComments(comments: IComment[]): string[] {
    const indent = FormatUtils.indent(this.host.state.indentLevel);
    return commentFormatLeadingComments(
      comments,
      this.commentFormatter,
      indent,
    );
  }

  /**
   * ADR-051: Generate safe division helper functions for used integer types only
   * Delegates to HelperGenerator
   */
  private generateSafeDivHelpers(safeDivOps: readonly string[]): string[] {
    return helperGenerateSafeDivHelpers(new Set(safeDivOps));
  }

  // === Pipeline surface ===
  //
  // `Transpiler` holds the walker, because the entry point it calls --
  // `generate(tree, …)` -- takes the parse tree and therefore lives here. The
  // two facts it reads afterwards are accumulated on the render side, so they
  // are delegated rather than moved: they are answers ABOUT what was emitted,
  // which is the host's business. Pass-by-value used to be a third, and is not
  // (#1671): 1.4 Resolve decides it, and `Transpiler` reads `Program`.

  getToolchainRequirements(
    ...args: Parameters<CodeGenerator["getToolchainRequirements"]>
  ): ReturnType<CodeGenerator["getToolchainRequirements"]> {
    return this.host.getToolchainRequirements(...args);
  }

  getFunctionUnmodifiedParams(
    ...args: Parameters<CodeGenerator["getFunctionUnmodifiedParams"]>
  ): ReturnType<CodeGenerator["getFunctionUnmodifiedParams"]> {
    return this.host.getFunctionUnmodifiedParams(...args);
  }
}

export default CodeGenWalker;
