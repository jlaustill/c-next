/**
 * ScopeGenerator - ADR-016 Scope Declaration Generation
 *
 * Generates C code from C-Next scope declarations with visibility control.
 * Scopes provide namespace prefixing and static/extern visibility.
 *
 * Example:
 *   scope Driver {
 *     private u32 counter;
 *     public fn init() -> void { counter <- 0; }
 *   }
 *   ->
 *   // Scope: Driver
 *   static uint32_t Driver_counter = 0;
 *   void Driver_init(void) { Driver_counter = 0; }
 *
 * ## It renders a plan; it does not read a tree (#1445 box 3)
 *
 * Which members this scope has, which of four kinds each one is, which types it
 * contributes to the `.c` and in what order, and whether a private const scalar
 * is skipped -- all of that is `CodeGenerator.planScope` now.
 *
 * ## Why nearly everything here is a thunk
 *
 * `setCurrentScope` is the first thing this generator does, and every type name
 * below resolves against the path it sets: a bare `Flags` inside `scope Chip`
 * emits `Chip__Flags`. A value rendered at PLAN time resolves against the outer
 * path instead and emits `Flags` -- wrong, and silent. So a member's type, a
 * method's return type, its parameter plan and a register's plan are all
 * unevaluated on arrival, even though every one of them is needed
 * unconditionally.
 *
 * Wrapping the planner in `CodeGenState.withScopePath` would make eager renders
 * resolve correctly and would still be wrong: the bodies have to render inside
 * `enterFunctionContext`, so they would stay thunks while everything else moved
 * ahead of them -- and in C++ that shifts `getNextTempVarName` allocation
 * between initializers and bodies, which renames temps in the emitted C.
 */
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import IPlannedScope from "../../types/IPlannedScope";
import TGeneratorFn from "../TGeneratorFn";
import TPlannedScopeMember from "../../types/TPlannedScopeMember";
import TPlannedScopeVariable from "../../types/TPlannedScopeVariable";
import registerGeneratorFor from "./RegisterGenerator";
import CodeGenState from "../../../../../transpiler/state/CodeGenState";
import AdrProvenance from "../../../../../transpiler/state/AdrProvenance";
import generateEnumHeader from "../../../headers/generators/generateEnumHeader";
import generateBitmapHeader from "../../../headers/generators/generateBitmapHeader";
import generateStructHeader from "../../../headers/generators/generateStructHeader";
import type IHeaderTypeInput from "../../../headers/generators/IHeaderTypeInput";

/**
 * The header's own per-type emitters, by kind.
 *
 * #1300: the TEXT comes from the header rather than from inline emitters here.
 * Codegen used to have its own, reached only when a file had no header at all;
 * when private types started routing through them they were found to disagree
 * with the header in two ways, each an exit-0 miscompile -- they emitted in
 * source order rather than grouped by kind, so a struct naming an enum declared
 * below it forward-referenced, and they had no ADR-029 callback resolution, so
 * a function-typed field came out as the bare function name.
 *
 * The ORDER is the plan's; this map only says who renders what.
 */
const HEADER_TYPE_EMITTERS: Readonly<
  Record<
    IPlannedScope["typeDefinitions"][number]["kind"],
    (name: string, input: IHeaderTypeInput) => string
  >
> = {
  enum: generateEnumHeader,
  bitmap: generateBitmapHeader,
  struct: generateStructHeader,
};

/**
 * Render the type definitions this scope contributes to the `.c`.
 */
function renderTypeDefinitions(
  plan: IPlannedScope,
  input: IGeneratorInput,
): string[] {
  const symbols = input.symbols;
  if (!symbols || plan.typeDefinitions.length === 0) {
    return [];
  }

  const typeInput: IHeaderTypeInput = {
    ...symbols,
    symbolTable: CodeGenState.symbolTable,
    callbackTypes: CodeGenState.callbackTypes,
  };

  return [
    "",
    ...plan.typeDefinitions.map((definition) =>
      HEADER_TYPE_EMITTERS[definition.kind](definition.cName, typeInput),
    ),
  ];
}

/**
 * Render a scope variable, or null when the plan says it is not emitted.
 */
function renderScopeVariable(
  plan: TPlannedScopeVariable,
  orchestrator: IOrchestrator,
): string | null {
  switch (plan.kind) {
    // Issue #282/#500: a private const scalar is inlined at its uses. Nothing
    // is rendered -- not even the type, which would register an include for a
    // declaration that never appears.
    case "skipped":
      return null;

    // Issue #375: constructor syntax.
    case "constructor": {
      // ADR-016: All scope variables are emitted at file scope
      const type = plan.renderType();
      const prefix = plan.isPrivate ? "static " : "";
      return `${prefix}${type} ${plan.fullName}(${plan.args.join(", ")});`;
    }

    case "regular":
      return renderRegularVariable(plan, orchestrator);
  }
}

/**
 * Render a regular (non-constructor) scope variable declaration.
 */
function renderRegularVariable(
  plan: Extract<TPlannedScopeVariable, { kind: "regular" }>,
  orchestrator: IOrchestrator,
): string {
  // ADR-016: All scope variables are emitted at file scope (static-like persistence)
  let type = plan.renderType();
  // Issue #1200: a callback-typed scope member renders as its function-pointer
  // typedef. Without this the raw function name was emitted as the type, which
  // collides with the function of the same name.
  const callbackTypedef = orchestrator.getCallbackTypedefName(type);
  if (callbackTypedef !== null) {
    type = callbackTypedef;
  }

  // Issue #948: Check if this is an opaque (forward-declared) struct type
  // Issue #958: Also check for external typedef struct types (complete definitions)
  // Both opaque and external typedef struct types must be declared as pointers
  const isOpaque = orchestrator.isOpaqueType(type);
  const isExternalStruct = orchestrator.isTypedefStructType(type);
  if (isOpaque || isExternalStruct) {
    // ADR-030 decided here: the type is incomplete, so the member is emitted as
    // a pointer. Recorded at the DECLARATION's position, which is what puts this
    // in the scope-member context rather than crediting the scope keyword's line.
    // #1511: the opacity verdict is the artifact's, so this is the point where a
    // cross-file fact changes generated shape -- and the only kind of site the
    // matrix can derive an occupancy from for ADR-030's OPAQUE-HANDLE half,
    // which reports nothing. The ADR's other half raises E0422/E0423/E0426/E0427
    // and its fixtures occupy cells here on their own reported positions (#1582),
    // so an occupied cell is not evidence that this line still exists.
    if (isOpaque) {
      AdrProvenance.record("030", plan.declarationLine);
    }
    type = `${type}*`;
    // Mark as "opaque" scope variable so CallExprGenerator knows this is already
    // a pointer and doesn't add '&' when passing to functions. The name is historical
    // but the tracking applies to any scope variable declared as a pointer type.
    orchestrator.markOpaqueScopeVariable(plan.fullName);
  }

  // Issue #998: modifiers come from the one builder, which validates the
  // atomic/volatile mutual exclusion. For scope variables: static for private,
  // no modifier for public; then volatile, then const.
  const staticPrefix = plan.isPrivate ? "static " : "";
  const volatilePrefix = plan.atomic || plan.volatile;
  const constPrefix = plan.isConst ? "const " : "";

  // Build declaration with all dimensions
  let decl = `${staticPrefix}${volatilePrefix}${constPrefix}${type} ${plan.fullName}`;
  decl += plan.renderArrayTypeDimensions();

  if (plan.renderCStyleDimensions) {
    // C-style or additional dimensions
    decl += plan.renderCStyleDimensions();
  }

  // ADR-045: Add string capacity dimension for string arrays
  decl += plan.renderStringCapacityDimension();

  // Issue #948: Opaque types use NULL initialization instead of {0}
  // Issue #958: External typedef struct types also use NULL initialization
  // Issue #996: ...but only for SCALAR handles, which are single pointers. An
  // *array* of opaque handles needs a brace initializer ({0}), not a scalar
  // NULL -- which is why the plan's initializer thunk routes through
  // getZeroInitializer(type, isArray), the single source of truth for
  // zero-initialization (ADR-015).
  if ((isOpaque || isExternalStruct) && !plan.isArray) {
    decl += " = NULL";
  } else {
    decl += plan.renderInitializer();
  }

  return decl + ";";
}

/**
 * Render a scope function: its definition, and any callback typedef it records.
 */
function renderScopeFunction(
  plan: Extract<TPlannedScopeMember, { kind: "function" }>,
  orchestrator: IOrchestrator,
): string[] {
  const returnType = plan.renderReturnType();
  const prefix = plan.isPrivate ? "static " : "";

  // Issues #269/#477, ADR-016 (and #281's modifiedParameters clear): the same
  // four facts a top-level function sets, through the same call. #1277: the
  // return type was the one this copy omitted, so no `return` in a scope
  // method knew its type.
  //
  // #1445: the parameter plan is the orchestrator's -- this call and the
  // file-scope one would otherwise be two derivations of one parameter list --
  // and it is unevaluated until here, because a parameter's type resolves
  // against the scope path this generator has already entered.
  orchestrator.enterFunctionContext(
    plan.fullName,
    plan.declaredTypeText,
    plan.planParameters(),
  );

  // Issue #281: Generate body FIRST to track parameter modifications,
  // then generate parameter list using that tracking info
  const body = plan.renderBody();

  // Issue #281: Update symbol's parameter info with auto-const before generating params
  orchestrator.updateFunctionParamsAutoConst(plan.fullName);

  // Now generate parameter list (can use modifiedParameters for auto-const)
  const params = plan.renderParameterList();

  orchestrator.exitFunctionContext();

  const lines: string[] = [];
  lines.push("", `${prefix}${returnType} ${plan.fullName}(${params}) ${body}`);

  // ADR-029: Generate callback typedef only if used as a type
  orchestrator.recordCallbackTypedef(plan.fullName);

  return lines;
}

/**
 * Render a single scope member and return the lines it contributes.
 */
function renderScopeMember(
  plan: IPlannedScope,
  member: TPlannedScopeMember,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string[] {
  // #1241: ADR-016's rule -- a scope member is emitted at file scope under a
  // scope-qualified C name, with visibility deciding linkage -- fires once per
  // member, here. Recorded for EVERY member, including the ones nothing is
  // emitted for, because the occupancy it feeds is about where the decision was
  // taken and not about whether that decision produced text.
  AdrProvenance.record("016", member.adrLine);

  switch (member.kind) {
    case "variable": {
      const code = renderScopeVariable(member.variable, orchestrator);
      return code === null ? [] : [code];
    }

    case "function":
      return renderScopeFunction(member, orchestrator);

    case "register": {
      const result = registerGeneratorFor(plan.declaringScopePath)(
        member.planRegister(),
        input,
        state,
        orchestrator,
      );
      // #1445: the file-scope caller reaches this same generator through
      // `CodeGenWalker.invokeGenerator`, which applies its effects. This branch
      // used to return only the code, so one function had two callers honoring
      // half its contract -- safe solely because `effects` is hardcoded `[]`
      // today. The first effect added here (a `stdint` include for a member's
      // backing type, say) would have been emitted at file scope and silently
      // dropped inside a scope.
      orchestrator.applyEffects(result.effects);
      return ["", result.code];
    }

    case "other":
      return [];
  }
}

/**
 * Generate C code from a C-Next scope declaration.
 *
 * ADR-016: Scopes provide:
 * - Namespace prefixing (Scope_member)
 * - Visibility control (private -> static, public -> extern)
 * - Organization without runtime overhead
 */
const generateScope: TGeneratorFn<IPlannedScope> = (
  plan: IPlannedScope,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  // Set current scope for nested generation (imperative, not effect-based).
  // Everything below renders inside this window.
  orchestrator.setCurrentScope(plan.name);

  const lines: string[] = [
    `/* Scope: ${plan.name} */`,
    // #1300: types first, grouped by kind, before anything that can name them.
    ...renderTypeDefinitions(plan, input),
  ];

  for (const member of plan.members) {
    lines.push(...renderScopeMember(plan, member, input, state, orchestrator));
  }

  lines.push("");

  // Clear scope at end
  orchestrator.setCurrentScope(null);

  return {
    code: lines.join("\n"),
    effects: [],
  };
};
export default generateScope;
