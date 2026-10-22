import type TranspileState from "../TranspileState";
import CppNamespaceUtils from "../../utils/CppNamespaceUtils";
import TypeCheckUtils from "../../utils/TypeCheckUtils";
import SymbolLookupHelper from "./SymbolLookupHelper";
import type IPlanQueries from "./types/IPlanQueries";

/** The one answer to each of `IPlanQueries`, read off the file's state */
class PlanQueries implements IPlanQueries {
  private readonly state: TranspileState;

  constructor(state: TranspileState) {
    this.state = state;
  }

  isKnownStruct(typeName: string): boolean {
    return this.state.isKnownStruct(typeName);
  }

  isCppScopeSymbol(name: string): boolean {
    return CppNamespaceUtils.isCppNamespace(
      name,
      this.state.symbolTable ?? undefined,
    );
  }

  isCppMode(): boolean {
    return this.state.cppMode;
  }

  getCallbackTypedefName(typeName: string): string | null {
    return this.state.callbackTypes.get(typeName)?.typedefName ?? null;
  }

  isCppEnumClass(typeName: string): boolean {
    return SymbolLookupHelper.isCppEnumClass(this.state.symbolTable, typeName);
  }

  isIntegerType(typeName: string): boolean {
    return TypeCheckUtils.isInteger(typeName);
  }

  isCnxFunction(name: string): boolean {
    return SymbolLookupHelper.isCnxFunctionCombined(
      this.state.knownFunctions,
      this.state.symbolTable,
      name,
    );
  }

  isFloatType(typeName: string): boolean {
    return TypeCheckUtils.isFloat(typeName);
  }

  getKnownEnums(): ReadonlySet<string> {
    return this.state.symbols!.knownEnums;
  }
}

export default PlanQueries;
