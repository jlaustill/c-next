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
}

export default ICacheConfig;
