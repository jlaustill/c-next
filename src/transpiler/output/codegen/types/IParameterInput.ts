/**
 * Normalized parameter input for signature generation
 *
 * This interface serves as the contract between ParameterInputAdapter
 * (which normalizes AST or symbol data) and ParameterSignatureBuilder
 * (which generates the final C/C++ parameter string).
 *
 * All decisions are pre-computed before reaching the builder:
 * - Type classification (callback, string, array, etc.)
 * - Const qualifiers (explicit and auto-inferred)
 * - Pass-by-value vs pass-by-reference
 * - Array dimensions
 */
interface IParameterInput {
  /** Parameter name */
  name: string;

  /** Original C-Next type: 'u32', 'string<32>', 'Point', etc. */
  baseType: string;

  /** Mapped C type: 'uint32_t', 'char', 'Point', etc. */
  mappedType: string;

  /** Explicit const modifier from source code */
  isConst: boolean;

  /** Inferred const for unmodified parameters (computed from CodeGenState.modifiedParameters) */
  isAutoConst: boolean;

  /** Whether this is an array type */
  isArray: boolean;

  /** Array dimensions as strings: ['10', '20'] or ['33'] for string capacity */
  arrayDimensions?: string[];

  /** Whether this is a callback type (from CodeGenState.callbackTypes) */
  isCallback: boolean;

  /** The typedef name for callback types (e.g., 'HandleClickCallback') */
  callbackTypedefName?: string;

  /** Whether this is a string type (bounded or unbounded) */
  isString: boolean;

  /** Whether this is an unbounded string (no capacity) */
  isUnboundedString?: boolean;

  /** String capacity for non-array strings (used for tracking, not output) */
  stringCapacity?: number;

  /** Whether to use pass-by-value semantics (ISR, float, enum, small primitive) */
  isPassByValue: boolean;

  /** Whether to use pass-by-reference semantics (known struct or known primitive) */
  isPassByReference: boolean;
}

export default IParameterInput;
