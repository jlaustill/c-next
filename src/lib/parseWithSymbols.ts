/**
 * Parse C-Next source and extract symbols for IDE features
 * ADR-055 Phase 7: Direct TSymbol → ISymbolInfo conversion (no ISymbol intermediate)
 */

import CNextSourceParser from "../transpiler/logic/parser/CNextSourceParser";
import CNextResolver from "../transpiler/logic/symbols/cnext/index";
import DeferredTypes from "../transpiler/logic/symbols/DeferredTypes";
import ScopeUtils from "../utils/ScopeUtils";
import TypeResolver from "../utils/TypeResolver";
import ISymbolInfo from "./types/ISymbolInfo";
import IParseWithSymbolsResult from "./types/IParseWithSymbolsResult";
import TSymbol from "../transpiler/types/symbols/TSymbol";
import SymbolPathUtils from "./utils/SymbolPathUtils";

// Re-export helpers for use in this module
const getParentId = SymbolPathUtils.getParentId;

/**
 * ADR-055 Phase 7: Convert TSymbol directly to ISymbolInfo array.
 * Expands compound symbols (bitmaps, enums, structs, registers) into multiple ISymbolInfo entries.
 */
function convertTSymbolsToISymbolInfo(
  symbols: readonly TSymbol[],
): ISymbolInfo[] {
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
  const cName = ScopeUtils.getTranspiledCName(bitmap);
  const parent = ScopeUtils.leafOf(bitmap.scopePath) || undefined;
  const bitmapId = bitmap.cnxScopedName;
  const bitmapParentId = getParentId(bitmap.scopePath);

  result.push({
    name: bitmap.name,
    fullName: cName,
    kind: "bitmap",
    type: bitmap.backingType,
    parent,
    id: bitmapId,
    parentId: bitmapParentId,
    line: bitmap.span.line,
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
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      line: fieldInfo.span.line,
      size: fieldInfo.width,
    });
  }

  return result;
}

function convertEnum(
  enumSym: import("../transpiler/types/symbols/IEnumSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(enumSym);
  const parent = ScopeUtils.leafOf(enumSym.scopePath) || undefined;
  const enumId = enumSym.cnxScopedName;
  const enumParentId = getParentId(enumSym.scopePath);

  result.push({
    name: enumSym.name,
    fullName: cName,
    kind: "enum",
    parent,
    id: enumId,
    parentId: enumParentId,
    line: enumSym.span.line,
  });

  // Add enum members
  for (const [memberName, member] of enumSym.members) {
    result.push({
      name: memberName,
      // #1318/#1285: read from the symbol that carries it. This rebuilt the
      // qualified name by hand and reported `enumSym`'s line for EVERY member,
      // so an IDE jumping to `EColor.BLUE` landed on `enum EColor`.
      fullName: member.fullyQualifiedCName,
      kind: "enumMember",
      parent: cName,
      id: `${enumId}.${memberName}`,
      parentId: enumId,
      line: member.span.line,
    });
  }

  return result;
}

function convertStruct(
  struct: import("../transpiler/types/symbols/IStructSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(struct);
  const parent = ScopeUtils.leafOf(struct.scopePath) || undefined;
  const structId = struct.cnxScopedName;
  const structParentId = getParentId(struct.scopePath);

  result.push({
    name: struct.name,
    fullName: cName,
    kind: "struct",
    parent,
    id: structId,
    parentId: structParentId,
    line: struct.span.line,
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
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      line: fieldInfo.span.line,
    });
  }

  return result;
}

function convertFunction(
  func: import("../transpiler/types/symbols/IFunctionSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(func);
  const parent = ScopeUtils.leafOf(func.scopePath) || undefined;
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
    id: func.cnxScopedName,
    parentId: getParentId(func.scopePath),
    signature,
    accessModifier: func.visibility,
    line: func.span.line,
  });

  return result;
}

function convertVariable(
  variable: import("../transpiler/types/symbols/IVariableSymbol").default,
): ISymbolInfo {
  const cName = ScopeUtils.getTranspiledCName(variable);
  const parent = ScopeUtils.leafOf(variable.scopePath) || undefined;
  const typeStr = TypeResolver.getTypeName(variable.type);

  return {
    name: variable.name,
    fullName: cName,
    kind: "variable",
    type: typeStr,
    parent,
    id: variable.cnxScopedName,
    parentId: getParentId(variable.scopePath),
    line: variable.span.line,
  };
}

function convertRegister(
  register: import("../transpiler/types/symbols/IRegisterSymbol").default,
): ISymbolInfo[] {
  const result: ISymbolInfo[] = [];
  const cName = ScopeUtils.getTranspiledCName(register);
  const parent = ScopeUtils.leafOf(register.scopePath) || undefined;
  const registerId = register.cnxScopedName;
  const registerParentId = getParentId(register.scopePath);

  result.push({
    name: register.name,
    fullName: cName,
    kind: "register",
    parent,
    id: registerId,
    parentId: registerParentId,
    line: register.span.line,
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
      // #1318: the MEMBER's line, not its parent's. Members carry their own
      // span now, so reporting the parent's was the consumer ignoring data
      // it already had -- the same defect fixed for enum members above.
      accessModifier: memberInfo.access,
      line: memberInfo.span.line,
    });
  }

  return result;
}

function convertScope(
  scope: import("../transpiler/types/symbols/IScopeSymbol").default,
): ISymbolInfo {
  const scopeId = ScopeUtils.pathOf(scope);
  const scopeParentId = getParentId(scope.scopePath);

  return {
    name: scope.name,
    fullName: scope.name,
    kind: "namespace",
    id: scopeId,
    parentId: scopeParentId,
    line: scope.span.line,
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
  //
  // #1472: both passes, because this API has the same obligation the pipeline
  // does. 1.3 Declare defers a bare type name it cannot settle, and reading one
  // of those as a type name throws -- so a caller that ran Declare alone would
  // get an internal error on any scope that names a type bare. This entry point
  // takes a single source with no include context, so the program IS this file
  // and its own declared scope types are the whole-program set.
  const declared = CNextResolver.resolve(tree, "<source>");
  const tSymbols = DeferredTypes.settle(declared.symbols, (qualifiedName) =>
    declared.declaredScopeTypes.has(qualifiedName),
  );
  const symbols = convertTSymbolsToISymbolInfo(tSymbols);

  return {
    success: errors.length === 0,
    errors,
    symbols,
  };
}

export default parseWithSymbols;
