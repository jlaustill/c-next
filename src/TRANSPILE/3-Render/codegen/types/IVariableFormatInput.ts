/**
 * IVariableFormatInput - Normalized input for variable declaration formatting.
 *
 * Phase 2 of unified code generation: Provides a single source of truth for
 * variable declaration string generation, eliminating sync issues between
 * .c/.cpp and .h/.hpp files.
 *
 * Unlike parameters (which have complex pass-by-value/reference semantics),
 * variable declarations focus on:
 * - Modifier ordering (extern, const, volatile)
 * - Type formatting (including string<N> → char[N+1])
 * - Array dimension placement
 */

/**
 * Modifier flags for variable declarations.
 * These are resolved before formatting - no CodeGenState access needed.
 */
interface IVariableModifiers {
  /** Explicit const modifier */
  isConst: boolean;
  /** atomic modifier (maps to volatile in C) */
  isAtomic: boolean;
  /** Explicit volatile modifier */
  isVolatile: boolean;
  /** extern linkage (for headers or top-level const in C++) */
  isExtern: boolean;
}

/**
 * Normalized input for variable declaration formatting.
 * All fields are pre-computed - the formatter is stateless.
 */
interface IVariableFormatInput {
  /** Variable name */
  name: string;

  /** Original C-Next type (e.g., 'u32', 'string<32>') */
  cnextType: string;

  /** Mapped C type (e.g., 'uint32_t', 'char[33]') */
  mappedType: string;

  /** Pre-resolved modifier flags */
  modifiers: IVariableModifiers;

  /** Array dimensions as strings (e.g., ['10', '20']) */
  arrayDimensions?: readonly string[];
}

export default IVariableFormatInput;
