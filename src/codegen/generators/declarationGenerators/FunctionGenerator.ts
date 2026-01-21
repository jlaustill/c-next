/**
 * FunctionGenerator - Function Declaration Generation
 *
 * Generates C function declarations from C-Next function syntax.
 *
 * Example:
 *   fn add(i32 a, i32 b) -> i32 { return a + b; }
 *   ->
 *   int32_t add(int32_t* a, int32_t* b) { return *a + *b; }
 *
 * ADR-006: Pass-by-reference semantics for non-array, non-float parameters.
 * ADR-029: Callback typedef generation for functions used as types.
 */
import * as Parser from "../../../parser/grammar/CNextParser";
import IGeneratorInput from "../IGeneratorInput";
import IGeneratorState from "../IGeneratorState";
import IGeneratorOutput from "../IGeneratorOutput";
import IOrchestrator from "../IOrchestrator";
import TGeneratorFn from "../TGeneratorFn";

/**
 * Generate a C function from a C-Next function declaration.
 *
 * Handles:
 * - Return type generation
 * - Parameter generation with ADR-006 pointer semantics
 * - Main function special cases (args parameter, int return type)
 * - Callback typedef generation (ADR-029)
 */
const generateFunction: TGeneratorFn<Parser.FunctionDeclarationContext> = (
  node: Parser.FunctionDeclarationContext,
  _input: IGeneratorInput,
  _state: IGeneratorState,
  orchestrator: IOrchestrator,
): IGeneratorOutput => {
  const returnType = orchestrator.generateType(node.type());
  const name = node.IDENTIFIER().getText();

  // Issue #269: Set current function name for pass-by-value lookup
  orchestrator.setCurrentFunctionName(name);

  // Track parameters for ADR-006 pointer semantics
  orchestrator.setParameters(node.parameterList() ?? null);

  // ADR-016: Clear local variables and mark that we're in a function body
  orchestrator.enterFunctionBody();

  // Check for main function with args parameter (u8 args[][] or string args[])
  const isMainWithArgs = orchestrator.isMainFunctionWithArgs(
    name,
    node.parameterList(),
  );

  let params: string = ""; // Will be set below
  let actualReturnType: string;

  // Issue #268: Generate body FIRST to track parameter modifications,
  // then generate parameter list using that tracking info
  if (isMainWithArgs) {
    // Special case: main(u8 args[][]) -> int main(int argc, char *argv[])
    actualReturnType = "int";
    params = "int argc, char *argv[]";
    // Store the args parameter name for translation in the body
    const argsParam = node.parameterList()!.parameter()[0];
    orchestrator.setMainArgsName(argsParam.IDENTIFIER().getText());
  } else {
    // For main() without args, always use int return type for C++ compatibility
    actualReturnType = name === "main" ? "int" : returnType;
  }

  // Generate body first (this populates modifiedParameters)
  const body = orchestrator.generateBlock(node.block());

  // Issue #268: Update symbol's parameter info with auto-const before clearing
  orchestrator.updateFunctionParamsAutoConst(name);

  // Now generate parameter list (can use modifiedParameters for auto-const)
  if (!isMainWithArgs) {
    params = node.parameterList()
      ? orchestrator.generateParameterList(node.parameterList()!)
      : "void";
  }

  // ADR-016: Clear local variables and mark that we're no longer in a function body
  orchestrator.exitFunctionBody();
  orchestrator.setCurrentFunctionName(null); // Issue #269: Clear function name
  orchestrator.clearParameters();

  const functionCode = `${actualReturnType} ${name}(${params}) ${body}\n`;

  // ADR-029: Generate callback typedef only if this function is used as a type
  if (name !== "main" && orchestrator.isCallbackTypeUsedAsFieldType(name)) {
    const typedef = orchestrator.generateCallbackTypedef(name);
    if (typedef) {
      return {
        code: functionCode + typedef,
        effects: [],
      };
    }
  }

  return {
    code: functionCode,
    effects: [],
  };
};

export default generateFunction;
