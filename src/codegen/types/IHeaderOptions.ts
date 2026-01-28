/**
 * Options for header file generation
 */
interface IHeaderOptions {
  /** Guard prefix (default: derived from filename) */
  guardPrefix?: string;

  /** Include system headers in the output */
  includeSystemHeaders?: boolean;

  /** Only generate declarations for exported symbols */
  exportedOnly?: boolean;

  /**
   * Issue #424: User-provided includes from the source file.
   * These will be added to the generated header if any extern declarations
   * use macros (non-numeric array dimensions) from these headers.
   * Example: ['#include "config.h"', '#include "sizes.h"']
   */
  userIncludes?: string[];

  /**
   * Issue #497: Map of external type names to their C header include directives.
   * When a type from a C header is used in public interfaces, the header should
   * be included rather than generating a conflicting forward declaration.
   * Example: Map { "Data" => '#include "data-types.h"' }
   */
  externalTypeHeaders?: ReadonlyMap<string, string>;
}

export default IHeaderOptions;
