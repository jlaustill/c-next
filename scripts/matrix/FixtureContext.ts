/**
 * Issue #1219: the context axis of the scope-context matrix.
 *
 * Answers "which of the five structural contexts encloses this source line?"
 * by walking the real parse tree, not by inspecting file structure. The
 * difference matters: a fixture that declares both a scope and a top-level
 * function contains two contexts, and asking the FILE which contexts it has
 * would credit both, whether or not the construct under test is in either.
 */

import { ProgramContext } from "../../src/cnx/PARSE/2-Parse/grammar/CnxParser";
import TMatrixContext from "../types/TMatrixContext";

/** Parse-tree node shape this walk relies on, structurally typed. */
interface IPositionedNode {
  start?: { line: number; column: number } | null;
  stop?: { line: number; column: number; text?: string | null } | null;
  getChildCount(): number;
  getChild(index: number): unknown;
  constructor: { name: string };
}

const SCOPE_NODE = "ScopeDeclarationContext";
const FUNCTION_NODE = "FunctionDeclarationContext";
const VARIABLE_NODE = "VariableDeclarationContext";
const FOR_HEADER_NODE = "ForVarDeclContext";

function isPositionedNode(node: unknown): node is IPositionedNode {
  return (
    typeof node === "object" &&
    node !== null &&
    typeof (node as IPositionedNode).getChildCount === "function"
  );
}

/**
 * Innermost structural context enclosing `line`, or null when the line sits in
 * no declaration at all.
 *
 * Null is a distinct answer from any context, not a default. A preprocessor
 * directive, a bare comment, or a diagnostic reported at the synthetic
 * position 1:0 (#1235) encloses nothing -- reporting those as
 * "global-variable" would manufacture occupancy for a cell nothing exercises.
 */
/**
 * Whether `line`:`column` falls inside `node`'s token span, the stop token's
 * text included. Only a diagnostic has a column; a position without one is
 * never inside a span, since the line alone cannot tell a `for` header's
 * declaration from the condition, update or body sharing its line.
 */
function spans(node: IPositionedNode, line: number, column?: number): boolean {
  const { start, stop } = node;
  if (column == null || !start || !stop) return false;
  const stopEnd = stop.column + (stop.text?.length ?? 1);
  const afterStart =
    line > start.line || (line === start.line && column >= start.column);
  const beforeStop =
    line < stop.line || (line === stop.line && column < stopEnd);
  return afterStart && beforeStop;
}

function at(
  tree: ProgramContext,
  line: number,
  column?: number,
): TMatrixContext | null {
  let inScope = false;
  let inFunction = false;
  let inVariable = false;
  let inForHeader = false;

  const visit = (node: unknown): void => {
    if (!isPositionedNode(node)) return;

    const start = node.start?.line;
    const stop = node.stop?.line;

    if (start != null && stop != null) {
      // Prune: this subtree cannot contain the line.
      if (line < start || line > stop) return;

      const name = node.constructor.name;
      if (name === SCOPE_NODE) inScope = true;
      else if (name === FUNCTION_NODE) inFunction = true;
      else if (name === VARIABLE_NODE) inVariable = true;
      else if (name === FOR_HEADER_NODE && spans(node, line, column)) {
        inForHeader = true;
      }
    }
    // A node missing position info is not evidence either way, so recurse
    // rather than prune -- pruning it would hide every positioned descendant.

    const childCount = node.getChildCount();
    for (let index = 0; index < childCount; index += 1) {
      visit(node.getChild(index));
    }
  };

  visit(tree);

  // A `for` header's declaration is innermost wherever its function sits.
  // Only a position with a column can land in one (see `spans`).
  if (inForHeader) return "for-header";
  if (inScope) {
    if (inFunction) return "scope-method";
    return inVariable ? "scope-member" : null;
  }
  if (inFunction) return "top-level-function";
  return inVariable ? "global-variable" : null;
}

class FixtureContext {
  static at = at;
}

export default FixtureContext;
