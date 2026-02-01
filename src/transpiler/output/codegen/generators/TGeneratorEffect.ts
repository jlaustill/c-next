/**
 * Side effects returned by generators instead of mutating state.
 *
 * Using a discriminated union enables:
 * - Exhaustive switch handling (TypeScript catches missing cases)
 * - Type-safe payloads per effect type
 * - Central effect processing in the orchestrator
 */
import TTypeInfo from "../types/TTypeInfo";
import TParameterInfo from "../types/TParameterInfo";
import TIncludeHeader from "./TIncludeHeader";

type TGeneratorEffect =
  // === Include Effects ===
  | { type: "include"; header: TIncludeHeader }
  | { type: "isr" } // Needs ISR typedef

  // === Helper Function Effects ===
  | { type: "helper"; operation: string; cnxType: string } // Overflow clamp helper
  | { type: "safe-div"; operation: "div" | "mod"; cnxType: string } // Safe division helper

  // === Type Registration Effects ===
  | { type: "register-type"; name: string; info: TTypeInfo } // Register variable type
  | { type: "register-local"; name: string; isArray: boolean } // Register local variable
  | { type: "register-const-value"; name: string; value: number } // Register compile-time constant

  // === Scope Effects (ADR-016) ===
  | { type: "set-scope"; name: string | null } // Enter/exit a scope

  // === Function Body Effects ===
  | { type: "enter-function-body" } // Mark entering function body
  | { type: "exit-function-body" } // Mark exiting function body
  | {
      type: "set-parameters";
      params: ReadonlyMap<string, TParameterInfo>;
    } // Set current function parameters
  | { type: "clear-parameters" } // Clear current function parameters

  // === Callback Effects ===
  | { type: "register-callback-field"; key: string; typeName: string } // Register callback as struct field type

  // === Array Initializer Effects ===
  | { type: "set-array-init-count"; count: number } // Track array element count
  | { type: "set-array-fill-value"; value: string | undefined }; // Track fill-all value

export default TGeneratorEffect;
