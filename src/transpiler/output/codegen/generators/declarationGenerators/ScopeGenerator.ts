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
import BitmapCommentUtils from "./BitmapCommentUtils";
import ArrayDimensionUtils from "./ArrayDimensionUtils";
import QualifiedNameGenerator from "../../utils/QualifiedNameGenerator";
import CodeGenState from "../../../../state/CodeGenState";

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
    const typeName = orchestrator.generateType(varDecl.type());
    return CodeGenState.withExpectedType(
      typeName,
      () => ` = ${orchestrator.generateExpression(varDecl.expression()!)}`,
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
  scopeName: string,
): { name: string; fullName: string } {
  const name = node.IDENTIFIER().getText();
  return { name, fullName: QualifiedNameGenerator.forMember(scopeName, name) };
}

/**
 * Validate and resolve constructor arguments, ensuring each is const.
 * Returns array of scope-prefixed argument names.
 */
function resolveConstructorArgs(
  argIdentifiers: { getText(): string }[],
  scopeName: string,
  line: number,
  orchestrator: IOrchestrator,
): string[] {
  const resolvedArgs: string[] = [];

  for (const argNode of argIdentifiers) {
    const argName = argNode.getText();
    // Arguments must be resolved with scope prefix
    const scopedArgName = QualifiedNameGenerator.forMember(scopeName, argName);

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
  scopeName: string,
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
      scopeName,
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
    scopeName,
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
  scopeName: string,
  isPrivate: boolean,
  constructorArgList: Parser.ConstructorArgumentListContext,
  orchestrator: IOrchestrator,
): string {
  // ADR-016: All scope variables are emitted at file scope
  const type = orchestrator.generateType(varDecl.type());
  const fullName = QualifiedNameGenerator.forMember(scopeName, varName);
  const prefix = isPrivate ? "static " : "";

  // Validate and resolve constructor arguments
  const argIdentifiers = constructorArgList.IDENTIFIER();
  const line = varDecl.start?.line ?? 0;
  const resolvedArgs = resolveConstructorArgs(
    argIdentifiers,
    scopeName,
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
  scopeName: string,
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
  const fullName = QualifiedNameGenerator.forMember(scopeName, varName);

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

  // Issue #282: Add 'const' modifier for const variables
  const constPrefix = isConst ? "const " : "";
  const prefix = isPrivate ? "static " : "";

  // Build declaration with all dimensions
  let decl = `${prefix}${constPrefix}${type} ${fullName}`;
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
  if (isOpaque || isExternalStruct) {
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
  scopeName: string,
  isPrivate: boolean,
  orchestrator: IOrchestrator,
): string[] {
  const returnType = orchestrator.generateType(funcDecl.type());
  const funcName = funcDecl.IDENTIFIER().getText();
  // Use QualifiedNameGenerator for consistent C-style name generation
  const fullName = QualifiedNameGenerator.forFunctionStrings(
    scopeName,
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
  if (orchestrator.isCallbackTypeUsedAsFieldType(fullName)) {
    const typedef = orchestrator.generateCallbackTypedef(fullName);
    if (typedef) {
      lines.push(typedef);
    }
  }

  return lines;
}

/**
 * Generate enum members from AST when symbol info is not available.
 * Returns array of formatted enum member lines.
 */
function generateEnumMembersFromAST(
  members: Parser.EnumMemberContext[],
  fullName: string,
  orchestrator: IOrchestrator,
): string[] {
  const lines: string[] = [];
  let currentValue = 0;

  for (let i = 0; i < members.length; i++) {
    const member = members[i];
    const memberName = member.IDENTIFIER().getText();
    // Enum members use the full enum name as their "scope"
    const fullMemberName = QualifiedNameGenerator.forMember(
      fullName,
      memberName,
    );

    if (member.expression()) {
      const constValue = orchestrator.tryEvaluateConstant(member.expression()!);
      if (constValue !== undefined) {
        currentValue = constValue;
      }
    }

    const comma = i < members.length - 1 ? "," : "";
    lines.push(`    ${fullMemberName} = ${currentValue}${comma}`);
    currentValue++;
  }

  return lines;
}

/**
 * Process a single scope member and return lines to add.
 */
function processScopeMember(
  member: Parser.ScopeMemberContext,
  scopeName: string,
  input: IGeneratorInput,
  state: IGeneratorState,
  orchestrator: IOrchestrator,
): string[] {
  const visibility = member.visibilityModifier()?.getText() || "private";
  const isPrivate = visibility === "private";

  // Handle variable declarations
  if (member.variableDeclaration()) {
    const varDecl = member.variableDeclaration()!;
    const result = generateScopeVariable(
      varDecl,
      scopeName,
      isPrivate,
      orchestrator,
    );
    return result === null ? [] : [result];
  }

  // Handle function declarations
  if (member.functionDeclaration()) {
    const funcDecl = member.functionDeclaration()!;
    return generateScopeFunction(funcDecl, scopeName, isPrivate, orchestrator);
  }

  // ADR-017: Handle enum declarations inside scopes
  // Issue #369: Skip enum definition if self-include was added (it will be in the header)
  if (member.enumDeclaration() && !state.selfIncludeAdded) {
    const enumDecl = member.enumDeclaration()!;
    return [
      "",
      generateScopedEnumInline(enumDecl, scopeName, input, orchestrator),
    ];
  }

  // ADR-034: Handle bitmap declarations inside scopes
  // Issue #369: Skip bitmap definition if self-include was added (it will be in the header)
  if (member.bitmapDeclaration() && !state.selfIncludeAdded) {
    const bitmapDecl = member.bitmapDeclaration()!;
    return ["", generateScopedBitmapInline(bitmapDecl, scopeName, input)];
  }

  // Handle register declarations inside scopes
  if (member.registerDeclaration()) {
    const regDecl = member.registerDeclaration()!;
    const result = generateScopedRegister(
      regDecl,
      scopeName,
      input,
      state,
      orchestrator,
    );
    return ["", result.code];
  }

  // Handle struct declarations inside scopes
  // Issue #369: Skip struct definition if self-include was added (it will be in the header)
  if (member.structDeclaration() && !state.selfIncludeAdded) {
    const structDecl = member.structDeclaration()!;
    return [
      "",
      generateScopedStructInline(structDecl, scopeName, input, orchestrator),
    ];
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

  const lines: string[] = [];
  lines.push(`/* Scope: ${name} */`);

  for (const member of node.scopeMember()) {
    lines.push(...processScopeMember(member, name, input, state, orchestrator));
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
 * Generate enum inside a scope with proper prefixing.
 * Uses symbol info for enum members if available.
 */
function generateScopedEnumInline(
  node: Parser.EnumDeclarationContext,
  scopeName: string,
  input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string {
  const { fullName } = getScopedName(node, scopeName);
  const lines: string[] = [`typedef enum {`];

  // Try to get members from symbol info first
  const symbolMembers = input.symbols?.enumMembers.get(fullName);
  if (symbolMembers) {
    const memberEntries = Array.from(symbolMembers.entries());
    for (let i = 0; i < memberEntries.length; i++) {
      const [memberName, value] = memberEntries[i];
      // Enum members use the full enum name as their "scope"
      const fullMemberName = QualifiedNameGenerator.forMember(
        fullName,
        memberName,
      );
      const comma = i < memberEntries.length - 1 ? "," : "";
      lines.push(`    ${fullMemberName} = ${value}${comma}`);
    }
  } else {
    // Fall back to AST parsing
    lines.push(
      ...generateEnumMembersFromAST(node.enumMember(), fullName, orchestrator),
    );
  }

  lines.push(`} ${fullName};`, "");

  return lines.join("\n");
}

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

/**
 * Generate bitmap inside a scope with proper prefixing.
 * Uses symbol info for backing type if available.
 */
function generateScopedBitmapInline(
  node: Parser.BitmapDeclarationContext,
  scopeName: string,
  input: IGeneratorInput,
): string {
  const name = node.IDENTIFIER().getText();
  const fullName = QualifiedNameGenerator.forMember(scopeName, name);
  const backingType = _getBitmapBackingType(fullName, node, input);

  const lines: string[] = [];
  lines.push(`/* Bitmap: ${fullName} */`);

  // Issue #707: Use shared utility for bitmap field comments
  const symbolFields = input.symbols?.bitmapFields.get(fullName);
  if (symbolFields) {
    lines.push(...BitmapCommentUtils.generateBitmapFieldComments(symbolFields));
  } else {
    lines.push(..._generateBitmapFieldCommentsFromAST(node.bitmapMember()));
  }

  lines.push(`typedef ${backingType} ${fullName};`, "");

  return lines.join("\n");
}

/**
 * Generate a single struct field declaration for scoped struct.
 */
function generateScopedStructField(
  member: Parser.StructMemberContext,
  orchestrator: IOrchestrator,
): string {
  const fieldName = member.IDENTIFIER().getText();
  const fieldType = orchestrator.generateType(member.type());

  // Handle C-Next style arrayType syntax (u16[8] arr)
  const arrayTypeCtx = member.type().arrayType?.() ?? null;
  let dimStr = ArrayDimensionUtils.generateArrayTypeDimension(
    arrayTypeCtx,
    orchestrator,
  );

  // Handle C-style array dimensions if present
  const arrayDims = member.arrayDimension();
  if (arrayDims.length > 0) {
    dimStr += orchestrator.generateArrayDimensions(arrayDims);
  }

  // Handle string capacity for string fields
  dimStr += ArrayDimensionUtils.generateStringCapacityDim(member.type());

  return `    ${fieldType} ${fieldName}${dimStr};`;
}

/**
 * Generate struct inside a scope with proper prefixing.
 * Struct fields maintain their original types.
 */
function generateScopedStructInline(
  node: Parser.StructDeclarationContext,
  scopeName: string,
  _input: IGeneratorInput,
  orchestrator: IOrchestrator,
): string {
  const { fullName } = getScopedName(node, scopeName);
  const lines: string[] = [`typedef struct ${fullName} {`];

  // Process struct members
  for (const member of node.structMember()) {
    lines.push(generateScopedStructField(member, orchestrator));
  }

  lines.push(`} ${fullName};`, "");

  return lines.join("\n");
}

export default generateScope;
