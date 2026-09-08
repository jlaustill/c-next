/**
 * What one `#include` directive names, and in which of the two forms.
 *
 * The form is not decoration: ADR-010 resolves a QUOTED include relative to the
 * including file and an ANGLE include along the run's search path, so a rule
 * that has the path but not the form can only guess where to look.
 */
interface IIncludeSpec {
  /** The spelling between the delimiters, e.g. `sensors/imu.h`. */
  readonly path: string;
  /** True for `#include "…"`, false for `#include <…>`. */
  readonly isQuoted: boolean;
}

export default IIncludeSpec;
