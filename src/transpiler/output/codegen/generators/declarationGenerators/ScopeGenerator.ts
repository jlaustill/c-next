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
 */
import * as Parser from "../../../../logic/parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";
import generateScopedRegister from "./ScopedRegisterGenerator";
import ArrayDimensionUtils from "./ArrayDimensionUtils";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";
import type IScopeSymbol from "../../../../types/symbols/IScopeSymbol";
import CodeGenState from "../../../../state/CodeGenState";
import AdrProvenance from "../../../../state/AdrProvenance";
import SymbolRegistry from "../../../../state/SymbolRegistry";
import ScopeUtils from "../../../../../utils/ScopeUtils";
import PublicInterface from "../../../../logic/symbols/PublicInterface";
import generateEnumHeader from "../../../headers/generators/generateEnumHeader";
import generateBitmapHeader from "../../../headers/generators/generateBitmapHeader";
import generateStructHeader from "../../../headers/generators/generateStructHeader";
import type IHeaderTypeInput from "../../../headers/generators/IHeaderTypeInput";
import VariableModifierBuilder from "../../helpers/VariableModifierBuilder";

/**
 * Generate initializer expression for a variable declaration.
 * Issue #872: Sets expectedType for MISRA 7.2 U suffix on unsigned literals.
 */
function generateInitializer(
  varDecl: Parser.VariableDeclarationContext,
  isArray: boolean,
  orchestrator: IOrchestrator,
): string {
  if (varDecl.expression()) {
    // Issue #872: Set expectedType for MISRA 7.2 U suffix compliance
    // Issue #992: withDeclarationInit suppresses compound literals at file scope (GCC 9-12 compat)
    const typeName = orchestrator.generateType(varDecl.type());
    return CodeGenState.withExpectedType(typeName, () =>
      CodeGenState.withDeclarationInit(
        () => ` = ${orchestrator.generateExpression(varDecl.expression()!)}`,
      ),
    );
  }
  // ADR-015: Zero initialization for uninitialized scope variables
  return ` = ${orchestrator.getZeroInitializer(varDecl.type(), isArray)}`;
}

/**
 * Extract scoped name from a declaration node.
 * Returns both the local name and the fully qualified scoped name.
 */
function getScopedName(
  node: { IDENTIFIER(): { getText(): string } },
  declaringScope: IScopeSymbol | null,
): { name: string; fullName: string } {
  const name = node.IDENTIFIER().getText();
  return {
    name,
    fullName: QualifiedNameGenerator.forMember(declaringScope, name),
  };
}

/**
 * Validate and resolve constructor arguments, ensuring each is const.
 * Returns array of scope-prefixed argument names.
 */
function resolveConstructorArgs(
  argIdentifiers: { getText(): string }[],
  declaringScope: IScopeSymbol | null,
  line: number,
  orchestrator: IOrchestrator,
): string[] {
  const resolvedArgs: string[] = [];

  for (const argNode of argIdentifiers) {
    const argName = argNode.getText();
    // Arguments must be resolved with scope prefix
    const scopedArgName = QualifiedNameGenerator.forMember(
      declaringScope,
      argName,
    );

    // Check if it's const using orchestrator
    if (!orchestrator.isConstValue(scopedArgName)) {
      throw new Error(
        `Error at line ${line}: Constructor argument '${argName}' must be const. ` +
          `C++ constructors in C-Next only accept const variables.`,
      );
    }

    resolvedArgs.push(scopedArgName);
  }

  return resolvedArgs;
}

/**
 * Generate a scope variable declaration.
 * Returns the declaration string, or null if the variable should be skipped.
 */
function generateScopeVariable(
  varDecl: Parser.VariableDeclarationContext,
  declaringScope: IScopeSymbol | null,
  isPrivate: boolean,
  orchestrator: IOrchestrator,
): string | null {
  const varName = varDecl.IDENTIFIER().getText();

  // Issue #375: Check for constructor syntax
  const constructorArgList = varDecl.constructorArgumentList();
  if (constructorArgList) {
    return generateConstructorVariable(
      varDecl,
      varName,
      declaringScope,
      isPrivate,
      constructorArgList,
      orchestrator,
    );
  }

  // Issue #282: Check if this is a const variable - const values should be inlined
  const isConst = varDecl.constModifier() !== null;

  // Issue #500: Check if array before skipping - arrays must be emitted
  // Check both C-style arrayDimension and C-Next style arrayType
  // Use optional chaining for mock compatibility in tests
  const arrayDims = varDecl.arrayDimension();
  const arrayTypeCtx = varDecl.type().arrayType?.() ?? null;
  const isArray = arrayDims.length > 0 || arrayTypeCtx !== null;

  // Issue #282: Private const variables should be inlined, not emitted at file scope
  // Issue #500: EXCEPT arrays - arrays must be emitted as static const
  // The inlining happens in CodeGenerator when resolving this.CONST_NAME
  if (isPrivate && isConst && !isArray) {
    return null;
  }

  return generateRegularVariable(
    varDecl,
    varName,
    declaringScope,
    isPrivate,
    orchestrator,
  );
}

/**
 * Generate a constructor-style variable declaration.
 */
function generateConstructorVariable(
  varDecl: Parser.VariableDeclarationContext,
  varName: string,
  declaringScope: IScopeSymbol | null,
  isPrivate: boolean,
  constructorArgList: Parser.ConstructorArgumentListContext,
  orchestrator: IOrchestrator,
): string {
  // ADR-016: All scope variables are emitted at file scope
  const type = orchestrator.generateType(varDecl.type());
  const fullName = QualifiedNameGenerator.forMember(declaringScope, varName);
  const prefix = isPrivate ? "static " : "";

  // Validate and resolve constructor arguments
  const argIdentifiers = constructorArgList.IDENTIFIER();
  const line = varDecl.start?.line ?? 0;
  const resolvedArgs = resolveConstructorArgs(
    argIdentifiers,
    declaringScope,
    line,
    orchestrator,
  );

  return `${prefix}${type} ${fullName}(${resolvedArgs.join(", ")});`;
}

/**
 * Generate a regular (non-constructor) variable declaration.
 */
function generateRegularVariable(
  varDecl: Parser.VariableDeclarationContext,
  varName: string,
  declaringScope: IScopeSymbol | null,
  isPrivate: boolean,
  orchestrator: IOrchestrator,
): string {
  // Derive array and const info from varDecl
  const isConst = varDecl.constModifier() !== null;
  const arrayDims = varDecl.arrayDimension();
  const arrayTypeCtx = varDecl.type().arrayType?.() ?? null;
  const isArray = arrayDims.length > 0 || arrayTypeCtx !== null;

  // ADR-016: All scope variables are emitted at file scope (static-like persistence)
  let type = orchestrator.generateType(varDecl.type());
  // Issue #1200: a callback-typed scope member renders as its function-pointer
  // typedef. Without this the raw function name was emitted as the type, which
  // collides with the function of the same name.
  const callbackTypedef = orchestrator.getCallbackTypedefName(type);
  if (callbackTypedef !== null) {
    type = callbackTypedef;
  }
  const fullName = QualifiedNameGenerator.forMember(declaringScope, varName);

  // Issue #948: Check if this is an opaque (forward-declared) struct type
  // Issue #958: Also check for external typedef struct types (complete definitions)
  // Both opaque and external typedef struct types must be declared as pointers
  const isOpaque = orchestrator.isOpaqueType(type);
  const isExternalStruct = orchestrator.isTypedefStructType(type);
  if (isOpaque || isExternalStruct) {
    type = `${type}*`;
    // Mark as "opaque" scope variable so CallExprGenerator knows this is already
    // a pointer and doesn't add '&' when passing to functions. The name is historical
    // but the tracking applies to any scope variable declared as a pointer type.
    orchestrator.markOpaqueScopeVariable(fullName);
  }

  // Issue #998: Use VariableModifierBuilder for consistent modifier handling
  // This handles const, atomic, volatile, and validates mutual exclusion
  // Scope variables are always at file scope (not in function body), no initializer for modifier purposes
  const modifiers = VariableModifierBuilder.build(
    varDecl,
    false, // inFunctionBody - scope vars are file scope
    false, // hasInitializer - doesn't affect volatile/atomic handling
    false, // cppMode - doesn't affect volatile/atomic handling
  );
  // For scope variables: static for private, no modifier for public
  // Then add volatile (from atomic or volatile keyword), then const
  const staticPrefix = isPrivate ? "static " : "";
  const volatilePrefix = modifiers.atomic || modifiers.volatile;
  const constPrefix = isConst ? "const " : "";

  // Build declaration with all dimensions
  let decl = `${staticPrefix}${volatilePrefix}${constPrefix}${type} ${fullName}`;
  decl += ArrayDimensionUtils.generateArrayTypeDimension(
    arrayTypeCtx,
    orchestrator,
  );

  if (arrayDims.length > 0) {
    // C-style or additional dimensions
    decl += orchestrator.generateArrayDimensions(arrayDims);
  }

  // ADR-045: Add string capacity dimension for string arrays
  decl += ArrayDimensionUtils.generateStringCapacityDim(varDecl.type());

  // Issue #948: Opaque types use NULL initialization instead of {0}
  // Issue #958: External typedef struct types also use NULL initialization
  // Issue #996: ...but only for SCALAR handles, which are single pointers. An
  // *array* of opaque handles needs a brace initializer ({0}), not a scalar
  // NULL. Route arrays through generateInitializer, which uses
  // getZeroInitializer(type, isArray) — the single source of truth for
  // zero-initialization (ADR-015).
  if ((isOpaque || isExternalStruct) && !isArray) {
    decl += " = NULL";
  } else {
    decl += generateInitializer(varDecl, isArray, orchestrator);
  }

  return decl + ";";
}

/**
 * Generate a scope function declaration.
 * Returns array of output lines (function definition + optional callback typedef).
 */
function generateScopeFunction(
  funcDecl: Parser.FunctionDeclarationContext,
  declaringScope: IScopeSymbol | null,
  isPrivate: boolean,
  orchestrator: IOrchestrator,
): string[] {
  const returnType = orchestrator.generateType(funcDecl.type());
  const funcName = funcDecl.IDENTIFIER().getText();
  // Use QualifiedNameGenerator for consistent C-style name generation
  const fullName = QualifiedNameGenerator.forFunctionInScope(
    declaringScope,
    funcName,
  );
  const prefix = isPrivate ? "static " : "";

  // Issue #269: Set current function name for pass-by-value lookup
  orchestrator.setCurrentFunctionName(fullName);

  // Track parameters for ADR-006 pointer semantics
  orchestrator.setParameters(funcDecl.parameterList() ?? null);

  // ADR-016: Enter function body context (also clears modifiedParameters for Issue #281)
  orchestrator.enterFunctionBody();

  // Issue #281: Generate body FIRST to track parameter modifications,
  // then generate parameter list using that tracking info
  const body = orchestrator.generateBlock(funcDecl.block());

  // Issue #281: Update symbol's parameter info with auto-const before generating params
  orchestrator.updateFunctionParamsAutoConst(fullName);

  // Now generate parameter list (can use modifiedParameters for auto-const)
  const params = funcDecl.parameterList()
    ? orchestrator.generateParameterList(funcDecl.parameterList()!)
    : "void";

  // ADR-016: Exit function body context
  orchestrator.exitFunctionBody();
  orchestrator.setCurrentFunctionName(null); // Issue #269: Clear function name
  orchestrator.clearParameters();

  const lines: string[] = [];
  lines.push("", `${prefix}${returnType} ${fullName}(${params}) ${body}`);

  // ADR-029: Generate callback typedef only if used as a type
  orchestrator.recordCallbackTypedef(fullName);

  return lines;
}

/**
 * #1300: the type definitions this scope contributes to the `.c`.
 *
 * A type is defined in exactly ONE file -- the header when it reaches the
 * public interface, this file otherwise -- so the set here is the complement of
 * what `PublicInterface` decided, asked per symbol rather than re-derived.
 *
 * The TEXT comes from the header's own per-type emitters. Codegen used to have
 * its own inline emitters, reached only when a file had no header at all; when
 * private types started routing through them they were found to disagree with
 * the header in two ways, each an exit-0 miscompile:
 *
 *   - they emitted in `scopeMember()` SOURCE order, so a struct naming an enum
 *     declared below it forward-referenced. Marking both `public` compiled,
 *     because the header groups by kind -- the asymmetry was the bug.
 *   - they had no ADR-029 callback resolution, so a function-typed field was
 *     emitted as the bare function name rather than its typedef.
 *
 * Ordering by kind here is not this function agreeing with the header; it is
 * the same grouping the header applies, for the same reason C needs it.
 */
function generateScopeTypeDefinitions(
  node: Parser.ScopeDeclarationContext,
  declaringScope: IScopeSymbol | null,
  input: IGeneratorInput,
): string[] {
  const symbols = input.symbols;
  if (!symbols) {
    return [];
  }

  const typeInput: IHeaderTypeInput = {
    ...symbols,
    symbolTable: CodeGenState.symbolTable,
    callbackTypes: CodeGenState.callbackTypes,
  };

  const definedHere = (nameNode: {
    IDENTIFIER(): { getText(): string };
  }): string | null => {
    const { fullName } = getScopedName(nameNode, declaringScope);
    if (
      CodeGenState.sourcePath !== null &&
      PublicInterface.definesTypeInHeader(
        CodeGenState.symbolTable,
        CodeGenState.sourcePath,
        fullName,
      )
    ) {
      return null;
    }
    return fullName;
  };

  const enums: string[] = [];
  const bitmaps: string[] = [];
  const structs: string[] = [];

  for (const member of node.scopeMember()) {
    const enumDecl = member.enumDeclaration();
    if (enumDecl) {
      const name = definedHere(enumDecl);
      if (name !== null) enums.push(generateEnumHeader(name, typeInput));
      continue;
    }
    const bitmapDecl = member.bitmapDeclaration();
    if (bitmapDecl) {
      const name = definedHere(bitmapDecl);
      if (name !== null) bitmaps.push(generateBitmapHeader(name, typeInput));
      continue;
    }
    const structDecl = member.structDeclaration();
    if (structDecl) {
      const name = definedHere(structDecl);
      if (name !== null) structs.push(generateStructHeader(name, typeInput));
    }
  }

  const all = [...enums, ...bitmaps, ...structs];
  return all.length === 0 ? [] : ["", ...all];
}

/**
 * Process a single scope member and return lines to add.
 */
function processScopeMember(
  member: Parser.ScopeMemberContext,
  declaringScope: IScopeSymbol | null,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string[] {
  // #1241: ADR-016's rule -- a scope member is emitted at file scope under a
  // scope-qualified C name, with visibility deciding linkage -- fires once per
  // member, here. Recorded at the MEMBER's position rather than the scope's, so
  // a variable member and a function member land in different matrix contexts
  // (scope-member vs scope-method) instead of both crediting whichever
  // declaration the scope keyword happens to sit in.
  AdrProvenance.record("016", member.start?.line);

  // ADR-016, via the one helper the symbols layer also asks (#1300). Codegen
  // used to recompute this, so the header and the body decided visibility
  // independently -- which is the divergence this issue is made of.
  const visibility = ScopeUtils.getMemberVisibility(member);
  const isPrivate = visibility === "private";

  // Handle variable declarations
  if (member.variableDeclaration()) {
    const varDecl = member.variableDeclaration()!;
    const result = generateScopeVariable(
      varDecl,
      declaringScope,
      isPrivate,
      orchestrator,
    );
    return result === null ? [] : [result];
  }

  // Handle function declarations
  if (member.functionDeclaration()) {
    const funcDecl = member.functionDeclaration()!;
    return generateScopeFunction(
      funcDecl,
      declaringScope,
      isPrivate,
      orchestrator,
    );
  }

  // Handle register declarations inside scopes
  if (member.registerDeclaration()) {
    const regDecl = member.registerDeclaration()!;
    const result = generateScopedRegister(
      regDecl,
      declaringScope,
      input,
      state,
      orchestrator,
    );
    return ["", result.code];
  }

  return [];
}

/**
 * Generate C code from a C-Next scope declaration.
 *
 * ADR-016: Scopes provide:
 * - Namespace prefixing (Scope_member)
 * - Visibility control (private -> static, public -> extern)
 * - Organization without runtime overhead
 */
const generateScope: TGeneratorFn<Parser.ScopeDeclarationContext> = (
  node: Parser.ScopeDeclarationContext,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const name = node.IDENTIFIER().getText();

  // Set current scope for nested generation (imperative, not effect-based)
  orchestrator.setCurrentScope(name);

  // #1285: thread the scope SYMBOL, not its name, so every member below qualifies
  // through the parent chain instead of re-joining one level from a leaf.
  //
  // Resolved here rather than read back from `CodeGenState.currentScope`: that
  // would make the generated NAMES depend on `orchestrator.setCurrentScope` having
  // reached global state, which is a side effect through an interface. A mock
  // orchestrator that does not forward it produced bare names with nothing failing
  // at the type level. `getOrCreateScope` is the same resolver `setCurrentScopeByPath`
  // uses, and it is cached, so this is one decision asked twice -- not two decisions.
  //
  // Passing a leaf path is correct while `scopeMember` admits no `scopeDeclaration`;
  // that limit is tracked as #1304 and is unchanged by this.
  const declaringScope = SymbolRegistry.getOrCreateScope(name);

  const lines: string[] = [];
  lines.push(`/* Scope: ${name} */`);

  // #1300: types first, grouped by kind, before anything that can name them.
  lines.push(...generateScopeTypeDefinitions(node, declaringScope, input));

  for (const member of node.scopeMember()) {
    lines.push(
      ...processScopeMember(member, declaringScope, input, state, orchestrator),
    );
  }

  lines.push("");

  // Clear scope at end
  orchestrator.setCurrentScope(null);

  return {
    code: lines.join("\n"),
    effects: [],
  };
};

/**
 * Resolve bitmap backing type from symbols or keyword
 */
function _getBitmapBackingType(
  fullName: string,
  node: Parser.BitmapDeclarationContext,
  input: IGeneratorInput,
): string {
  const symbolType = input.symbols?.bitmapBackingType.get(fullName);
  if (symbolType) return symbolType;

  const bitmapKeyword = node.getChild(0)?.getText() || "bitmap32";
  switch (bitmapKeyword) {
    case "bitmap8":
      return "uint8_t";
    case "bitmap16":
      return "uint16_t";
    case "bitmap64":
      return "uint64_t";
    default:
      return "uint32_t";
  }
}

/**
 * Generate bitmap field comments from AST (fallback when symbols unavailable)
 */
function _generateBitmapFieldCommentsFromAST(
  fields: Parser.BitmapMemberContext[],
): string[] {
  if (fields.length === 0) return [];

  const lines: string[] = ["/* Fields:"];
  let bitOffset = 0;

  for (const field of fields) {
    const fieldName = field.IDENTIFIER().getText();
    const width = field.INTEGER_LITERAL()
      ? Number.parseInt(field.INTEGER_LITERAL()!.getText(), 10)
      : 1;
    const endBit = bitOffset + width - 1;
    const bitRange =
      width === 1 ? `bit ${bitOffset}` : `bits ${bitOffset}-${endBit}`;
    lines.push(
      ` *   ${fieldName}: ${bitRange} (${width} bit${width > 1 ? "s" : ""})`,
    );
    bitOffset += width;
  }

  lines.push(" */");
  return lines;
}

export default generateScope;
