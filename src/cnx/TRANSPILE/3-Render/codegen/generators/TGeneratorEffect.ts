/**
 * Side effects returned by generators instead of mutating state.
 *
 * Using a discriminated union enables:
 * - Exhaustive switch handling (TypeScript catches missing cases)
 * - Type-safe payloads per effect type
 * - Central effect processing in the orchestrator
 */
import TParameterInfo from "../../../../types/TParameterInfo";

type TGeneratorEffect =
  // No include, C type or helper effect: 2.2 decides every header and helper
  // before 2.3 renders (#1991).
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
  | { type: "register-struct-init"; structName: string } // #1205: struct got an ADR-029 init function

  // === Array Initializer Effects ===
  | { type: "set-array-init-count"; count: number } // Track array element count
  | { type: "set-array-fill-value"; value: string | undefined }; // Track fill-all value

export default TGeneratorEffect;
