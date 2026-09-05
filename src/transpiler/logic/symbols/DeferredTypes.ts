/**
 * 1.4 Resolve: settle the type names 1.3 Declare could not.
 *
 * Declare owns per-file facts, so for a bare `T` written inside a scope it can
 * only answer when this file declares the scope type. Otherwise the name is
 * either a global type or a scope type from an included file, and telling those
 * apart needs the set of scope types the whole PROGRAM declares -- a cross-file
 * fact, which is 1.4's to own.
 *
 * Declare records those sites as `TDeferredType`, carrying the identifier as
 * WRITTEN and the scope it was written in. That pair is the input ADR-057
 * needs, and recording it is what keeps the decision at the parse tree:
 * qualifying a resolved name later cannot work, because by then `global.Mode`
 * and a bare `Mode` are the same string.
 *
 * This is a REBUILD, not a mutation. Every type-bearing field on a symbol is
 * `readonly`, and the ones that are not -- `IScopeSymbol`'s member arrays --
 * are not type-bearing, so nothing here needs to reach them.
 */

import type TSymbol from "../../types/symbols/TSymbol";
import type TType from "../../types/TType";
import type IParameterInfo from "../../types/symbols/IParameterInfo";
import type IStructFieldSymbol from "../../types/symbols/IStructFieldSymbol";
import ScopeUtils from "../../../utils/ScopeUtils";
import TypeResolver from "../../../utils/TypeResolver";

class DeferredTypes {
  /**
   * Settle every deferred type in `symbols` against the program-wide answer.
   *
   * @param symbols one file's declared symbols, as Declare emitted them
   * @param isScopeType whether a QUALIFIED name is a scope type anywhere in the
   *   program. This is the whole-program set; passing a per-file one would
   *   reintroduce exactly the cross-file parameter Declare no longer takes.
   */
  static settle(
    symbols: ReadonlyArray<TSymbol>,
    isScopeType: (qualifiedName: string) => boolean,
  ): TSymbol[] {
    return symbols.map((symbol) =>
      DeferredTypes.settleSymbol(symbol, isScopeType),
    );
  }

  /**
   * Does any symbol here still carry a deferred type?
   *
   * The settlement's own negative control. `getTypeName` throws on a deferred
   * type, so an unsettled one would surface as an internal error somewhere in
   * codegen with no indication of which pass dropped it; asking here names the
   * pass instead.
   */
  static hasUnsettled(symbols: ReadonlyArray<TSymbol>): boolean {
    return symbols.some((symbol) =>
      DeferredTypes.typesOf(symbol).some(DeferredTypes.containsDeferred),
    );
  }

  private static settleSymbol(
    symbol: TSymbol,
    isScopeType: (qualifiedName: string) => boolean,
  ): TSymbol {
    const settle = (type: TType): TType =>
      DeferredTypes.settleType(type, isScopeType);

    // Identity is preserved wherever nothing was deferred, which is the common
    // case by a wide margin: only a bare name inside a scope can defer, so most
    // symbols have nothing to settle. Rebuilding them regardless would allocate
    // a copy of the whole symbol table on every run and quietly break any
    // consumer comparing by reference.
    if (symbol.kind === "variable") {
      const type = settle(symbol.type);
      return type === symbol.type ? symbol : { ...symbol, type };
    }

    if (symbol.kind === "function") {
      const returnType = settle(symbol.returnType);
      let parametersChanged = false;
      const parameters = symbol.parameters.map((parameter): IParameterInfo => {
        const type = settle(parameter.type);
        if (type === parameter.type) return parameter;
        parametersChanged = true;
        return { ...parameter, type };
      });
      if (returnType === symbol.returnType && !parametersChanged) {
        return symbol;
      }
      return { ...symbol, returnType, parameters };
    }

    if (symbol.kind === "struct") {
      let fieldsChanged = false;
      const fields = new Map<string, IStructFieldSymbol>();
      for (const [name, field] of symbol.fields) {
        const type = settle(field.type);
        if (type === field.type) {
          fields.set(name, field);
          continue;
        }
        fieldsChanged = true;
        fields.set(name, { ...field, type });
      }
      return fieldsChanged ? { ...symbol, fields } : symbol;
    }

    // enum, bitmap, register and scope carry no TType: an enum member holds a
    // value, a bitmap's backing type is a constant, and a register member's C
    // type is a plain string resolved at declaration. Returned unchanged rather
    // than rebuilt, so identity is preserved for everything with nothing to do.
    return symbol;
  }

  /**
   * Settle one type, recursing into an array's element.
   *
   * ADR-057 is applied here exactly as Declare would have applied it, from the
   * WRITTEN identifier and the scope it appeared in -- never from the resolved
   * name, which no longer distinguishes a bare reference from a `global.` one.
   */
  private static settleType(
    type: TType,
    isScopeType: (qualifiedName: string) => boolean,
  ): TType {
    if (type.kind === "deferred") {
      const name = ScopeUtils.qualifyScopeType(
        type.name,
        type.scopePath,
        isScopeType,
      );
      // Re-classified from the settled name, because which ARM a name belongs
      // to -- struct, enum, bitmap -- is decided by the name, and Declare could
      // not decide it while the name was still unknown.
      return DeferredTypes.classify(name);
    }

    if (type.kind === "array") {
      const elementType = DeferredTypes.settleType(
        type.elementType,
        isScopeType,
      );
      return elementType === type.elementType ? type : { ...type, elementType };
    }

    return type;
  }

  /** Every TType reachable from a symbol, for `hasUnsettled`. */
  private static typesOf(symbol: TSymbol): TType[] {
    if (symbol.kind === "variable") return [symbol.type];
    if (symbol.kind === "function") {
      return [symbol.returnType, ...symbol.parameters.map((p) => p.type)];
    }
    if (symbol.kind === "struct") {
      return [...symbol.fields.values()].map((field) => field.type);
    }
    return [];
  }

  private static containsDeferred(type: TType): boolean {
    if (type.kind === "deferred") return true;
    if (type.kind === "array") {
      return DeferredTypes.containsDeferred(type.elementType);
    }
    return false;
  }

  /**
   * Turn a settled name back into a `TType` arm.
   *
   * Delegated to the classifier Declare uses for every other name rather than
   * re-derived here: which arm a name belongs to is one decision, and a second
   * copy of that heuristic would drift from it without anything noticing.
   */
  private static classify(name: string): TType {
    return TypeResolver.resolve(name);
  }
}

export default DeferredTypes;
