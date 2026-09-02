/**
 * Options for header file generation
 */
interface IHeaderOptions {
  /** Include system headers in the output */
  includeSystemHeaders?: boolean;

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

  /**
   * Issue #409: C++ mode - use references instead of pointers for parameters.
   * This allows C-Next callbacks to match C++ function pointer signatures.
   */
  cppMode?: boolean;

  /**
   * Issue #1164: the source's own C/C++ headers were propagated into this
   * header because it names something only they define.
   *
   * When they are present an external type's real declaration is already in
   * scope, and the usual `typedef struct X X;` forward declaration becomes a
   * competing -- and for a pointer typedef, contradictory -- declaration of the
   * same name. Guessing is only justified when nothing better is available.
   */
  readonly cHeadersIncluded?: boolean;

  /**
   * ADR-040: this translation unit uses the `ISR` function-pointer type.
   *
   * The header used to decide this for itself by scanning exported
   * declarations, which is a strict subset of "the file needs ISR" -- an `ISR`
   * local inside a function body is invisible to it. Since the .c stops
   * emitting the typedef once it includes the header, that subset made the
   * suppression unsound: the type was emitted nowhere. Both sides now read the
   * same flag.
   */
  readonly needsIsrTypedef?: boolean;

  /**
   * Issue #1205: structs whose ADR-029 init function the `.c` emitted, so the
   * header can declare each one (MISRA C:2012 Rule 8.4).
   *
   * Passed in rather than derived here for the same reason as the flag above:
   * the header's own view of struct fields is a superset -- it includes
   * scope-nested structs, which get no init function (#1283) -- so deciding
   * locally would declare functions that are never defined.
   */
  readonly generatedStructInits?: ReadonlySet<string>;
}

export default IHeaderOptions;
