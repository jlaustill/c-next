import type IStructFieldInfo from "./symbols/IStructFieldInfo";
import type TCSymbol from "./symbols/c/TCSymbol";
import type TCppSymbol from "./symbols/cpp/TCppSymbol";

/**
 * What the operand typer reads about C and C++ headers (#1668). Structural,
 * so no shared contract names `SymbolTable`, which satisfies it.
 */
interface IForeignSymbolLookup {
  getCSymbol(name: string): TCSymbol | undefined;
  getCppSymbol(name: string): TCppSymbol | undefined;
  getCppOverloads(name: string): TCppSymbol[];
  getStructFieldInfo(
    structName: string,
    fieldName: string,
  ): IStructFieldInfo | undefined;
  getStructFields(
    structName: string,
  ): Map<string, IStructFieldInfo> | undefined;
  isOpaqueType(typeName: string): boolean;
}

export default IForeignSymbolLookup;
