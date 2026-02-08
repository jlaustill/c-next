/**
 * PostfixAnalysisUtils - Shared utilities for analyzing postfix target operations
 *
 * Extracts common logic for analyzing assignment targets that may have
 * member access (a.b.c) or subscript access (a[i]).
 */
import * as Parser from "../transpiler/logic/parser/grammar/CNextParser";

/**
 * Result of analyzing postfix target operations.
 */
interface IPostfixAnalysisResult {
  /** Chain of identifiers from base through member accesses */
  readonly identifiers: string[];
  /** Whether any subscript (array access) operations were found */
  readonly hasSubscript: boolean;
}

/**
 * Analyze postfix target operations to extract identifier chain and detect subscripts.
 *
 * Given an assignment target like `a.b.c[i].d`, this extracts:
 * - identifiers: ["a", "b", "c", "d"]
 * - hasSubscript: true
 *
 * @param baseId - The base identifier (leftmost name)
 * @param postfixOps - Array of postfix operations (member access or subscript)
 * @returns Analysis result with identifiers and subscript detection
 */
function analyzePostfixOps(
  baseId: string,
  postfixOps: Parser.PostfixTargetOpContext[],
): IPostfixAnalysisResult {
  const identifiers: string[] = [baseId];
  let hasSubscript = false;

  for (const op of postfixOps) {
    if (op.IDENTIFIER()) {
      identifiers.push(op.IDENTIFIER()!.getText());
    } else {
      hasSubscript = true;
    }
  }

  return { identifiers, hasSubscript };
}

export default analyzePostfixOps;
