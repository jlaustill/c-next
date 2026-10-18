import type IParameterPassing from "../../../../types/IParameterPassing";
import type IHeaderSymbol from "../types/IHeaderSymbol";

/** #1639: the 2.2 passing decision `HeaderEmissionCapture` stamps, for tests */
class HeaderPassing {
  static of(
    byValue = false,
    typedefPointer = false,
    typedefConst = false,
  ): IParameterPassing {
    return {
      byValue,
      typedefPointer,
      typedefConst,
      argument: byValue ? "value" : "reference",
    };
  }

  /** `symbols`, with the named parameters of each function passed by value */
  static byValue(
    symbols: IHeaderSymbol[],
    byValueParams: ReadonlyMap<string, ReadonlySet<string>> | undefined,
  ): IHeaderSymbol[] {
    return symbols.map((sym) => ({
      ...sym,
      parameters: sym.parameters?.map((p) =>
        byValueParams?.get(sym.name)?.has(p.name)
          ? { ...p, passing: HeaderPassing.of(true) }
          : p,
      ),
    }));
  }
}

export default HeaderPassing;
