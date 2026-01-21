/**
 * Code generation context - shared state across all codegen components
 * Tracks current scope, variables, types, and generation state
 */

import TParameterInfo from "./TParameterInfo";
import TTypeInfo from "./TTypeInfo";
import ITargetCapabilities from "./ITargetCapabilities";
import IAssignmentContext from "./IAssignmentContext";

/**
 * Code generation context - mutable state passed to all codegen components
 */
type TCodeGenContext = {
  currentScope: string | null;
  indentLevel: number;
  scopeMembers: Map<string, Set<string>>;
  currentParameters: Map<string, TParameterInfo>;
  modifiedParameters: Set<string>;
  localArrays: Set<string>;
  localVariables: Set<string>;
  inFunctionBody: boolean;
  typeRegistry: Map<string, TTypeInfo>;
  expectedType: string | null;
  mainArgsName: string | null;
  assignmentContext: IAssignmentContext;
  lastArrayInitCount: number;
  lastArrayFillValue: string | undefined;
  lengthCache: Map<string, string> | null;
  targetCapabilities: ITargetCapabilities;
};

export default TCodeGenContext;
