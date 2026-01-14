/**
 * Options for file discovery
 */
interface IDiscoveryOptions {
  /** File extensions to include (default: all supported) */
  extensions?: string[];

  /** Whether to recurse into subdirectories */
  recursive?: boolean;

  /** Patterns to exclude */
  excludePatterns?: RegExp[];
}

export default IDiscoveryOptions;
