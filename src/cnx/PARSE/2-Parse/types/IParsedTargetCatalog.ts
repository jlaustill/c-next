import type ITargetCatalogSource from "../../../types/ITargetCatalogSource";

/** The target catalog 1.1 read, parsed by 1.2 for 1.4 to describe (#1991) */
interface IParsedTargetCatalog {
  readonly path: string;
  readonly source: ITargetCatalogSource;
}

export default IParsedTargetCatalog;
