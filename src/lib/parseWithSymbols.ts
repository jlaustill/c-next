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
import SymbolPathUtils from "./utils/SymbolPathUtils";

// Re-export helpers for use in this module
const buildScopePath = SymbolPathUtils.buildScopePath;
const getDotPathId = SymbolPathUtils.getDotPathId;
const getParentId = SymbolPathUtils.getParentId;

/**
 * ADR-055 Phase 7: Convert TSymbol directly to ISymbolInfo array.
 * Expands compound symbols (bitmaps, enums, structs, registers) into multiple ISymbolInfo entries.
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
        result.push(...convertStruct(symbol));
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
  const cName = SymbolNameUtils.getTranspiledCName(bitmap);
  const parent = bitmap.scope.name || undefined;
  const bitmapId = getDotPathId(bitmap);
  const bitmapParentId = getParentId(bitmap.scope);

  result.push({
    name: bitmap.name,
    fullName: cName,
    kind: "bitmap",
    type: bitmap.backingType,
    parent,
    id: bitmapId,
    parentId: bitmapParentId,
    line: bitmap.sourceLine,
  });

  // Add bitmap fields
  for (const [fieldName, fieldInfo] of bitmap.fields) {
    result.push({
      name: fieldName,
      fullName: `${cName}.${fieldName}`,
      kind: "bitmapField",
      parent: cName,
      id: `${bitmapId}.${fieldName}`,
      parentId: bitmapId,
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
  const cName = SymbolNameUtils.getTranspiledCName(enumSym);
  const parent = enumSym.scope.name || undefined;
  const enumId = getDotPathId(enumSym);
  const enumParentId = getParentId(enumSym.scope);

  result.push({
    name: enumSym.name,
    fullName: cName,
    kind: "enum",
    parent,
    id: enumId,
    parentId: enumParentId,
    line: enumSym.sourceLine,
  });

  // Add enum members
  for (const [memberName] of enumSym.members) {
    result.push({
      name: memberName,
      fullName: `${cName}_${memberName}`,
      kind: "enumMember",
      parent: cName,
      id: `${enumId}.${memberName}`,
      parentId: enumId,
      line: enumSym.sourceLine,
    });
  }

  return result;
}

function convertStruct(
  struct: import("../transpiler/types/symbols/IStructSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = SymbolNameUtils.getTranspiledCName(struct);
  const parent = struct.scope.name || undefined;
  const structId = getDotPathId(struct);
  const structParentId = getParentId(struct.scope);

  result.push({
    name: struct.name,
    fullName: cName,
    kind: "struct",
    parent,
    id: structId,
    parentId: structParentId,
    line: struct.sourceLine,
  });

  // Add struct fields
  for (const [fieldName, fieldInfo] of struct.fields) {
    result.push({
      name: fieldName,
      fullName: `${cName}.${fieldName}`,
      kind: "field",
      type: TypeResolver.getTypeName(fieldInfo.type),
      parent: cName,
      id: `${structId}.${fieldName}`,
      parentId: structId,
      line: struct.sourceLine,
    });
  }

  return result;
}

function convertFunction(
  func: import("../transpiler/types/symbols/IFunctionSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = SymbolNameUtils.getTranspiledCName(func);
  const parent = func.scope.name || undefined;
  const returnType = TypeResolver.getTypeName(func.returnType);

  // Build signature
  const paramTypes = func.parameters.map((p) =>
    TypeResolver.getTypeName(p.type),
  );
  const signature = `${returnType} ${cName}(${paramTypes.join(", ")})`;

  result.push({
    name: func.name,
    fullName: cName,
    kind: "function",
    type: returnType,
    parent,
    id: getDotPathId(func),
    parentId: getParentId(func.scope),
    signature,
    accessModifier: func.isExported ? "public" : "private",
    line: func.sourceLine,
  });

  return result;
}

function convertVariable(
  variable: import("../transpiler/types/symbols/IVariableSymbol").default,
): ISymbolInfo {
  const cName = SymbolNameUtils.getTranspiledCName(variable);
  const parent = variable.scope.name || undefined;
  const typeStr = TypeResolver.getTypeName(variable.type);

  return {
    name: variable.name,
    fullName: cName,
    kind: "variable",
    type: typeStr,
    parent,
    id: getDotPathId(variable),
    parentId: getParentId(variable.scope),
    line: variable.sourceLine,
  };
}

function convertRegister(
  register: import("../transpiler/types/symbols/IRegisterSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = SymbolNameUtils.getTranspiledCName(register);
  const parent = register.scope.name || undefined;
  const registerId = getDotPathId(register);
  const registerParentId = getParentId(register.scope);

  result.push({
    name: register.name,
    fullName: cName,
    kind: "register",
    parent,
    id: registerId,
    parentId: registerParentId,
    line: register.sourceLine,
  });

  // Add register members
  for (const [memberName, memberInfo] of register.members) {
    result.push({
      name: memberName,
      fullName: `${cName}.${memberName}`,
      kind: "registerMember",
      parent: cName,
      id: `${registerId}.${memberName}`,
      parentId: registerId,
      accessModifier: memberInfo.access,
      line: register.sourceLine,
    });
  }

  return result;
}

function convertScope(
  scope: import("../transpiler/types/symbols/IScopeSymbol").default,
): ISymbolInfo {
  const scopeId = buildScopePath(scope);
  const scopeParentId =
    scope.parent && scope.parent.name !== ""
      ? buildScopePath(scope.parent)
      : undefined;

  return {
    name: scope.name,
    fullName: scope.name,
    kind: "namespace",
    id: scopeId,
    parentId: scopeParentId,
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
