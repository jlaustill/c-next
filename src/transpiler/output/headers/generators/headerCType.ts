import CppNamespaceUtils from "../../../../utils/CppNamespaceUtils";
import SymbolTable from "../../../logic/symbols/SymbolTable";
import TypeMapping from "./mapType";

/**
 * The C or C++ type name a header declares a thing with.
 *
 * Two steps, and they have to happen together: a C++ namespaced type arrives as
 * the generated C name `SeaDash__Parse__ParseResult` and must be written
 * `SeaDash::Parse::ParseResult` for a C++ header, and every type then goes
 * through the C-Next to C mapping.
 *
 * ## Why it is one function
 *
 * It was two, and only one of them converted. `resolveFieldCType` called
 * `convertToCppNamespace` before `mapType`; `generateFunctionPrototype` and
 * `generateParameter` called `mapType` alone. So the same type was written
 * `SeaDash::Parse::ParseResult` as a struct field and
 * `SeaDash__Parse__ParseResult` as a function parameter, in the same header --
 * the second naming a type nothing declares, which is why
 * `tests/issue-502/function-param-init` would not compile (#1520).
 *
 * Neither site was wrong about what it wanted. They were two derivations of one
 * answer, and one of them had not been taught the C++ case.
 */
function headerCType(
  typeName: string,
  symbolTable: SymbolTable | undefined,
): string {
  return TypeMapping.mapType(
    CppNamespaceUtils.convertToCppNamespace(typeName, symbolTable),
  );
}

export default headerCType;
