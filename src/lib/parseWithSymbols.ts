/**
 * Parse C-Next source and extract symbols for IDE features
 * ADR-055 Phase 7: Direct TSymbol → ISymbolInfo conversion (no ISymbol intermediate)
 */

import CNextSourceParser from "../transpiler/logic/parser/CNextSourceParser";
import CNextResolver from "../transpiler/logic/symbols/cnext/index";
import SymbolNameUtils from "../transpiler/logic/symbols/cnext/utils/SymbolNameUtils";
import TypeResolver from "../utils/TypeResolver";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbol from "../transpiler/types/symbols/TSymbol";

/**
 * ADR-055 Phase 7: Convert TSymbol directly to ISymbolInfo array.
 * Expands compound symbols (bitmaps, enums, registers) into multiple ISymbolInfo entries.
 */
function convertTSymbolsToISymbolInfo(symbols: TSymbol[]): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];

  for (const symbol of symbols) {
    switch (symbol.kind) {
      case "bitmap":
        result.push(...convertBitmap(symbol));
        break;
      case "enum":
        result.push(...convertEnum(symbol));
        break;
      case "struct":
        result.push(convertStruct(symbol));
        break;
      case "function":
        result.push(...convertFunction(symbol));
        break;
      case "variable":
        result.push(convertVariable(symbol));
        break;
      case "register":
        result.push(...convertRegister(symbol));
        break;
      case "scope":
        result.push(convertScope(symbol));
        break;
    }
  }

  return result;
}

function convertBitmap(
  bitmap: import("../transpiler/types/symbols/IBitmapSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const mangledName = SymbolNameUtils.getMangledName(bitmap);
  const parent = bitmap.scope.name || undefined;

  result.push({
    name: bitmap.name,
    fullName: mangledName,
    kind: "bitmap",
    type: bitmap.backingType,
    parent,
    line: bitmap.sourceLine,
  });

  // Add bitmap fields
  for (const [fieldName, fieldInfo] of bitmap.fields) {
    result.push({
      name: fieldName,
      fullName: `${mangledName}.${fieldName}`,
      kind: "bitmapField",
      parent: mangledName,
      line: bitmap.sourceLine,
      size: fieldInfo.width,
    });
  }

  return result;
}

function convertEnum(
  enumSym: import("../transpiler/types/symbols/IEnumSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const mangledName = SymbolNameUtils.getMangledName(enumSym);
  const parent = enumSym.scope.name || undefined;

  result.push({
    name: enumSym.name,
    fullName: mangledName,
    kind: "enum",
    parent,
    line: enumSym.sourceLine,
  });

  // Add enum members
  for (const [memberName] of enumSym.members) {
    result.push({
      name: memberName,
      fullName: `${mangledName}_${memberName}`,
      kind: "enumMember",
      parent: mangledName,
      line: enumSym.sourceLine,
    });
  }

  return result;
}

function convertStruct(
  struct: import("../transpiler/types/symbols/IStructSymbol").default,
): ISymbolInfo {
  const mangledName = SymbolNameUtils.getMangledName(struct);
  const parent = struct.scope.name || undefined;

  return {
    name: struct.name,
    fullName: mangledName,
    kind: "struct",
    parent,
    line: struct.sourceLine,
  };
}

function convertFunction(
  func: import("../transpiler/types/symbols/IFunctionSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const mangledName = SymbolNameUtils.getMangledName(func);
  const parent = func.scope.name || undefined;
  const returnType = TypeResolver.getTypeName(func.returnType);

  // Build signature
  const paramTypes = func.parameters.map((p) =>
    TypeResolver.getTypeName(p.type),
  );
  const signature = `${returnType} ${mangledName}(${paramTypes.join(", ")})`;

  result.push({
    name: func.name,
    fullName: mangledName,
    kind: "function",
    type: returnType,
    parent,
    signature,
    accessModifier: func.isExported ? "public" : "private",
    line: func.sourceLine,
  });

  return result;
}

function convertVariable(
  variable: import("../transpiler/types/symbols/IVariableSymbol").default,
): ISymbolInfo {
  const mangledName = SymbolNameUtils.getMangledName(variable);
  const parent = variable.scope.name || undefined;
  const typeStr = TypeResolver.getTypeName(variable.type);

  return {
    name: variable.name,
    fullName: mangledName,
    kind: "variable",
    type: typeStr,
    parent,
    line: variable.sourceLine,
  };
}

function convertRegister(
  register: import("../transpiler/types/symbols/IRegisterSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const mangledName = SymbolNameUtils.getMangledName(register);
  const parent = register.scope.name || undefined;

  result.push({
    name: register.name,
    fullName: mangledName,
    kind: "register",
    parent,
    line: register.sourceLine,
  });

  // Add register members
  for (const [memberName, memberInfo] of register.members) {
    result.push({
      name: memberName,
      fullName: `${mangledName}.${memberName}`,
      kind: "registerMember",
      parent: mangledName,
      accessModifier: memberInfo.access,
      line: register.sourceLine,
    });
  }

  return result;
}

function convertScope(
  scope: import("../transpiler/types/symbols/IScopeSymbol").default,
): ISymbolInfo {
  return {
    name: scope.name,
    fullName: scope.name,
    kind: "namespace",
    line: scope.sourceLine,
  };
}

/**
 * Parse C-Next source and extract symbols for IDE features
 *
 * Unlike transpile(), this function attempts to extract symbols even when
 * there are parse errors, making it suitable for autocomplete during typing.
 *
 * @param source - C-Next source code string
 * @returns Parse result with symbols
 *
 * @example
 * ```typescript
 * import parseWithSymbols from './lib/parseWithSymbols';
 *
 * const result = parseWithSymbols(source);
 * // Find namespace members for autocomplete
 * const ledMembers = result.symbols.filter(s => s.parent === 'LED');
 * ```
 */
function parseWithSymbols(source: string): IParseWithSymbolsResult {
  // Parse C-Next source
  const { tree, errors } = CNextSourceParser.parse(source);

  // ADR-055 Phase 7: Direct TSymbol → ISymbolInfo conversion (no ISymbol intermediate)
  const tSymbols = CNextResolver.resolve(tree, "<source>");
  const symbols = convertTSymbolsToISymbolInfo(tSymbols);

  return {
    success: errors.length === 0,
    errors,
    symbols,
  };
}

export default parseWithSymbols;
