# E0504: C-Next Alternative Include Check

## Overview

Add a compiler error (E0504) when the transpiler encounters `#include <file.h>` or `#include "file.h"` and a `file.cnx` exists at the same location. This helps developers migrating existing codebases to C-Next by catching includes that should be updated to use the C-Next version.

## Motivation

During codebase migration to C-Next:

1. Developers may forget to update includes after converting a file to `.cnx`
2. Using the old `.h` include means missing out on C-Next features
3. Same-named files could cause accidental overwrites during transpilation

This check provides immediate feedback during the migration process.

## Specification

### Error Details

- **Error Code:** E0504
- **Severity:** Hard error (stops transpilation)
- **Applies to:** Both quoted (`"..."`) and angle bracket (`<...>`) includes

### Error Message Format

```
E0504: Found #include "utils.h" but 'utils.cnx' exists at the same location.
       Use #include "utils.cnx" instead to use the C-Next version. Line N
```

### Path Resolution

**For quoted includes** (`#include "file.h"`):

1. Extract the path from the include directive
2. Resolve relative to the source file's directory
3. Replace `.h`/`.hpp` extension with `.cnx`
4. Check if that exact file exists

**For angle bracket includes** (`#include <file.h>`):

1. Extract the path from the include directive
2. Search through discovered include paths (using `IncludeDiscovery.resolveInclude()`)
3. If the `.h` file resolves, check if a `.cnx` file exists at the same resolved location

### Extensions Checked

- `.h` → look for `.cnx`
- `.hpp` → look for `.cnx`

### Skip Conditions

- If the include is already `.cnx`, skip this check
- If the `.h`/`.hpp` file doesn't resolve, skip (let existing error handling deal with it)

## Implementation

### Files to Modify

**`src/codegen/TypeValidator.ts`**

- Add new method: `validateIncludeNoCnxAlternative(includeText: string, lineNumber: number, sourcePath: string): void`
- Pattern follows existing `validateIncludeNotImplementationFile()` method

**`src/codegen/CodeGenerator.ts`**

- Call `validateIncludeNoCnxAlternative()` after `validateIncludeNotImplementationFile()` (around line 1450)
- Pass source file path for relative path resolution

### Integration Flow

```
#include directive parsed
        ↓
validateIncludeNotImplementationFile()  ← existing check (E0503)
        ↓
validateIncludeNoCnxAlternative()       ← NEW check (E0504)
        ↓
transformIncludeDirective()             ← existing transformation
```

## Testing

### Test Files to Create

1. **`tests/include/cnx-alternative-error-quoted.test.cnx`**
   - Contains `#include "helper.h"` where `helper.cnx` exists alongside
   - Expected: E0504 error

2. **`tests/include/cnx-alternative-error-angle.test.cnx`**
   - Contains `#include <helper.h>` where `helper.cnx` exists in include path
   - Expected: E0504 error

3. **`tests/include/cnx-alternative-no-error.test.cnx`**
   - Contains `#include "other.h"` where NO `other.cnx` exists
   - Expected: No error (passes through normally)

### Test Fixtures

- `tests/include/helper.cnx` — Minimal C-Next file to trigger the check
- `tests/include/helper.h` — Corresponding header file

## Design Decisions

| Decision              | Rationale                                                                |
| --------------------- | ------------------------------------------------------------------------ |
| Exact path match only | Avoids false positives from similarly-named files in different locations |
| Hard error            | During migration, these should not be ignored                            |
| Both include styles   | Libraries will ship with both `.h` and `.cnx` as C-Next adoption grows   |
| Grouped with E0503    | Keeps include validation errors together                                 |
