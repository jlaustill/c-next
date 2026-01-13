/**
 * Codegen types barrel export
 * Central export point for all codegen type definitions
 */

export { default as ECommentType } from "./ECommentType";
export { default as IComment } from "./IComment";
export { default as ICommentError } from "./ICommentError";
export { default as TParameterInfo } from "./TParameterInfo";
export { default as TOverflowBehavior } from "./TOverflowBehavior";
export { default as TTypeInfo } from "./TTypeInfo";
export { default as TCodeGenContext } from "./TCodeGenContext";
export type { IAssignmentContext } from "./TCodeGenContext";
export { default as ITargetCapabilities } from "./ITargetCapabilities";
export { default as IFunctionSignature } from "./IFunctionSignature";
export { default as ICallbackTypeInfo } from "./ICallbackTypeInfo";
export * from "./TTypeConstants";
