/**
 * #1991: the questions 2.2 asks of the file's state while it plans, answered
 * once by `PlanQueries`; 2.3's orchestrator answers them through it too.
 */
interface IPlanQueries {
  isKnownStruct(typeName: string): boolean;
  isCppScopeSymbol(name: string): boolean;
  isCppMode(): boolean;
  getCallbackTypedefName(typeName: string): string | null;
  isCppEnumClass(typeName: string): boolean;
  isIntegerType(typeName: string): boolean;
  isCnxFunction(name: string): boolean;
  isFloatType(typeName: string): boolean;
  getKnownEnums(): ReadonlySet<string>;
}

export default IPlanQueries;
