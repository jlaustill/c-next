/**
 * Parse C-Next source without generating code
 */

import transpile from "./transpiler";
import ITranspileResult from "./types/ITranspileResult";

/**
 * Parse C-Next source and return parse result without generating code
 * Convenience wrapper around transpile with parseOnly: true
 */
function parse(source: string): ITranspileResult {
  return transpile(source, { parseOnly: true });
}

export default parse;
