/**
 * Cache configuration stored in .cnx/config.json
 */
interface ICacheConfig {
  /** Cache format version - increment when serialization format changes */
  version: number;
  /** Timestamp when cache was created (ms since epoch) */
  created: number;
  /** Transpiler version for compatibility checking */
  transpilerVersion: string;
  /**
   * Issue #1225: fingerprint of the struct-state shape, derived from
   * `SymbolTable.structStateKeys()`. Stored so a build whose
   * `IStructSymbolState` differs discards entries describing the old shape,
   * without anyone remembering to bump `CACHE_VERSION`.
   */
  structStateShape?: string;
}

export default ICacheConfig;
