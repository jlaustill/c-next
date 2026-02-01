/**
 * Callback type info for Function-as-Type pattern
 * Each function definition creates both a callable function AND a type
 */

interface ICallbackTypeInfo {
  functionName: string; // The original function name (also the type name)
  returnType: string; // Return type for typedef (C type)
  parameters: Array<{
    name: string;
    type: string; // C type
    isConst: boolean;
    isPointer: boolean; // Non-array params become pointers
    isArray: boolean; // Array parameters pass naturally as pointers
    arrayDims: string; // Array dimensions if applicable
  }>;
  typedefName: string; // e.g., "onReceive_fp"
}

export default ICallbackTypeInfo;
