/**
 * CodeGenWalker -- the walk over one file's plain-data `IProgramSyntax`
 * that drives code generation.
 *
 * #1445 box 3: the render pass must not hold parse nodes. This class is the
 * half of the former `CodeGenerator` that did, extracted whole: every member
 * whose text names a `Parser.*Context`, `ParserRuleContext` or
 * `CommonTokenStream`, plus the parse-free members that only those call.
 *
 * #1932 then took the walk itself off the tree: 1.2's `ProgramLowering`
 * produces `IParsedFile.program`, the walker generates from it, and it names
 * no parse type -- `parse-tree-confined-to-parser` is `error` here.
 *
 * It lives at `src/TRANSPILE/` rather than in a pass because it is not one.
 * It walks the file and drives 2.2 and 2.3 for a single file -- the same role
 * `Transpiler` plays for a run, and README §1's tree draws it there. It cannot
 * live in `2-Plan/`: `2-2-plan-reads-no-later-pass` is `error` with
 * `reachable: true`, and the walk
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
import headerCType from "../utils/headerCType";
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
import type IAssignmentSyntax from "../types/syntax/IAssignmentSyntax";
import type IVariableDeclarationSyntax from "../types/syntax/IVariableDeclarationSyntax";
import type TStatement from "../types/syntax/TStatement";
import type IStructDeclarationSyntax from "../types/syntax/IStructDeclarationSyntax";
import type IRegisterDeclarationSyntax from "../types/syntax/IRegisterDeclarationSyntax";
import type IParameterSyntax from "../types/syntax/IParameterSyntax";
import type IFunctionDeclarationSyntax from "../types/syntax/IFunctionDeclarationSyntax";
import type TDeclarationSyntax from "../types/syntax/TDeclarationSyntax";
import type IProgramSyntax from "../types/syntax/IProgramSyntax";
import type TCaseLabelSyntax from "../types/syntax/TCaseLabelSyntax";
import type TBlockSyntax from "../types/syntax/TBlockSyntax";
import AssignmentTarget from "../utils/AssignmentTarget";
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
import ExpressionShape from "../utils/ExpressionShape";
import type IChainHead from "../types/IChainHead";
import ExpressionCalls from "../utils/ExpressionCalls";
import helperGenerators from "./3-Render/codegen/generators/support/HelperGenerator";
import includeGenerators from "./3-Render/codegen/generators/support/IncludeGenerator";
import DeclaredTypeInfo from "../PARSE/3-Declare/DeclaredTypeInfo";
import DeclaredPointer from "../utils/DeclaredPointer";
import type IChainBase from "../types/IChainBase";
import type TTypeInfo from "../types/TTypeInfo";
import memberAccessChain from "./3-Render/codegen/memberAccessChain";
import type IRootHolding from "./3-Render/codegen/types/IRootHolding";
import AssignmentHandlerRegistry from "./3-Render/codegen/assignment/index";
import AssignmentClassifier from "./2-Plan/AssignmentClassifier";
import ForHeaderAssignment from "../utils/ForHeaderAssignment";
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
import type TExpression from "../types/syntax/TExpression";
import type TExpressionOf from "../types/syntax/TExpressionOf";
import type TPostfixOpSyntax from "../types/syntax/TPostfixOpSyntax";
import type TTypeSyntax from "../types/syntax/TTypeSyntax";
import type ISourcePosition from "../utils/types/ISourcePosition";
import IMemberSeparatorDeps from "./3-Render/codegen/types/IMemberSeparatorDeps";
import IParameterDereferenceDeps from "./3-Render/codegen/types/IParameterDereferenceDeps";
import ISeparatorContext from "./3-Render/codegen/types/ISeparatorContext";
import TypeGenerationHelper from "./3-Render/codegen/helpers/TypeGenerationHelper";
import type IPlannedType from "./3-Render/codegen/types/IPlannedType";
import type IPlannedParameter from "./3-Render/codegen/types/IPlannedParameter";
import type IPlannedFunctionParameter from "./3-Render/codegen/types/IPlannedFunctionParameter";
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
import MainSignature from "../utils/MainSignature";
import ScopeUtils from "../utils/ScopeUtils";
import TypeNameLadder from "../utils/TypeNameLadder";
import type ITargetDescription from "../types/ITargetDescription";
import SymbolTypeResolver from "../utils/TypeResolver";
import ESourceLanguage from "../utils/types/ESourceLanguage";
import SymbolGuards from "../types/symbols/SymbolGuards";
import type IFunctionSymbol from "../types/symbols/IFunctionSymbol";
import type TSymbol from "../types/symbols/TSymbol";
import type ICallbackTypeInfo from "../types/ICallbackTypeInfo";

const {
  generateOverflowHelpers: helperGenerateOverflowHelpers,
  generateSafeDivHelpers: helperGenerateSafeDivHelpers,
} = helperGenerators;

const {
  transformIncludeDirective: includeTransformIncludeDirective,
  processPreprocessorDirective: includeProcessPreprocessorDirective,
} = includeGenerators;

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

  /**
   * Lookup map for primitive type zero initializers. `false` needs no record
   * of its own (#1927): it initializes a `bool` declaration, whose type
   * `generateType` records.
   */
  private static readonly PRIMITIVE_ZERO_VALUES: ReadonlyMap<string, string> =
    new Map([
      ["bool", "false"],
      ["f32", "0.0f"],
      ["f64", "0.0"],
    ]);

  private readonly commentFormatter: CommentFormatter = new CommentFormatter();

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

  private renderExpression(expr: TExpression): string {
    return this.invokeGenerator(generateTernaryExpr, this.planTernary(expr));
  }

  /**
   * A ternary reduced to its operands (#1445).
   *
   * An expression that is not a ternary is a plain value. The arms go over as thunks
   * because Issue #992's rule is the generator's: see `TPlannedTernary`.
   */
  private planTernary(expr: TExpression): TPlannedTernary {
    if (expr.kind !== "ternary") {
      return { kind: "value", code: this.renderBinary(expr) };
    }
    const { condition, whenTrue, whenFalse } = expr;
    return {
      kind: "ternary",
      renderCondition: () => this.renderBinary(condition),
      renderTrue: () => this.renderBinary(whenTrue),
      renderFalse: () => this.renderBinary(whenFalse),
    };
  }

  private renderType(type: TTypeSyntax): string {
    const plan = this.planType(type);

    // Track required includes based on type usage
    const requiredInclude = TypeGenerationHelper.getRequiredInclude(plan);
    if (requiredInclude) {
      this.host.state.requireInclude(requiredInclude);
    }

    const cType = TypeGenerationHelper.generate(plan, {
      checkNeedsStructKeyword: (name) =>
        this.host.state.symbolTable.checkNeedsStructKeyword(name),
      isCrossFileDeclaration: (name) =>
        this.host.state.isCrossFileDeclaration(name),
    });
    // #1927: the plan decides `<stdint.h>` / `<stdbool.h>` from this spelling.
    this.host.state.emittedCTypes.add(cType);
    return cType;
  }

  /**
   * A type context reduced to what the renderer asks of it (#1445).
   *
   * The named branches come from `TypeNameLadder` -- the one ladder --
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
  private planType(type: TTypeSyntax): IPlannedType {
    const element = type.kind === "array" ? type.element : type;
    const deps = this.host.state.typeBindingDeps((identifiers) =>
      this.resolveQualifiedType(identifiers),
    );

    return {
      named: TypeNameLadder.classifyNamed(
        element,
        this.host.state.currentScopePath,
        deps,
      ),
      isString: element.kind === "string",
      stringTypeText: element.kind === "string" ? element.text : undefined,
      primitiveName: element.kind === "primitive" ? element.text : null,
      isArray: type.kind === "array",
      userTypeLine: element.kind === "user" ? element.span.line : undefined,
      text: type.text,
    };
  }

  /**
   * Generate a unary expression.
   */
  private renderUnary(expr: TExpression): string {
    // #1445: the generator takes the operator and the operand's generated
    // code. The recursion stays here, where the expression is.
    if (expr.kind !== "unary") {
      return this.invokeGenerator(generateUnaryExpr, {
        operator: null,
        operandCode: this.renderPostfix(expr),
        operandType: () => null,
      });
    }

    const operand = expr.operand;
    return this.invokeGenerator(generateUnaryExpr, {
      operator: expr.operator,
      operandCode: this.renderUnary(operand),
      // lazy: only `~` consults it
      operandType: () => this.directTypeOf(operand),
    });
  }

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
    head: IChainHead,
  ): { name: string; displayName: string; opOffset: number } | undefined {
    if (head.identifier === null) {
      return undefined;
    }
    const written = head.identifier.name;
    if (head.root === null) {
      return { name: written, displayName: written, opOffset: 0 };
    }
    // `this.x` is the scope-qualified variable `Scope_x`; `global.x` is plain `x`.
    const name =
      head.root === "this"
        ? QualifiedNameGenerator.forMember(
            this.host.state.currentScopePath,
            written,
          )
        : written;
    return {
      name,
      displayName: `${head.root}.${written}`,
      opOffset: head.opsConsumed,
    };
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
  private planPostfixExpression(expr: TExpression): IPlannedPostfix {
    const head = ExpressionShape.headOf(expr);
    const primary = head.primary;
    const ops = head.ops;
    const rootIdentifier =
      head.root === null ? (head.identifier?.name ?? undefined) : undefined;
    const subscriptBase = this.resolveSubscriptBase(head);

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
    const chain = OperandTyper.chainOf(expr, typing);
    const steps = chain.steps;
    const offset = head.opsConsumed;
    const plannedOps = ops.map((op, i) =>
      this.planPostfixOp(op, steps[i - offset] ?? null),
    );

    return {
      rootIdentifier,
      renderPrimary: () => this.renderPrimary(primary),
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
    op: TPostfixOpSyntax,
    step: IChainStep | null,
  ): TPlannedPostfixOp {
    const typedAs = step?.subscript ?? null;
    switch (op.kind) {
      case "member":
        return { kind: "member", name: op.name, step };
      case "subscript": {
        const indexes = op.indexes;
        // Issue #1094: the final index is the WIDTH on the two-index arm, and
        // folding it is what gets a const or macro width a precomputed mask
        // rather than a runtime one.
        const widthExpr = indexes.at(-1);
        // The typer types every subscript it walks, an untyped value's
        // included (the classifier's default for an unknown type)
        invariant(typedAs !== null, "the typer typed this subscript");
        return {
          kind: "subscript",
          indexCount: indexes.length,
          renderIndexes: () =>
            indexes.map((index) => this.renderExpression(index)),
          foldWidth: () =>
            widthExpr === undefined ? undefined : this.constantOf(widthExpr),
          typedAs,
          step,
        };
      }
      case "call": {
        const args = op.arguments;
        return {
          kind: "call",
          // #1508: ADR-010 is recorded at the CALL rather than at the directive --
          // an `#include` sits in no scope, function or variable, so the matrix's
          // context axis has nothing to ask it.
          line: op.span.line,
          // ADR-029: a callback-typed value names the function that is its type,
          // by C name -- the key `callbackTypes` holds. A function's own name is
          // not a typed value, so the typer's step has no `before`: null.
          calleeType: () => step?.before?.typeName ?? null,
          planArguments: () =>
            this.planCallArguments(args.length === 0 ? null : args),
        };
      }
      case "missing":
        invariant(
          false,
          "a missing postfix operation is a parse error, which stops the pipeline before render",
        );
    }
  }

  private renderPostfix(expr: TExpression): string {
    const result = generatePostfixExpression(
      this.planPostfixExpression(expr),
      this.host.getInput(),
      this.host.getState(),
      this.host,
    );
    this.host.applyEffects(result.effects);
    return result.code;
  }

  /**
   * The binary precedence ladder, collapsed.
   *
   * 1.2 lowers the grammar's ten levels to one `binary` node per real
   * operator run (#1932), so a plan is only as deep as the expression's
   * operator nesting, and a non-binary operand is a leaf.
   *
   * Every operand is a thunk that re-enters the planner one level down. That
   * laziness is in the PLANNER and not merely in a top-level thunk, because
   * `withoutExpectedType` is a dynamic scope over the whole operand subtree:
   * an operand nested any distance under a comparison must render inside the
   * window the renderer opens, and anything rendered at plan time renders
   * outside it (#1032).
   */
  private planBinaryExpr(expr: TExpression): TPlannedBinaryExpr {
    if (expr.kind !== "binary") {
      return { kind: "leaf", render: () => this.renderUnary(expr) };
    }
    const operands = expr.operands;
    const operators = [...expr.operators];
    const renderOperands = operands.map(
      (operand) => () => this.renderBinaryLevel(this.planBinaryExpr(operand)),
    );
    switch (expr.level) {
      case "or":
        return { kind: "join", separator: " || ", renderOperands };
      case "and":
        return { kind: "join", separator: " && ", renderOperands };
      case "bitwiseOr":
        return { kind: "join", separator: " | ", renderOperands };
      case "bitwiseXor":
        return { kind: "join", separator: " ^ ", renderOperands };
      case "bitwiseAnd":
        return { kind: "join", separator: " & ", renderOperands };
      case "equality": {
        const isStrcmp =
          this.isStringExpression(operands[0]) ||
          this.isStringExpression(operands[1]);
        return {
          kind: "comparison",
          defaultOperator: "=",
          operators,
          mapOperator: BinaryExprUtils.mapEqualityOperator,
          adrLine: operators.includes("=") ? expr.span.line : undefined,
          strcmp: isStrcmp ? { isNotEqual: operators[0] === "!=" } : null,
          renderOperands,
        };
      }
      case "relational":
        return {
          kind: "comparison",
          defaultOperator: "<",
          operators,
          mapOperator: null,
          adrLine: undefined,
          strcmp: null,
          renderOperands,
        };
      case "shift":
        return { kind: "shift", operators, renderOperands };
      case "additive":
      case "multiplicative":
        return {
          kind: "arithmetic",
          constantValue: this.constantValue(expr),
          defaultOperator: expr.level === "additive" ? "+" : "*",
          operators,
          clampType: () => this.compositeClampType(expr),
          clampBehavior: () => this.compositeClampBehavior(expr),
          adrLine: expr.span.line,
          renderOperands,
        };
    }
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
  private constantValue(expr: TExpression): string | null {
    const result = ConstantEvaluator.evaluate(
      ConstExprLowering.lower(expr),
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
  private compositeClampType(expr: TExpression): string | null {
    const t = OperandTyper.typeOf(expr, this.host.state.typingContext());
    return t?.bitWidth === null ? null : (t?.typeName ?? null);
  }

  /** #1668 (C6b): ADR-044's behavior for a composite, PlanTyping's row */
  private compositeClampBehavior(expr: TExpression): TOverflowBehavior | null {
    return PlanTyping.overflowOf(
      OperandTyper.valueLeaves(expr, this.host.state.typingContext()),
    );
  }

  private renderBinary(expr: TExpression): string {
    return this.invokeGenerator(generateBinaryExpr, this.planBinaryExpr(expr));
  }

  private enumTypeOf(expr: TExpression): string | null {
    const t = OperandTyper.typeOf(expr, this.host.state.typingContext());
    return t?.category === "enum" ? t.enumTypeName : null;
  }

  /**
   * Check if an expression is a string type.
   * ADR-045: Used to detect string comparisons and generate strcmp().
   * Issue #137: Extended to handle array element access (e.g., names[0])
   * Issue #1030: Extended to handle struct member access (e.g., person.name)
   */
  private isStringExpression(expr: TExpression): boolean {
    if (ExpressionShape.isStringLiteral(expr)) {
      return true;
    }

    return OperandTyper.isString(
      OperandTyper.typeOf(expr, this.host.state.typingContext()),
    );
  }

  private static positionOf(expr: TExpression): ISourcePosition {
    return { line: expr.span.line, column: expr.span.column };
  }

  /**
   * Generate function argument with pass-by-reference handling.
   * Part of IOrchestrator interface - delegates to ArgumentGenerator.
   */
  private generateFunctionArg(
    expr: TExpression,
    targetParamBaseType?: string,
  ): string {
    const simpleId = this.boundArgumentName(expr);
    const declared = this.nameTypeOf(expr);
    // #1445: thunks closing over `ctx`. `ArgumentGenerator` never read a
    // member off the node -- it threaded it through five callbacks and four
    // private helpers only to hand it back -- so the node stays here, where
    // the tree already is.
    return ArgumentGenerator.generateArg(
      simpleId,
      declared,
      targetParamBaseType,
      {
        generateExpression: () => this.renderExpression(expr),
        getLvalueType: () => this.getLvalueType(expr),
        getMemberAccessArrayStatus: () => this.getMemberAccessArrayStatus(expr),
        isCppMemberConversionRequired: (t) =>
          this.isCppMemberConversionRequired(expr, t),
        isStringSubscriptAccess: () => this.isStringSubscriptAccess(expr),
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
    expr: TExpression,
  ): { readonly id: string; readonly emitted: string } | null {
    const id = ExpressionShape.simpleIdentifier(expr);
    if (id === null) return null;
    return {
      id,
      emitted: this.boundName(id, CodeGenWalker.positionOf(expr)),
    };
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
  private nameTypeOf(expr: TExpression): TTypeInfo | undefined {
    const typing = this.host.state.typingContext();
    if (ExpressionShape.postfixView(expr) === null) return undefined;
    const chain = OperandTyper.chainOf(expr, typing);
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
  private isHandleArrayElement(expr: TExpression): boolean {
    const typing = this.host.state.typingContext();
    if (ExpressionShape.postfixView(expr) === null) return false;
    const chain = OperandTyper.chainOf(expr, typing);
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

  /** #1668 (C6c): an expression's one type for 2.2, PlanTyping's row */
  private directTypeOf(expr: TExpression): string | null {
    return PlanTyping.directTypeName(
      OperandTyper.typeOf(expr, this.host.state.typingContext()),
    );
  }

  /**
   * The integer type an expression converts from: its one type, or a
   * composite's integer type -- the answer 2.1's E0869 reads
   */
  private integerTypeOf(expr: TExpression): string | null {
    return this.directTypeOf(expr) ?? this.compositeClampType(expr);
  }

  /** Whether any value leaf is floating, or indeterminate (CompositeType) */
  private hasFloatingLeaf(expr: TExpression): boolean {
    const typing = this.host.state.typingContext();
    return CompositeType.anyFloating(OperandTyper.valueLeaves(expr, typing));
  }

  private renderBlock(block: Pick<TBlockSyntax, "statements">): string {
    const lines: string[] = ["{"];
    const innerIndent = FormatUtils.indent(1); // One level of relative indentation
    for (const stmt of block.statements) {
      this.host.state.indentLevel++;
      const stmtCode = this.renderStatement(stmt);
      this.host.state.indentLevel--;
      if (stmtCode) {
        const indentedLines = stmtCode
          .split("\n")
          .map((line) => innerIndent + line);
        lines.push(indentedLines.join("\n"));
      }
    }
    lines.push("}");
    return lines.join("\n");
  }

  private renderStatement(statement: TStatement): string {
    const result = this.renderStatementCode(statement);
    // Issue #250: Prepend any pending temp declarations (C++ mode)
    if (this.host.state.pendingTempDeclarations.length > 0) {
      const tempDecls = this.host.state.pendingTempDeclarations.join("\n");
      this.host.state.pendingTempDeclarations = [];
      return tempDecls + "\n" + result;
    }
    return result;
  }

  private renderStatementCode(statement: TStatement): string {
    switch (statement.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return VariableDeclHelper.renderVariableDecl(
          this.planVariableDecl(statement),
          this.host.state,
        );
      case "assignment":
        return this.generateAssignment(statement);
      case "expression":
        return this.renderExpression(statement.expression) + ";";
      case "if":
        return this.invokeGenerator(
          controlFlowGenerators.generateIf,
          this.planIf(statement),
        );
      case "while":
        return this.invokeGenerator(
          controlFlowGenerators.generateWhile,
          this.planWhile(statement),
        );
      case "doWhile":
        return this.invokeGenerator(
          controlFlowGenerators.generateDoWhile,
          this.planDoWhile(statement),
        );
      case "for":
        return this.invokeGenerator(
          controlFlowGenerators.generateFor,
          this.planFor(statement),
        );
      case "forever":
        return this.invokeGenerator(
          controlFlowGenerators.generateForever,
          this.planForever(statement),
        );
      case "switch":
        return this.invokeGenerator(
          generateSwitchStatement,
          this.planSwitch(statement),
        );
      case "return":
        return this.invokeGenerator(
          controlFlowGenerators.generateReturn,
          this.planReturn(statement),
        );
      case "critical":
        // ADR-050: a critical statement for atomic multi-variable operations.
        // #1445: the block is rendered here and the generator wraps it, so the
        // block still renders before the wrapper's irq_wrappers effect is
        // applied, and effect order is unchanged.
        return this.invokeGenerator(generateCriticalStatement, {
          blockCode: this.renderBlock(statement.body),
          line: statement.span.line,
        });
      case "block":
        return this.renderBlock(statement);
      case "missing":
        invariant(
          false,
          "a statement the parser repaired never reaches render -- the run stops at the parse error",
        );
    }
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
  generateAssignmentTarget(ctx: TExpression, opCount?: number): string {
    const parts = AssignmentTarget.parts(ctx);
    const hasGlobal = parts.root === "global";
    const hasThis = parts.root === "this";
    const identifier = parts.identifier ?? undefined;
    const postfixOps = parts.ops.slice(0, opCount);

    // SonarCloud S3776: Use SimpleIdentifierResolver for simple identifier case
    if (!hasGlobal && !hasThis && postfixOps.length === 0 && identifier) {
      return SimpleIdentifierResolver.resolve(
        identifier,
        this._buildSimpleIdentifierDeps(),
        parts.position,
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
          parts.position,
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

  /** Generate parameter list for function signature */
  generateParameterList(params: readonly IParameterSyntax[]): string {
    return params
      .map((param, index) => this.generateParameter(param, index))
      .join(", ");
  }

  private typeNameOf(type: TTypeSyntax): string {
    // #1285: one ladder. This was the largest of seven copies, and the only one
    // that handled `arrayType` by peeking at two of its six element
    // alternatives -- TypeNameLadder recurses into all of them.
    const resolved = TypeNameLadder.resolveWrittenName(
      type,
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
      AdrProvenance.record("010", type.span.line);
    }
    return resolved ?? type.text;
  }

  /** Try to evaluate a constant expression at compile time */
  tryEvaluateConstant(expr: TExpression): number | undefined {
    // Issue #1127: the shared builder, not a fourth inline copy of the same
    // three lookups. This is the orchestrator entry point that
    // ArrayDimensionUtils uses to emit declaration dimensions, so it is on the
    // hot path for exactly the divergences this work closes.
    return this.constantOf(expr);
  }

  /**
   * ADR-015: the zero initializer for a type.
   * ADR-017: an enum initializes to its first member.
   */
  private zeroInitializerOf(type: TTypeSyntax, isArray: boolean): string {
    // Issue #379 / #1004: arrays zero-init with the aggregate brace ({} in
    // C++, {0} in C) regardless of element type.
    if (isArray) {
      return this.host.getAggregateZeroInitBrace();
    }

    // Handle named types (scoped, global, qualified, user)
    const resolved = this.namedTypeOf(type);
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
    if (type.kind === "template") {
      return "{}";
    }

    // Issue #1019: string<N> types use empty string initializer
    if (type.kind === "string") {
      return '""';
    }

    // Primitive types use lookup map
    if (type.kind === "primitive") {
      const primType = type.name;
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
    params: readonly IParameterSyntax[] | null,
  ): readonly IPlannedFunctionParameter[] | null {
    return params?.map((param) => this.planFunctionParameter(param)) ?? null;
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

  private renderDeclaredType(type: TTypeSyntax): string {
    const declared = this.renderType(type);
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
    params: readonly IParameterSyntax[] | null,
  ): boolean {
    return MainSignature.takesArgs(name, params);
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
  private renderPrimary(expr: TExpression): string {
    switch (expr.kind) {
      case "sizeof":
        return this.generateSizeofExpr(expr);
      case "cast":
        return generateCast(this.planCast(expr), this.host.state);
      case "structInitializer":
        return this.generateStructInitializer(expr);
      case "arrayInitializer":
        return this.generateArrayInitializer(expr);
      case "root":
        return expr.root === "this"
          ? this._resolveThisKeyword()
          : "__GLOBAL_PREFIX__";
      case "identifier":
        return this._resolveIdentifierExpression(
          expr.name,
          CodeGenWalker.positionOf(expr),
        );
      case "literal":
        return this._generateLiteralExpression(expr.text);
      case "parenthesized":
        return `(${this.renderExpression(expr.expression)})`;
      default:
        return "";
    }
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
   * @param program The file as plain data, lowered by 1.2 (#1932)
   * @param options Code generator options; `symbolInfo` and the target are required
   */
  generate(program: IProgramSyntax, options: ICodeGeneratorOptions): string {
    // ADR-049: the target is decided before codegen, by the orchestrator;
    // this walk only reads it.

    // Reset state for fresh generation (must be before any state assignments)
    this.resetGeneratorState(options.targetDescription);

    // Initialize options and configuration (after reset)
    this.initializeGenerateOptions(options);

    // ADR-055: Use pre-collected symbolInfo from Pipeline (TSymbolInfoAdapter)
    this.host.state.symbols = options.symbolInfo;

    // ADR-029: register every function-as-type this file can see BEFORE
    // anything can reference one. Must run after `symbols` is set.
    this.registerCallbackTypes();

    // Initialize symbol data
    this.initializeSymbolData();

    // Initialize all helper objects
    this.initializeHelperObjects(program);

    // Assemble and return the output
    return this.assembleGeneratedOutput(program, options);
  }

  /**
   * Initialize options and configuration for generate().
   */
  private initializeGenerateOptions(options: ICodeGeneratorOptions): void {
    this.host.state.debugMode = options.debugMode ?? false;
    this.host.state.sourcePath = options.sourcePath ?? null;
    // #1241: Transpiler._analysisInputs sets the provenance file before analyzers
    // run; re-assert it here for API callers that drive the generator directly
    // and never go through that path. (Said `_transpileFile` until #1320
    // hoisted analysis out of it into its own pass -- by the time
    // `_transpileFile` runs, every file's analyzers are already done.)
    AdrProvenance.beginFile(this.host.state.sourcePath);
    this.host.state.cnxIncludeRewrites =
      options.cnxIncludeRewrites ?? new Map<string, string>();
    this.host.state.includeKinds =
      options.includeKinds ?? new Map<string, EFileType>();
    // #1428: the run's mode is 1.1's answer, carried by the program. A caller
    // cannot supply one, so none can claim C by leaving it out.
    const program = this.host.state.program;
    invariant(program, "1.4 Resolve built Program before codegen");
    this.host.state.cppMode = program.cppMode();
    this.host.state.pendingTempDeclarations = [];
    this.host.state.pendingCppClassAssignments = [];
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
  private initializeHelperObjects(program: IProgramSyntax): void {
    // Collect function/callback information
    this.collectFunctionsAndCallbacks(program);
  }

  /**
   * Assemble the final generated output.
   */
  private assembleGeneratedOutput(
    program: IProgramSyntax,
    options: ICodeGeneratorOptions,
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
    if (options.hasPublicInterface && this.host.state.sourcePath) {
      const pathToUse =
        options.sourceRelativePath ||
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
    sourceIncludeTargets.push(
      ...this.processIncludeDirectives(program, output),
    );

    // Process preprocessor directives
    this.processPreprocessorDirectives(program, output);

    // 2.2 Plan: the declaration decisions, settled BEFORE anything is rendered.
    // Unlike the emission plan below, neither answer depends on what rendering
    // turns out to produce, so Render reads them rather than interpreting the
    // state they came from.
    this.host.state.declarationPlanOrNull = DeclarationPlan.build(
      program.declarations.map((entry) =>
        CodeGenWalker.declarationKindOf(entry.declaration),
      ),
      this.host.state.selfIncludeAdded,
    );

    // Generate declarations
    const declarations = this.generateAllDeclarations(program);

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
    program: IProgramSyntax,
    output: string[],
  ): string[] {
    const targets: string[] = [];
    for (const include of program.includes) {
      output.push(...this.formatLeadingComments(include.leadingComments));
      const includeText = include.written;
      // Issue #850: a MISRA suppression for banned headers
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
    if (program.includes.length > 0) {
      output.push("");
    }
    return targets;
  }

  /**
   * Process all preprocessor directives and add to output.
   */
  private processPreprocessorDirectives(
    program: IProgramSyntax,
    output: string[],
  ): void {
    for (const directive of program.directives) {
      output.push(...this.formatLeadingComments(directive.leadingComments));
      const result = includeProcessPreprocessorDirective({
        kind: directive.kind,
        text: directive.text,
      });
      if (result) {
        output.push(result);
      }
    }
    if (program.directives.length > 0) {
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
    declaration: TDeclarationSyntax,
  ): TDeclarationKind {
    if (declaration.kind === "function") return "function";
    if (declaration.kind === "scope") return "scope";
    return "other";
  }

  private generateAllDeclarations(program: IProgramSyntax): string[] {
    const sourceOrder = program.declarations;

    // Issue #1212, #1449, #1450: WHICH declaration the callback typedef block
    // precedes is decided by 2.2 Plan and read off the plan here. WHERE that
    // lands in the emitted array is arithmetic, and stays here -- the index
    // depends on how many leading-comment lines were pushed, which is a fact
    // about text rather than a decision about what C should exist.
    const precedes = this.host.state.declarationPlan().callbackTypedefsPrecede;

    const declarations: string[] = [];
    let firstFunctionIndex: number | null = null;

    for (const [index, entry] of sourceOrder.entries()) {
      declarations.push(...this.formatLeadingComments(entry.leadingComments));

      if (index === precedes) {
        firstFunctionIndex = declarations.length;
      }

      const code = this.generateDeclaration(entry.declaration);
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
      emittedCTypes: this.host.state.emittedCTypes,
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
  private collectFunctionsAndCallbacks(program: IProgramSyntax): void {
    for (const { declaration } of program.declarations) {
      if (declaration.kind === "scope") {
        this._collectScopeFunctions(declaration);
      } else if (declaration.kind === "struct") {
        this._collectStructCallbackFields(declaration);
      } else if (declaration.kind === "function") {
        this._collectTopLevelFunction(declaration);
      }
    }
  }

  /**
   * Collect scoped functions and their callback types
   */
  private _collectScopeFunctions(
    scopeDecl: Extract<TDeclarationSyntax, { kind: "scope" }>,
  ): void {
    const scopeName = scopeDecl.name;
    this.host.state.withScopePath(scopeName, () => {
      for (const { declaration } of scopeDecl.members) {
        if (declaration.kind === "function") {
          this._registerScopeFunction(
            this.host.state.program?.scopePathOf(scopeName) ?? scopeName,
            declaration,
          );
        }
      }
      for (const { declaration } of scopeDecl.members) {
        if (declaration.kind === "struct") {
          this._collectStructCallbackFields(declaration);
        } else if (
          declaration.kind === "variableDeclaration" ||
          declaration.kind === "constructorDeclaration"
        ) {
          this.host.state.notePublicCallbackTypeReference(
            this.typeNameOf(declaration.type),
          );
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
    funcDecl: IFunctionDeclarationSyntax,
  ): void {
    const fullName = QualifiedNameGenerator.forFunctionInScope(
      declaringScopePath,
      funcDecl.name,
      this.host.state.program,
    );
    this.host.state.knownFunctions.add(fullName);
    const sig = this.extractFunctionSignature(fullName, funcDecl.parameters);
    this.host.state.functionSignatures.set(fullName, sig);
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(funcDecl.body);
  }

  /**
   * Collect callback field types from struct declaration
   */
  private _collectStructCallbackFields(
    structDecl: IStructDeclarationSyntax,
  ): void {
    for (const field of structDecl.fields) {
      const fieldType = this.typeNameOf(field.type);
      if (this.host.state.callbackTypes.has(fieldType)) {
        this.host.state.callbackFieldTypes.set(
          `${structDecl.name}.${field.name}`,
          fieldType,
        );
      }
      this.host.state.notePublicCallbackTypeReference(fieldType);
    }
  }

  /**
   * Collect top-level function and register as callback type
   */
  private _collectTopLevelFunction(funcDecl: IFunctionDeclarationSyntax): void {
    this.host.state.knownFunctions.add(funcDecl.name);
    const sig = this.extractFunctionSignature(
      funcDecl.name,
      funcDecl.parameters,
    );
    this.host.state.functionSignatures.set(funcDecl.name, sig);
    // #1484: locals in the body name callback types too.
    this._collectLocalCallbackTypeReferences(funcDecl.body);
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
    param: IParameterSyntax,
  ): IPlannedFunctionParameter {
    const arrayType = param.type.kind === "array" ? param.type : null;
    const isArray = param.dimensions.length > 0 || arrayType !== null;
    return {
      name: param.name,
      isConst: param.const,
      isArray,
      arrayDimensions: this.foldParameterDimensions(
        param.dimensions,
        arrayType?.dimensions ?? null,
        isArray,
      ),
      stringCapacity: CodeGenWalker.stringCapacityOf(param.type) ?? undefined,
      type: this.planType(param.type),
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
    cStyleDimensions: ReadonlyArray<TExpression | null>,
    typeDimensions: ReadonlyArray<TExpression | null> | null,
    isArray: boolean,
  ): readonly number[] {
    if (!isArray) return [];
    if (cStyleDimensions.length > 0) {
      return cStyleDimensions.map(
        (dimension) =>
          (dimension && this.constantOf(dimension)) ?? UNRESOLVED_DIMENSION,
      );
    }
    if (!typeDimensions) return [];
    return typeDimensions.flatMap((dimension) =>
      dimension ? [this.constantOf(dimension) ?? UNRESOLVED_DIMENSION] : [],
    );
  }

  /**
   * ADR-013: Extract function signature from parameter list
   */
  private extractFunctionSignature(
    name: string,
    params: readonly IParameterSyntax[] | null,
  ): FunctionSignature {
    const parameters: Array<{
      name: string;
      baseType: string;
      isConst: boolean;
      isArray: boolean;
    }> = [];

    if (params) {
      for (const param of params) {
        const paramName = param.name;
        const isConst = param.const;
        const isArray =
          param.dimensions.length > 0 || param.type.kind === "array";
        const baseType = this.typeNameOf(param.type);
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
  private _collectLocalCallbackTypeReferences(body: TBlockSyntax): void {
    for (const statement of body.statements) {
      this.collectCallbackTypeReferencesIn(statement);
    }
  }

  private collectCallbackTypeReferencesIn(statement: TStatement): void {
    const visit = (child: TStatement): void =>
      this.collectCallbackTypeReferencesIn(child);
    const visitBody = (body: { statements: readonly TStatement[] }): void =>
      body.statements.forEach(visit);
    switch (statement.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        this.host.state.callbackTypeReferences.add(
          this.typeNameOf(statement.type),
        );
        return;
      case "if":
        visit(statement.whenTrue);
        if (statement.whenFalse) visit(statement.whenFalse);
        return;
      case "while":
      case "doWhile":
      case "forever":
      case "critical":
        if ("kind" in statement.body) {
          visit(statement.body);
        } else {
          visitBody(statement.body);
        }
        return;
      case "for":
        if (statement.init?.kind === "variableDeclaration")
          visit(statement.init);
        visit(statement.body);
        return;
      case "switch":
        statement.cases.forEach((switchCase) => visitBody(switchCase.body));
        if (statement.defaultCase) visitBody(statement.defaultCase.body);
        return;
      case "block":
        visitBody(statement);
        return;
      case "assignment":
      case "expression":
      case "return":
      case "missing":
        return;
      default:
        statement satisfies never;
    }
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
   * Kept as one decision since two builders shared it (#1491, #1552); one
   * builder is left (#1929).
   */
  private callbackParamShape(
    typeName: string,
    isArray: boolean,
    functionsAsTypes: ReadonlyMap<string, IFunctionSymbol>,
  ): {
    type: string;
    isStruct: boolean;
    isString: boolean;
    isOpaqueHandle: boolean;
  } {
    // ADR-006: struct-ness drives reference semantics. A C++ namespaced
    // struct is known by its `::` spelling, which is how the prototype that
    // takes it by reference names it; the C join (`hw__Dev`) is not.
    const isStruct = this.host.isKnownStruct(
      CppNamespaceUtils.convertToCppNamespace(
        typeName,
        this.host.state.symbolTable,
      ),
    );

    // ADR-029: a parameter whose type is itself a function-as-type.
    if (functionsAsTypes.has(typeName)) {
      // Function pointers are already pointers.
      return {
        type: CodeGenWalker.callbackTypedefName(typeName),
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
        type: this.callbackCType(typeName),
        isStruct: false,
        isString: false,
        isOpaqueHandle: true,
      };
    }

    // ADR-006: a struct parameter is a pointer in C and a reference in C++,
    // which the formatter spells from `isStruct`.
    return {
      type: this.callbackCType(typeName),
      isStruct,
      isString: false,
      isOpaqueHandle: false,
    };
  }

  /**
   * ADR-029: every function this file can see is a type here too, whether it
   * is declared in this file or reached through an include (#1491).
   *
   * One builder for both (#1929). The signature is READ FROM THE SYMBOL, not
   * re-derived from a parse tree -- "after 1.3, nothing may compute a symbol's
   * name." A symbol's `arrayDimensions` are already const-folded, which is the
   * property MISRA Rule 18.8 needs (#1127). A second, parse-tree builder for
   * local functions used to run afterwards and overwrite this one's result;
   * the two had to share `callbackParamShape` and `typedefParamIsConst`
   * because they disagreed twice (#1529, #1552).
   *
   * Registration is unconditional; EMISSION stays gated by
   * `headerOwnsCallbackTypedef`, which intersects with `callbackTypeReferences`.
   * So a visible function nobody uses as a type still yields no typedef and
   * cannot trip MISRA Rule 2.3 (unused type declarations).
   */
  private registerCallbackTypes(): void {
    const symbols = this.host.state.symbols;
    if (!symbols) {
      return;
    }

    // The per-file VISIBLE set: what this file declares, plus what its includes
    // contribute via mergeExternalSymbols. Keyed by transpiled C name.
    // Every function-as-type is found BEFORE any is built: a parameter may name
    // one declared later, and building in one pass made `callIt_fp`'s
    // parameter `tickSource` rather than `tickSource_fp` when `callIt` came
    // first (#1929).
    const functions = new Map<string, IFunctionSymbol>();
    for (const cName of symbols.functionReturnTypes.keys()) {
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
        functions.set(cName, symbol);
      }
    }

    // Registered dependencies-first: every reader that walks `callbackTypes`
    // emits in its order, and C needs `tickSource_fp` declared before a
    // typedef whose parameter names it. A cycle cannot be written in C at
    // all; `seen` also stops the walk from looping on one.
    const seen = new Set<string>();
    const register = (cName: string): void => {
      const symbol = functions.get(cName);
      if (!symbol || seen.has(cName)) {
        return;
      }
      seen.add(cName);
      for (const param of symbol.parameters) {
        register(SymbolTypeResolver.getTypeName(param.type));
      }
      this.host.state.callbackTypes.set(
        cName,
        this.callbackInfoFromSymbol(cName, symbol, functions),
      );
    };
    for (const cName of functions.keys()) {
      register(cName);
    }
  }

  /**
   * Build an `ICallbackTypeInfo` from a resolved function symbol.
   *
   * The symbol carries the resolved return type and parameters, so nothing here
   * re-resolves a name. Parameter meaning is delegated to `callbackParamShape`.
   */
  private callbackInfoFromSymbol(
    cName: string,
    symbol: IFunctionSymbol,
    functionsAsTypes: ReadonlyMap<string, IFunctionSymbol>,
  ): ICallbackTypeInfo {
    return {
      functionName: cName,
      returnType: this.callbackCType(
        SymbolTypeResolver.getTypeName(symbol.returnType),
      ),
      parameters: symbol.parameters.map((param) => {
        const typeName = SymbolTypeResolver.getTypeName(param.type);
        // Spread, not re-listed: a field the shape gains reaches the typedef
        // (#1552 was a builder dropping one).
        const shape = this.callbackParamShape(
          typeName,
          param.isArray,
          functionsAsTypes,
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
   * ADR-029: a resolved C-Next type name, spelled in a `_fp` typedef the way
   * the function's own prototype spells it -- `headerCType` for the C++
   * namespace (`hw::Dev`, not the C join `hw__Dev`) and the primitive map,
   * then `generateUserType` for the `struct` keyword a C tag with no typedef
   * needs. A bare primitive lookup lost both (#1942 review).
   */
  private callbackCType(typeName: string): string {
    const symbolTable = this.host.state.symbolTable;
    return TypeGenerationHelper.generateUserType(
      headerCType(typeName, symbolTable),
      symbolTable.checkNeedsStructKeyword(typeName),
    );
  }

  /**
   * ADR-029: is this `_fp` typedef parameter const?
   *
   * The const the prototype carries. Two typedef builders once each re-derived
   * it and disagreed with the prototype, and with each other, at the same time:
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
   * ADR-029: Check if a function is used as a callback type (field type in a struct)
   */
  /**
   * ADR-045: Check if an expression is a string concatenation.
   *
   * #1445: the shape question is read from the lowered expression and the
   * capacity question is `StringOperationsHelper`'s, so neither holds both.
   */
  private _getStringConcatOperands(
    expression: TExpression,
  ): IStringConcatOps | null {
    const operands = ExpressionShape.additionOperands(expression);
    if (operands === null) return null;
    return StringOperationsHelper.getStringConcatOperands(
      CodeGenWalker.stringTextOf(operands[0]),
      CodeGenWalker.stringTextOf(operands[1]),
      this.declaredTypeAt(expression.span),
    );
  }

  /**
   * ADR-045: Check if an expression is a substring extraction.
   *
   * The indexes go over as a thunk rather than as generated code: generating
   * one queues a pending temp declaration in some shapes, and only the helper
   * knows whether this is a substring at all. See its comment.
   */
  private _getSubstringOperands(expression: TExpression): ISubstringOps | null {
    const subscripted = ExpressionShape.subscriptedIdentifier(expression);
    if (subscripted === null) return null;
    return StringOperationsHelper.getSubstringOperands(
      subscripted.name,
      () => subscripted.indexes.map((index) => this.renderExpression(index)),
      this.declaredTypeAt(expression.span),
    );
  }

  /**
   * #1668 (C7): a bare name's declared type where `ctx` is, for a helper
   * that holds only an operand's text
   */
  private declaredTypeAt(
    at: ISourcePosition,
  ): (name: string) => TTypeInfo | undefined {
    const position = { line: at.line, column: at.column };
    return (name) => this.host.state.declarationTypeInfo(null, name, position);
  }

  private _isFloatType(typeName: string): boolean {
    return TypeCheckUtils.isFloat(typeName);
  }

  /**
   * Check if an expression is an lvalue that needs & when passed to functions.
   * This includes member access (cursor.x) and array access (arr[i]).
   * Returns the type of lvalue or null if not an lvalue.
   */
  private getLvalueType(expr: TExpression): "member" | "array" | null {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return null;

    const result = CppMemberHelper.getLastPostfixOpType(
      CodeGenWalker.toPostfixOps(view.ops),
    );

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
    expr: TExpression,
    targetParamBaseType?: string,
  ): boolean {
    if (!this.host.state.cppMode) return false;
    if (!targetParamBaseType) return false;

    const view = ExpressionShape.postfixView(expr);
    const baseId = ExpressionShape.rootName(expr);
    if (!view || !baseId) return false;

    const ops = view.ops;

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
      CodeGenWalker.positionOf(expr),
    );
  }

  /**
   * Convert parser PostfixOpContext to IPostfixOp interface for CppMemberHelper.
   */
  private static toPostfixOps(ops: readonly TPostfixOpSyntax[]): IPostfixOp[] {
    return ops.map((op) => ({
      hasExpression: op.kind === "subscript",
      hasIdentifier: op.kind === "member",
      hasArgumentList: op.kind === "call" && op.arguments.length > 0,
      textEndsWithParen: op.kind === "call",
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
    ops: readonly TPostfixOpSyntax[],
    baseId: string,
    targetParamBaseType: string,
    at: ISourcePosition,
  ): boolean {
    const typeInfo = this.host.state.declarationTypeInfo(null, baseId, at);
    return CppMemberHelper.needsComplexMemberConversion(
      CodeGenWalker.toPostfixOps(ops),
      typeInfo,
      targetParamBaseType,
    );
  }

  /**
   * Issue #246: Check if an expression is a subscript access on a string variable.
   * For example, buf[0] where buf is a string<N>.
   * Used to determine when to cast char* to uint8_t* etc.
   */
  private isStringSubscriptAccess(expr: TExpression): boolean {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return false;

    const ops = view.ops;
    const hasPostfixOps = ops.length > 0;
    const lastOpHasExpression =
      hasPostfixOps && ops.at(-1)!.kind === "subscript";

    const baseId = ExpressionShape.rootName(expr);
    if (!baseId) return false;

    const typeInfo = this.host.state.declarationTypeInfo(
      null,
      baseId,
      CodeGenWalker.positionOf(expr),
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
   * Issue #308: whether a member access argument (`result.data`, at any
   * depth) is stored as a C array, which decays to a pointer when passed, so
   * it takes no `&`. The member's type is the one operand typer's (#1737).
   *
   * Issue #355: "unknown" when there is no struct field info for the member,
   * for defensive code generation that skips potentially dangerous conversions.
   *
   * @returns "array" if definitely an array, "not-array" if definitely not,
   *          "unknown" if struct field info is not available
   */
  private getMemberAccessArrayStatus(
    expr: TExpression,
  ): "array" | "not-array" | "unknown" {
    const view = ExpressionShape.postfixView(expr);
    if (!view) return "not-array";

    if (view.ops.at(-1)?.kind !== "member") return "not-array";

    const baseId = ExpressionShape.rootName(expr);
    if (!baseId || !this.rootBindsToVariable(baseId, expr)) {
      return "not-array";
    }

    const member = OperandTyper.typeOf(expr, this.host.state.typingContext());
    if (member === null) {
      return "unknown";
    }

    return OperandTyper.decaysToPointer(member) ? "array" : "not-array";
  }

  /** Whether a chain's root names a declaration (#1668) or a parameter */
  private rootBindsToVariable(baseId: string, at: TExpression): boolean {
    return (
      this.host.state.declarationTypeInfo(
        null,
        baseId,
        CodeGenWalker.positionOf(at),
      ) !== undefined || this.host.state.currentParameters.has(baseId)
    );
  }

  private generateDeclaration(declaration: TDeclarationSyntax): string {
    switch (declaration.kind) {
      case "scope":
        return this.invokeGenerator(
          scopeGenerator,
          this.planScope(declaration),
        );
      case "register":
        return this.generateRegister(declaration);
      // Issue #369 / #1164: the struct generator decides for itself what a
      // self-include suppresses. Returning early here also skipped its
      // callback-field effects and dropped the ADR-029 init function, which
      // the header never carries.
      case "struct":
        return this.invokeGenerator(
          structGenerator,
          this.planStruct(declaration),
        );
      case "enum":
        return this.invokeSuppressibleDeclaration(
          enumGenerator,
          declaration.name,
        );
      case "bitmap":
        return this.invokeSuppressibleDeclaration(
          bitmapGenerator,
          declaration.name,
        );
      case "function":
        return this.generateFunction(declaration);
      case "variableDeclaration":
      case "constructorDeclaration":
        return (
          VariableDeclHelper.renderVariableDecl(
            this.planVariableDecl(declaration),
            this.host.state,
          ) + "\n"
        );
      case "missing":
        return "";
    }
  }

  /**
   * The kinds a generated header can DEFINE, in the order it emits their
   * sections (#1300). Iterating kind-outer is what gives the `.c` the header's
   * ordering: a struct naming an enum declared below it must still come second,
   * and the two files disagreeing on that was an exit-0 miscompile.
   */
  private static readonly SCOPE_TYPE_KINDS: ReadonlyArray<
    IPlannedScope["typeDefinitions"][number]["kind"]
  > = ["enum", "bitmap", "struct"];

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
  private planScope(
    scope: Extract<TDeclarationSyntax, { kind: "scope" }>,
  ): IPlannedScope {
    const name = scope.name;
    const declaringScopePath =
      this.host.state.program?.scopePathOf(name) ?? name;
    return {
      name,
      declaringScopePath,
      typeDefinitions: this.planScopeTypeDefinitions(
        scope.members,
        declaringScopePath,
      ),
      members: scope.members.map((member) =>
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
    members: Extract<TDeclarationSyntax, { kind: "scope" }>["members"],
    declaringScopePath: string,
  ): IPlannedScope["typeDefinitions"] {
    return CodeGenWalker.SCOPE_TYPE_KINDS.flatMap((kind) =>
      members.flatMap(({ declaration }) => {
        if (declaration.kind !== kind || !("name" in declaration)) return [];
        const cName = this.scopeTypeCNameIfAbsentFromHeader(
          declaration.name,
          declaringScopePath,
        );
        return cName === null ? [] : [{ kind, cName }];
      }),
    );
  }

  /** This type's transpiled C name, or null when the header already defines it. */
  private scopeTypeCNameIfAbsentFromHeader(
    name: string,
    declaringScopePath: string,
  ): string | null {
    const fullName = QualifiedNameGenerator.forMember(declaringScopePath, name);
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
    member: Extract<TDeclarationSyntax, { kind: "scope" }>["members"][number],
    declaringScopePath: string,
  ): TPlannedScopeMember {
    const adrLine = member.span.line;
    const declaration = member.declaration;
    // ADR-016, via the one helper the symbols layer also asks (#1300). Codegen
    // used to recompute this, so the header and the body decided visibility
    // independently.
    const visibility = ScopeUtils.memberVisibility(
      member.visibility,
      declaration.kind === "function",
    );
    const isPrivate = visibility === "private";
    switch (declaration.kind) {
      case "variableDeclaration":
      case "constructorDeclaration":
        return {
          kind: "variable",
          adrLine,
          variable: this.planScopeVariable(
            declaration,
            declaringScopePath,
            isPrivate,
          ),
        };
      case "function": {
        const params = declaration.parameters;
        return {
          kind: "function",
          adrLine,
          isPrivate,
          fullName: QualifiedNameGenerator.forFunctionInScope(
            declaringScopePath,
            declaration.name,
            this.host.state.program,
          ),
          declaredTypeText: declaration.returnType.text,
          renderReturnType: () => this.renderType(declaration.returnType),
          planParameters: () => this.planFunctionParameters(params),
          renderBody: () => this.renderBlock(declaration.body),
          renderParameterList: () =>
            params ? this.generateParameterList(params) : "void",
        };
      }
      case "register":
        return {
          kind: "register",
          adrLine,
          planRegister: () => this.planRegister(declaration),
        };
      default:
        return { kind: "other", adrLine };
    }
  }

  /** Which of the three shapes a scope variable is emitted in. */
  private planScopeVariable(
    decl: Extract<
      TDeclarationSyntax,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >,
    declaringScopePath: string,
    isPrivate: boolean,
  ): TPlannedScopeVariable {
    const fullName = QualifiedNameGenerator.forMember(
      declaringScopePath,
      decl.name,
    );
    // Issue #375: constructor syntax.
    //
    // #1322: the arguments are no longer VALIDATED here -- the const check that
    // stood beside this resolution is E0432 in pass 2.1, and it was the second
    // of two implementations of one decision.
    if (decl.kind === "constructorDeclaration") {
      return {
        kind: "constructor",
        fullName,
        isPrivate,
        args: decl.arguments.map((arg) =>
          QualifiedNameGenerator.forMember(declaringScopePath, arg.name),
        ),
        renderType: () => this.renderType(decl.type),
      };
    }

    // Issue #500: check for an array BEFORE skipping -- arrays must be emitted.
    // Both spellings count: C-style trailing dimensions and the C-Next arrayType.
    const isConst = decl.modifiers.const;
    const arrayDims = decl.dimensions;
    const arrayType = decl.type.kind === "array" ? decl.type : null;
    const isArray = CodeGenWalker.isArrayDeclaration(decl);

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
      decl.modifiers,
      false,
      false,
      this.host.state,
    );
    return {
      kind: "regular",
      fullName,
      isPrivate,
      isConst,
      isArray,
      declarationLine: decl.span.line,
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      renderType: () => this.renderType(decl.type),
      renderArrayTypeDimensions: () =>
        ArrayDimensionUtils.renderArrayTypeDimensions(
          arrayType
            ? this.planLoweredArrayTypeDimensions(arrayType.dimensions, decl)
            : null,
        ),
      renderCStyleDimensions:
        arrayDims.length > 0
          ? () => this.renderLoweredDimensions(arrayDims)
          : null,
      renderStringCapacityDimension: () =>
        ArrayDimensionUtils.renderStringCapacityDimension(
          CodeGenWalker.stringCapacityOf(decl.type),
        ),
      renderInitializer: () => this.renderScopeInitializer(decl, isArray),
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
    decl: IVariableDeclarationSyntax,
    isArray: boolean,
  ): string {
    const initializer = decl.initializer;
    if (initializer) {
      const typeName = this.renderType(decl.type);
      const state = this.host.state;
      state.resetArrayInitTracking();
      const rendered = state.withExpectedType(typeName, () =>
        state.withDeclarationInit(
          () => ` = ${this.renderExpression(initializer)}`,
        ),
      );
      // #1824 review: an omitted size is emitted from 1.3's count (the
      // planner), so the list rendered here must have exactly that many
      // elements -- the same check the statement renderer makes.
      const omitsSize =
        decl.type.kind === "array" && decl.type.dimensions.includes(null);
      if (omitsSize && state.wasArrayInit()) {
        ArrayInitHelper.assertInferredSize(
          decl.name,
          this.countedSize(decl),
          state,
        );
      }
      return rendered;
    }
    // ADR-015: Zero initialization for uninitialized scope variables
    return ` = ${this.zeroInitializerOf(decl.type, isArray)}`;
  }

  private generateRegister(register: IRegisterDeclarationSyntax): string {
    return this.invokeGenerator(
      registerGeneratorFor(this.host.getState().currentScopePath),
      this.planRegister(register),
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
  planRegister(register: IRegisterDeclarationSyntax): IPlannedRegister {
    const baseAddress = this.renderExpression(register.address);
    return {
      name: register.name,
      baseAddress,
      members: register.members.map((member) => ({
        name: member.name,
        cType: this.renderType(member.type),
        access: member.access,
        offset: this.renderExpression(member.offset),
      })),
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
  private planStruct(struct: IStructDeclarationSyntax): IPlannedStruct {
    return {
      name: struct.name,
      fields: struct.fields.map((field) => {
        const arrayType = field.type.kind === "array" ? field.type : null;
        return {
          name: field.name,
          typeName: this.typeNameOf(field.type),
          hasNameDimensions: field.dimensions.length > 0,
          hasTypeDimensions: arrayType !== null,
          renderCType: () => this.renderType(field.type),
          renderTypeDimensions: () =>
            ArrayDimensionUtils.renderArrayTypeDimensions(
              arrayType
                ? this.planLoweredArrayTypeDimensions(
                    arrayType.dimensions,
                    null,
                  )
                : null,
            ),
          renderNameDimensions: () =>
            this.renderLoweredDimensions(field.dimensions),
          renderZeroInitializer: () =>
            this.zeroInitializerOf(field.type, false),
        };
      }),
    };
  }

  private planLoweredArrayTypeDimensions(
    dims: ReadonlyArray<TExpression | null>,
    declaration: IVariableDeclarationSyntax | null,
  ): readonly IPlannedDimension[] {
    // #1664 box 3: an omitted size is the declaration's count, the number
    // the `.h` states, for every declaration renderer that asks here.
    return dims.map((size) =>
      size
        ? { renderSize: () => this.renderLoweredDimension(size) }
        : { renderSize: () => String(this.omittedSizeOf(declaration)) },
    );
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
  private planCallArguments(
    args: readonly TExpression[] | null,
  ): readonly IPlannedCallArgument[] | null {
    if (args === null) return null;

    return args.map((expression) => ({
      simpleIdentifier: ExpressionShape.simpleIdentifier(expression),
      declared: this.nameTypeOf(expression),
      expressionType: () => this.directTypeOf(expression),
      isArray: () =>
        OperandTyper.decaysToPointer(
          OperandTyper.typeOf(expression, this.host.state.typingContext()),
        ),
      isHandleArrayElement: () => this.isHandleArrayElement(expression),
      render: () => this.renderExpression(expression),
      renderByReference: (targetParamBaseType: string | undefined) =>
        this.generateFunctionArg(expression, targetParamBaseType),
    }));
  }

  /**
   * A bounded string type's declared capacity, or null (#1445) -- of the
   * element for an array of them, `string<N>[M]` (#1569).
   */
  private static stringCapacityOf(type: TTypeSyntax): number | null {
    const element = type.kind === "array" ? type.element : type;
    return element.kind === "string" && element.capacity !== null
      ? Number.parseInt(element.capacity, 10)
      : null;
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
    expr: TExpressionOf<"structInitializer">,
  ): string {
    const typeName = this._resolveStructInitializerTypeName();

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

    const fields = expr.fields.map((field) => {
      const fieldName = field.name;
      const fieldType = this._resolveFieldType(fieldName, structFieldTypes);
      const value = this.host.state.withExpectedType(fieldType, () =>
        this.renderExpression(field.value),
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
    expr: TExpressionOf<"arrayInitializer">,
  ): string {
    if (expr.fill !== null) {
      const fillValue = this.renderExpression(expr.fill);
      this.host.state.lastArrayInitCount = 0;
      this.host.state.lastArrayFillValue = fillValue;
      return `{${fillValue}}`;
    }

    const generatedElements = expr.elements.map((element) => {
      switch (element.kind) {
        case "structInitializer":
          return this.generateStructInitializer(element);
        case "arrayInitializer":
          return this.generateArrayInitializer(element);
        default:
          return this.renderExpression(element);
      }
    });

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
  private planFunction(fn: IFunctionDeclarationSyntax): IPlannedFunction {
    const params = fn.parameters;
    return {
      name: fn.name,
      returnType: this.renderType(fn.returnType),
      returnTypeText: fn.returnType.text,
      isMainWithArgs: this.isMainFunctionWithArgs(fn.name, params),
      firstParameterName: params?.[0]?.name,
      parameters: this.planFunctionParameters(params),
      renderBody: () => this.renderBlock(fn.body),
      renderParameterList: params
        ? () => this.generateParameterList(params)
        : null,
    };
  }

  private generateFunction(fn: IFunctionDeclarationSyntax): string {
    return this.invokeGenerator(functionGenerator, this.planFunction(fn));
  }

  private generateParameter(
    param: IParameterSyntax,
    paramIndex?: number,
  ): string {
    const typeName = this.typeNameOf(param.type);
    const name = param.name;

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

    const input = ParameterInputAdapter.fromAST(this.planParameter(param), {
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
  private planParameter(param: IParameterSyntax): IPlannedParameter {
    const arrayType = param.type.kind === "array" ? param.type : null;
    const element = arrayType ? arrayType.element : param.type;
    const stringType = element.kind === "string" ? element : null;
    return {
      name: param.name,
      isConst: param.const,
      typeName: this.typeNameOf(param.type),
      mappedType: this.renderType(param.type),
      renderDimensions: arrayType
        ? () =>
            arrayType.dimensions.map((dimension) =>
              dimension ? this.renderLoweredDimension(dimension) : "",
            )
        : null,
      isString: stringType !== null,
      stringCapacity: CodeGenWalker.stringCapacityOf(param.type) ?? undefined,
      line: param.span.line,
      stringTypeLine: stringType?.span.line,
      arrayTypeLine: arrayType?.span.line,
    };
  }

  /**
   * One array dimension, as C should say it.
   *
   * Issue #1159: fold a compile-time constant to its value first. Emitting the
   * identifier makes `u8[SIZE] buf` a VLA parameter (`uint8_t buf[SIZE]`)
   * while the matching local declaration folds to `uint8_t b[6]` -- the same
   * const rendered two ways in one .c, and a construct CLAUDE.md rules out.
   * #1175: a dimension is a constant wherever it is written (ADR-023: no
   * VLAs), so it folds everywhere, by the one rule.
   */
  private renderLoweredDimension(expression: TExpression): string {
    // ADR-036: a dimension is a constant expression in every context, so a
    // fixture occupies the matrix cell it is written in
    AdrProvenance.record("036", expression.span.line);
    const dimension = ConstantFold.settled(
      ConstExprLowering.lower(expression),
      dimensionEvalOptions(this.transpileState),
    );
    invariant(
      dimension !== null,
      `2.1 rejects a dimension with no value (E0909, E0910) before render: '${expression.written}'`,
    );
    return String(dimension);
  }

  /**
   * `[N][M]`, or `[]` for an omitted size. Bug #8 folded only at file scope;
   * #1175: a dimension is a constant wherever it is written (ADR-023: no
   * VLAs), so it folds everywhere, by the one rule.
   */
  private renderLoweredDimensions(
    dimensions: ReadonlyArray<TExpression | null>,
  ): string {
    return dimensions
      .map((dimension) =>
        dimension ? `[${this.renderLoweredDimension(dimension)}]` : "[]",
      )
      .join("");
  }

  private constantOf(expr: TExpression): number | undefined {
    return ConstExprLowering.valueOf(
      expr,
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
    decl: Extract<
      TStatement,
      { kind: "variableDeclaration" | "constructorDeclaration" }
    >,
  ): TPlannedVariableDecl {
    if (decl.kind === "constructorDeclaration") {
      return this.planConstructorDecl(decl);
    }
    // Issue #696: Use shared modifier builder
    const modifiers = VariableModifierBuilder.build(
      decl.modifiers,
      this.host.state.inFunctionBody,
      decl.initializer !== null,
      this.host.state,
    );
    const name = decl.name;
    const type = this._inferVariableType(decl);
    this._trackLocalVariable(name);
    // ADR-057: the identifier this declaration is EMITTED under. Computed once,
    // here, because the string and array forms below return before the plain
    // declaration is assembled -- a second call would be a second place
    // deciding the same thing. Registries keep the source name; only the
    // generated text moves.
    const emittedName = this.host.state.emittedLocalName(name);
    const stringPlan = this.planStringDecl(decl);
    if (stringPlan) {
      return {
        kind: "string",
        string: stringPlan,
        emittedName,
        modifiers,
        isConst: decl.modifiers.const,
      };
    }
    // Statements rather than an object literal, because the ORDER matters and
    // an object literal's property order is not something a reader checks:
    // the array half renders its type dimensions eagerly, and it must do so
    // before anything the initializer renders.
    const array = this.planArrayDeclaration(decl);
    const initializer = this.planVariableInitializer(decl);
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
    decl: Extract<TStatement, { kind: "constructorDeclaration" }>,
  ): TPlannedVariableDecl {
    const type = this.renderType(decl.type);
    const args = decl.arguments.map((argument) =>
      this.boundName(argument.name, {
        line: argument.span.line,
        column: argument.span.column,
      }),
    );
    if (this.host.state.inFunctionBody) {
      this.host.state.registerLocalVariable(decl.name);
    }
    return {
      kind: "constructor",
      type,
      emittedName: this.host.state.emittedLocalName(decl.name),
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
    decl: IVariableDeclarationSyntax,
  ): IPlannedArrayDeclaration {
    const arrayDims = decl.dimensions;
    const typeDims = decl.type.kind === "array" ? decl.type.dimensions : null;
    if (!CodeGenWalker.isArrayDeclaration(decl)) {
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
    const hasEmptyArrayTypeDimension = (typeDims ?? []).includes(null);
    const hasEmptyDimension =
      arrayDims.includes(null) || hasEmptyArrayTypeDimension;
    const initializer = decl.initializer;
    // #1822: the inferred path emits its one counted size as the whole suffix,
    // which is right only for a one-dimensional array. E0892 rejects every
    // other empty dimension in pass 2.1.
    invariant(
      !hasEmptyDimension || CodeGenWalker.arrayRank(decl) === 1,
      `an array that omits a size is one-dimensional -- E0892 rejects '${decl.name}' in pass 2.1, before this runs`,
    );
    return {
      isArray: true,
      hasEmptyDimension,
      hasEmptyArrayTypeDimension,
      declaredSize: hasEmptyDimension
        ? this.countedSize(decl)
        : (this.foldFirstDimension(typeDims ?? []) ??
          this.foldFirstDimension(arrayDims)),
      arrayTypeDimensions: ArrayDimensionUtils.renderArrayTypeDimensions(
        typeDims === null
          ? null
          : this.planLoweredArrayTypeDimensions(typeDims, decl),
      ),
      renderCStyleDimensions: () => this.renderLoweredDimensions(arrayDims),
      init: initializer
        ? {
            renderExpression: () => this.renderExpression(initializer),
            renderTypeName: () => this.typeNameOf(decl.type),
            renderDimensions: () => this.renderLoweredDimensions(arrayDims),
          }
        : null,
    };
  }

  /**
   * Issue #500: both spellings make an array -- C-style trailing dimensions
   * and the C-Next array type. The one predicate for a local, a scope member
   * and a file-scope variable.
   */
  private static isArrayDeclaration(decl: IVariableDeclarationSyntax): boolean {
    return decl.dimensions.length > 0 || decl.type.kind === "array";
  }

  /** How many dimensions a declaration states, in both spellings together */
  private static arrayRank(decl: IVariableDeclarationSyntax): number {
    return (
      (decl.type.kind === "array" ? decl.type.dimensions.length : 0) +
      decl.dimensions.length
    );
  }

  /**
   * #1664 box 3: what this declaration says, as 1.3 recorded it and 1.4
   * settled it -- the facts the `.h` is written from. The name binds to its
   * own declaration from the end of the name on (LexicalFrames), so asking
   * there reads this declaration, never one it shadows.
   */
  private declaredHere(
    decl: IVariableDeclarationSyntax,
  ): TTypeInfo | undefined {
    return this.host.state.declarationTypeInfo(null, decl.name, {
      line: decl.nameSpan.line,
      column: decl.nameSpan.column + decl.name.length,
    });
  }

  /**
   * The size 1.3 counted for this declaration's one omitted dimension, or
   * null when there is none to read: only a one-dimensional declaration is
   * counted (E0892), and an uncounted size is `UNRESOLVED_DIMENSION`, 0.
   */
  private countedSize(decl: IVariableDeclarationSyntax): number | null {
    const rank = CodeGenWalker.arrayRank(decl);
    const size = this.declaredHere(decl)?.arrayDimensions?.[0];
    return rank === 1 && size !== undefined && size > 0 ? size : null;
  }

  /** An omitted size as rendered: the declaration's count, asserted. */
  private omittedSizeOf(
    declaration: IVariableDeclarationSyntax | null,
  ): number {
    const size = declaration === null ? null : this.countedSize(declaration);
    invariant(
      size !== null,
      `an omitted array size is counted from a one-dimensional declaration's list or string literal -- E0892 rejects '${declaration?.name ?? "a struct field"}' in pass 2.1, before this runs`,
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
    dims: ReadonlyArray<TExpression | null>,
  ): number | null {
    const size = dims[0];
    return size ? (this.constantOf(size) ?? null) : null;
  }

  /**
   * How a variable's initializer is rendered (ADR-015 when there is none).
   */
  private planVariableInitializer(
    decl: IVariableDeclarationSyntax,
  ): TPlannedVariableInitializer {
    const initializer = decl.initializer;
    if (!initializer) {
      return {
        kind: "zero",
        render: (isArray) => this.zeroInitializerOf(decl.type, isArray),
      };
    }
    return {
      kind: "expression",
      renderTypeName: () => this.typeNameOf(decl.type),
      renderExpression: () => this.renderExpression(initializer),
      resolveExpressionType: () => this.directTypeOf(initializer),
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
    decl: IVariableDeclarationSyntax,
  ): TPlannedStringDecl | null {
    const type = decl.type;
    if (type.kind === "array" && type.element.kind === "string") {
      this.host.state.requireInclude("string");
      return this.planStringArray(decl, type.dimensions, type.element.capacity);
    }
    if (type.kind !== "string") {
      return null;
    }
    const initializer = decl.initializer;
    if (type.capacity === null) {
      return {
        kind: "unsized",
        initText: initializer ? CodeGenWalker.stringTextOf(initializer) : null,
        declaredCapacity: this.declaredHere(decl)?.stringCapacity ?? null,
      };
    }
    this.host.state.requireInclude("string");
    return {
      kind: "bounded",
      capacity: Number.parseInt(type.capacity, 10),
      init: initializer ? this.planStringInit(initializer) : null,
    };
  }

  /** What the string helpers test: a literal's token, a name, else as written */
  private static stringTextOf(expression: TExpression): string {
    if (expression.kind === "literal") {
      return expression.text;
    }
    return expression.kind === "identifier"
      ? expression.name
      : expression.written;
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
  private planStringInit(expression: TExpression): IPlannedStringInit {
    const text = CodeGenWalker.stringTextOf(expression);
    return {
      concat: this._getStringConcatOperands(expression),
      renderSubstring: () => this._getSubstringOperands(expression),
      text,
      sourceCapacity: StringOperationsHelper.getStringExprCapacity(
        text,
        this.declaredTypeAt(expression.span),
      ),
      render: () => this.renderExpression(expression),
    };
  }

  /**
   * Issue #1029: `string<32>[4] items`.
   */
  private planStringArray(
    decl: IVariableDeclarationSyntax,
    typeDims: ReadonlyArray<TExpression | null>,
    elementCapacity: string | null,
  ): TPlannedStringDecl {
    if (elementCapacity === null) {
      invariant(
        false,
        "a string array states its element capacity -- E0862 rejects an unsized one in pass 2.1",
      );
    }
    let dimensions = ArrayDimensionUtils.renderArrayTypeDimensions(
      this.planLoweredArrayTypeDimensions(typeDims, decl),
    );
    dimensions += this.renderLoweredDimensions(decl.dimensions);
    const initializer = decl.initializer;
    return {
      kind: "array",
      elementCapacity: Number.parseInt(elementCapacity, 10),
      dimensions,
      // #1644: the SAME call the loop above renders the declarator with. The
      // size used to expand a fill-all must equal the size emitted in `[...]`,
      // or the array is the declared length with the wrong contents.
      // An omitted size is the declaration's count; a written one folds.
      declaredSize: typeDims[0]
        ? this.foldFirstDimension(typeDims)
        : this.countedSize(decl),
      renderInit: initializer ? () => this.renderExpression(initializer) : null,
    };
  }

  /**
   * Issue #696: Infer variable type, handling nullable C pointer types.
   * Issue #895 Bug B: Infer pointer type from C function return type.
   */
  private _inferVariableType(decl: IVariableDeclarationSyntax): string {
    const type = this.renderDeclaredType(decl.type);
    const info = this.host.state.declarationTypeInfo(null, decl.name, {
      line: decl.nameSpan.line,
      column: decl.nameSpan.column + 1,
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
  private namedTypeOf(
    type: TTypeSyntax,
  ): { name: string; separator: string } | null {
    // #1285: ask for named types by name. Everything else -- string, array,
    // template, primitive, `void` -- returns null and is handled by the
    // caller's own chain, which is where it was always handled. An enumerated
    // list of alternatives to SKIP would have to be kept in step with the
    // grammar from ~3000 lines away, and getting it wrong fails open.
    const name = TypeNameLadder.classifyNamed(
      type,
      this.host.state.currentScopePath,
      this.host.state.typeBindingDeps((parts) =>
        this.resolveQualifiedType(parts),
      ),
    )?.name;
    if (name === undefined) {
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
    targetExpr: TExpression,
    lastStep: IChainStep | undefined,
  ): IBitAccessAnalysis {
    // #1668 (C12): what the last subscript indexes is the typer's answer,
    // typed once with the target (`IChainBase.last`)
    return MemberChainAnalyzer.analyze(
      lastStep,
      AssignmentTarget.parts(targetExpr).ops.map((op) => this.planTargetOp(op)),
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
  private planTargetOp(op: TPostfixOpSyntax): TPlannedTargetOp {
    if (op.kind === "member") {
      return { kind: "member", name: op.name };
    }

    const indexes = op.kind === "subscript" ? op.indexes : [];
    return {
      kind: "subscript",
      indexCount: indexes.length,
      renderIndexes: () => indexes.map((index) => this.renderExpression(index)),
      foldWidth: () =>
        indexes.length === 2 ? this.constantOf(indexes[1]) : undefined,
    };
  }

  /** #1668 (C7): what an assignment target writes, by the one binder */
  private targetDeclaration(target: TExpression): IChainBase {
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
    targetExpr: TExpression,
    target: IChainBase,
  ): string | null {
    if (target.last?.subscript === "array_slice") return null;
    const written = OperandTyper.typeOfTarget(
      targetExpr,
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

  private generateAssignment(site: IAssignmentSyntax): string {
    const targetExpr = site.target;

    // #1668 (C7): what the target writes, bound once -- the expected type
    // below and every classifier rule and handler read this
    const target = this.targetDeclaration(targetExpr);
    const expectedType = this.assignedValueType(targetExpr, target);
    // withExpectedType restores expectedType however the render exits
    const value = this.host.state.withExpectedType(expectedType, () =>
      this.renderExpression(site.value),
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
    const parts = AssignmentTarget.parts(targetExpr);
    if (parts.ops.length === 0) {
      const assignedName = parts.identifier;
      if (assignedName !== null) {
        this.host.state.floatShadowCurrent.delete(
          BitRangeHelper.getShadowVarName(assignedName),
        );
      }
    }

    // ADR-065: Dispatch to assignment handlers
    // Build context, classify, and dispatch - all patterns handled by handlers
    const assignCtx = buildAssignmentContext(site, {
      target,
      state: this.host.state,
      // Already rendered, inside the expectedType window above -- never again.
      generatedValue: () => value,
      generateAssignmentTarget: (target, opCount) =>
        this.generateAssignmentTarget(target, opCount),
      analyzeMemberChainForBitAccess: (target, lastStep) =>
        this.analyzeMemberChainForBitAccess(target, lastStep),
      generateExpression: (expr) => this.renderExpression(expr),
      tryEvaluateConstant: (expr) => this.tryEvaluateConstant(expr),
      expressionType: (expr) => this.directTypeOf(expr),
      integerExpressionType: (expr) => this.integerTypeOf(expr),
      hasFloatingOperand: (expr) => this.hasFloatingLeaf(expr),
      toCOperator: (cnextOp, line) =>
        AssignmentOperatorMapper.toCOperator(cnextOp, line),
    });
    // ADR-065: the classifier and handlers reach 2.3's state through the context
    const assignmentKind = AssignmentClassifier.classify(assignCtx);
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
    postfixOps: readonly TPostfixOpSyntax[],
  ): IPostfixOperation[] {
    return postfixOps.map((op) => {
      const expressions = op.kind === "subscript" ? op.indexes : [];
      return {
        memberName: op.kind === "member" ? op.name : null,
        indexCount: expressions.length,
        // #1652: the nodes stay closed over HERE, in the walk. What crosses
        // into the render layer is a count and a function returning strings.
        renderIndexes: () =>
          expressions.map((expr) => this.renderExpression(expr)),
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
  private planReturn(
    statement: Extract<TStatement, { kind: "return" }>,
  ): TPlannedReturn {
    const value = statement.value;
    if (!value) {
      return { kind: "void" };
    }
    return {
      kind: "value",
      render: (expectedType) =>
        expectedType
          ? this.host.state.withExpectedType(expectedType, () =>
              this.renderExpression(value),
            )
          : this.renderExpression(value),
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
  private planIf(statement: Extract<TStatement, { kind: "if" }>): IPlannedIf {
    const { condition, whenTrue, whenFalse } = statement;
    const lengthCounts = StringLengthCounter.countExpression(
      condition,
      this.host.state,
    );
    if (whenTrue.kind === "block") {
      StringLengthCounter.countBlockInto(
        whenTrue,
        lengthCounts,
        this.host.state,
      );
    }
    return {
      lengthCounts,
      renderCondition: () => this.renderExpression(condition),
      renderThen: () => this.renderStatement(whenTrue),
      renderElse: whenFalse ? () => this.renderStatement(whenFalse) : null,
    };
  }

  /** A `while`: condition then body. */
  private planWhile(
    statement: Extract<TStatement, { kind: "while" }>,
  ): IPlannedLoop {
    return {
      renderCondition: () => this.renderExpression(statement.condition),
      renderBody: () => this.renderStatement(statement.body),
    };
  }

  /**
   * A `do ... while` (ADR-027): the same two parts as `while`, and the
   * generator calls them in the other order. Note the body is a BLOCK here and
   * a statement there -- which is exactly the difference a thunk hides.
   */
  private planDoWhile(
    statement: Extract<TStatement, { kind: "doWhile" }>,
  ): IPlannedLoop {
    return {
      renderCondition: () => this.renderExpression(statement.condition),
      renderBody: () => this.renderBlock(statement.body),
    };
  }

  /** An ADR-068 `forever`: a body and nothing else. */
  private planForever(
    statement: Extract<TStatement, { kind: "forever" }>,
  ): IPlannedForever {
    return { renderBody: () => this.renderBlock(statement.body) };
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
  private planForVarDecl(decl: IVariableDeclarationSyntax): IPlannedForVarDecl {
    // Issue #696: Use shared modifier builder
    const modifiers = VariableModifierBuilder.buildSimple(decl.modifiers);
    // #1484: a `for` init declares a variable like any other, including one
    // typed by an ADR-029 function-as-type.
    const typeName = this.renderDeclaredType(decl.type);
    const initializer = decl.initializer;
    return {
      atomic: modifiers.atomic,
      volatile: modifiers.volatile,
      typeName,
      declaredName: decl.name,
      renderArrayDimensions:
        decl.dimensions.length > 0
          ? () => this.renderLoweredDimensions(decl.dimensions)
          : null,
      renderInitializer: initializer
        ? (expectedType) =>
            this.host.state.withExpectedType(expectedType, () =>
              this.renderExpression(initializer),
            )
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
  private planForAssignment(site: IAssignmentSyntax): IPlannedForAssignment {
    return {
      render: () => {
        const form = ForHeaderAssignment.multiStatementForm(
          site,
          this.host.state.typingContext(),
        );
        invariant(form === null, `E0715 rejects ${form} in a for header`);
        const code = this.generateAssignment(site);
        invariant(
          code.endsWith(";"),
          `a for-header assignment renders as one statement, not '${code}'`,
        );
        return code.slice(0, -1);
      },
    };
  }

  /** A `for` header and its body. */
  private planFor(
    statement: Extract<TStatement, { kind: "for" }>,
  ): IPlannedFor {
    const { condition, update } = statement;
    return {
      init: this.planForInit(statement.init),
      renderCondition: () => {
        invariant(
          condition !== null,
          "a for header states its condition -- E0707 rejects an empty one in pass 2.1, before this runs",
        );
        return this.renderExpression(condition);
      },
      update: update ? this.planForAssignment(update) : null,
      renderBody: () => this.renderStatement(statement.body),
    };
  }

  /** Which of the two `for` init forms this header uses, if either. */
  private planForInit(
    init: Extract<TStatement, { kind: "for" }>["init"],
  ): IPlannedFor["init"] {
    if (init?.kind === "variableDeclaration") {
      return { kind: "varDecl", plan: this.planForVarDecl(init) };
    }
    if (init?.kind === "assignment") {
      return { kind: "assignment", plan: this.planForAssignment(init) };
    }
    return null;
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
  private planSwitch(
    statement: Extract<TStatement, { kind: "switch" }>,
  ): IPlannedSwitch {
    const subject = this.renderExpression(statement.subject);
    const subjectEnumType = this.enumTypeOf(statement.subject) ?? undefined;
    const defaultCase = statement.defaultCase;
    return {
      subject,
      subjectEnumType,
      cases: statement.cases.map((switchCase) => ({
        labels: switchCase.labels.map((label) => this.planCaseLabel(label)),
        renderBody: () => this.renderStatements(switchCase.body),
      })),
      renderDefaultBody: defaultCase
        ? () => this.renderStatements(defaultCase.body)
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
  private planCaseLabel(label: TCaseLabelSyntax): TPlannedCaseLabel {
    switch (label.kind) {
      case "qualified":
        return { kind: "qualified", parts: label.path };
      case "identifier":
        return { kind: "identifier", name: label.name };
      case "integer":
      case "hex":
        return { kind: "numeric", text: label.text, negative: label.negative };
      case "binary":
        return { kind: "binary", text: label.text, negative: false };
      case "char":
        return { kind: "char", text: label.text };
      case "missing":
        return { kind: "none" };
    }
  }

  /** Every statement of a block, rendered in order. */
  private renderStatements(block: TBlockSyntax): readonly string[] {
    return block.statements.map((statement) => this.renderStatement(statement));
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
  private _generateLiteralExpression(text: string): string {
    const result = generateLiteral(
      text,
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
  private planCast(expr: TExpressionOf<"cast">): IPlannedCast {
    const targetType = this.renderType(expr.type);
    const targetTypeName = expr.type.text;
    const operandCode = this.renderUnary(expr.operand);
    const operand = OperandTyper.typeOf(
      expr.operand,
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
  private generateSizeofExpr(expr: TExpressionOf<"sizeof">): string {
    return SizeofResolver.generate(
      this.planSizeofOperand(expr),
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
  private planSizeofOperand(expr: TExpressionOf<"sizeof">): TSizeofOperand {
    const type = expr.type;
    if (type) {
      if (type.kind === "qualified") {
        return {
          kind: "qualified-type",
          firstName: type.path[0],
          memberName: type.path[1],
          renderTypeName: () => this.renderType(type),
        };
      }
      if (type.kind === "user") {
        return { kind: "user-type", text: type.text };
      }
      return { kind: "plain-type", cTypeName: this.renderType(type) };
    }

    const expression = expr.expression;
    invariant(expression !== null, "sizeof holds a type or an expression");
    return {
      kind: "expression",
      simpleIdentifier: ExpressionShape.simpleIdentifier(expression),
      hasSideEffects: ExpressionCalls.containsCall(expression),
      code: this.renderExpression(expression),
    };
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
   *
   * Spells `uint32_t` / `uint8_t` without recording them (#1927): these are
   * emitted only when `InterruptMask.wrap` asks for them, and that effect
   * records `uint32_t`, so `<stdint.h>` is already decided.
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
   * Format leading comments with current indentation
   */
  private formatLeadingComments(comments: readonly IComment[]): string[] {
    const indent = FormatUtils.indent(this.host.state.indentLevel);
    return this.commentFormatter.formatLeadingComments([...comments], indent);
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
