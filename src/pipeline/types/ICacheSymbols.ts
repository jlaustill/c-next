/**
 * Root structure for cached symbols stored in .cnx/cache/symbols.json
 */

import ICachedFileEntry from "./ICachedFileEntry";

interface ICacheSymbols {
  /** All cached file entries */
  entries: ICachedFileEntry[];
}

export default ICacheSymbols;
