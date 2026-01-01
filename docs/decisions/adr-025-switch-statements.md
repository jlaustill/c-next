# ADR-025: Switch Statements

## Status
**Implemented**

## Context

Switch statements are fundamental to embedded programming:
- State machines
- Command dispatching
- Protocol parsing
- Interrupt handlers

C's switch has footguns (fall-through, missing breaks), but the pattern is essential.

## Decision Drivers

1. **State Machines** - Core embedded pattern
2. **Safety** - Prevent accidental fall-through
3. **Exhaustiveness** - Catch missing cases with enums
4. **C Compatibility** - Generate valid C switch
5. **Clarity** - Each case should be self-contained and self-documenting

## Options Considered

### Option A: C-Style with Required Break
```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
        break;
    }
    case State.RUNNING: {
        checkSensors();
        break;
    }
    default: {
        handleError();
        break;
    }
}
```

**Pros:** Familiar
**Cons:** Still needs break, easy to forget

### Option B: Implicit Break, Explicit Fallthrough
```cnx
switch (state) {
    case State.IDLE: {
        startMotor();
    }  // Implicit break
    case State.RUNNING: {
        checkSensors();
    }
    case State.STOPPING:
    fallthrough;  // Explicit fall-through
    case State.STOPPED: {
        cleanup();
    }
}
```

**Pros:** Safe by default, explicit intent
**Cons:** Different from C, still allows fallthrough complexity

### Option C: Match Expression (Rust-style)
```cnx
u32 result <- match (cmd) {
    Command.READ: 1,
    Command.WRITE: 2,
    Command.ERASE: 3,
};
```

**Pros:** Expression, exhaustive
**Cons:** Very different from C, complex

### Option D: Braces Replace Break, No Fallthrough (Selected)
```cnx
switch (state) {
    case State.IDLE {
        startMotor();
    }
    case State.RUNNING {
        checkSensors();
    }
    default {
        handleError();
    }
}
```

**Pros:** Safe by default, clean syntax, no colons needed, each case fully self-contained
**Cons:** Different from C (but safer)

## Decision

**Option D: Braces Replace Break, No Fallthrough**

Key design choices:
1. **Required braces** - Replace `break;` with mandatory `{}` blocks
2. **No colons** - Braces make colons redundant: `case X {` not `case X: {`
3. **No fallthrough** - Not supported; be explicit about each case's behavior
4. **Counted default for enums** - `default(n)` where n = variants covered by default
5. **Multiple cases with `||`** - Use `case A || B { }` syntax
6. **Constant expressions only** - No `case x + 1:` for v1
7. **Integral types only** - Standard C switch type restrictions for v1
8. **Minimum 2 clauses** - Single-case switches should use `if` instead
9. **Default must be last** - Improves readability and consistency
10. **No boolean switches** - Use `if/else` for boolean expressions

## Syntax

### Basic Switch (Non-Enum)
```cnx
// For integral types, use plain default (no count)
switch (command) {
    case 0 {
        handleReset();
    }
    case 1 {
        handleStart();
    }
    default {
        handleUnknown();
    }
}
```

### Multiple Cases (OR Syntax)
```cnx
switch (cmd) {
    case Command.READ || Command.PEEK {
        // Handle both read operations
        readData();
    }
    case Command.WRITE {
        writeData();
    }
    default(2) {
        // Covers remaining 2 variants
        handleOther();
    }
}
```

### Exhaustive Enum Matching (No Default)
```cnx
enum EState { IDLE, RUNNING, STOPPED, ERROR }  // 4 variants

switch (state) {
    case EState.IDLE {
        startMotor();
    }
    case EState.RUNNING {
        checkSensors();
    }
    case EState.STOPPED {
        // Intentionally empty - no action needed
    }
    case EState.ERROR {
        handleError();
    }
    // No default - all 4 cases covered explicitly
    // Compiler error if a case is missing
}
```

### Counted Default for Large Enums
```cnx
// HttpStatus has 50 variants, we only care about 5
switch (status) {
    case HttpStatus.OK {
        handleSuccess();
    }
    case HttpStatus.CREATED {
        handleCreated();
    }
    case HttpStatus.BAD_REQUEST {
        handleBadRequest();
    }
    case HttpStatus.UNAUTHORIZED {
        handleAuthError();
    }
    case HttpStatus.NOT_FOUND {
        handle404();
    }
    default(45) {
        // 5 explicit cases + 45 = 50 total ✓
        handleOther();
    }
}
```

**If a new variant is added to HttpStatus (now 51 variants):**
```
error: switch covers 50 of 51 HttpStatus variants (5 explicit + default(45)), missing 1
  --> src/handler.cnx:42:5
   |
42 |     default(45) {
   |     ^^^^^^^^^^^ update to default(46) or add explicit case
```

### Defensive Exhaustive Matching with default(0)
```cnx
enum EState { IDLE, RUNNING, STOPPED }  // 3 variants

switch (state) {
    case EState.IDLE {
        startMotor();
    }
    case EState.RUNNING {
        checkSensors();
    }
    case EState.STOPPED {
        cleanup();
    }
    default(0) {
        // Self-documenting: all cases handled explicitly
        // This block is defensive - should never execute
        logError("Invalid state reached");
    }
}
```

### Why No Fallthrough? Be Explicit
Instead of fallthrough for cumulative behavior:
```cnx
// C-Next: Explicit and clear
switch (level) {
    case 3 {
        initLevel3();
        initLevel2();
        initLevel1();
    }
    case 2 {
        initLevel2();
        initLevel1();
    }
    case 1 {
        initLevel1();
    }
}
```

Each case is self-contained. A reader knows exactly what happens without tracing fallthrough paths.

### Generated C
```c
// From counted default example
switch (status) {
    case HttpStatus_OK: {
        handleSuccess();
        break;
    }
    case HttpStatus_CREATED: {
        handleCreated();
        break;
    }
    case HttpStatus_BAD_REQUEST: {
        handleBadRequest();
        break;
    }
    case HttpStatus_UNAUTHORIZED: {
        handleAuthError();
        break;
    }
    case HttpStatus_NOT_FOUND: {
        handle404();
        break;
    }
    default: {
        handleOther();
        break;
    }
}
```

## Implementation Notes

### Grammar Changes
```antlr
switchStatement
    : 'switch' '(' expression ')' '{' switchCase+ defaultCase? '}'
    ;

switchCase
    : 'case' caseExpression block
    ;

caseExpression
    : expression ('||' expression)*
    ;

defaultCase
    : 'default' ('(' INTEGER_LITERAL ')')? block
    ;
```

### Semantic Analysis

**Type Checking:**
- Verify switch expression is integral type (not boolean - error)
- Verify all case labels are constant expressions
- Verify case label types match switch expression type

**Structural Validation:**
- Minimum 2 clauses required (error if only 1)
- `default` must be last if present (error if not)
- Detect duplicate case values (including across `||` expressions)

**Exhaustiveness Checking (Enums Only):**
- Count explicit cases (each `||` alternative counts as 1)
- If `default(n)` present: verify `explicit_cases + n == enum_variant_count`
- If no `default`: verify `explicit_cases == enum_variant_count`
- `default(0)` is valid (defensive programming pattern)
- Error message format: `switch covers X of Y EnumName variants (N explicit + default(M)), missing Z`

**Non-Enum Switches:**
- `default` required (no count parameter)
- `default(n)` syntax is an error for non-enum types

### CodeGenerator
- Add `break;` after each case block
- Expand `case A || B { }` to separate case labels in C
- Generate proper enum value names (e.g., `EState_IDLE`)
- `default(n)` generates plain `default:` in C (count is compile-time only)

### Priority
**Critical** - Essential for embedded state machines.

## Resolved Questions

1. ✅ Require exhaustive matching for enums? **Yes** - via explicit cases OR `default(n)` count
2. ✅ Allow expressions in case labels? **No** - constants only for v1
3. ✅ Require braces around case bodies? **Yes** - braces replace break
4. ✅ Support fallthrough? **No** - be explicit about each case's behavior
5. ✅ Need colons after case? **No** - braces make them redundant
6. ✅ Multiple case syntax? **`case A || B { }`** - OR operator style
7. ✅ Large enum handling? **`default(n)`** - counted default with compile-time validation
8. ✅ Default position? **Must be last** - MISRA 16.5 compliance
9. ✅ Minimum clauses? **2 required** - MISRA 16.6 compliance
10. ✅ Boolean switches? **Error** - MISRA 16.7 compliance, use `if/else`
11. ✅ `default(0)` allowed? **Yes** - self-documenting defensive programming

## MISRA C:2012/2023 Compliance

| MISRA Rule | Requirement | C-Next Approach | Status |
|------------|-------------|-----------------|--------|
| **16.1** | Well-formed switch | Grammar enforces structure | ✅ **Enforced** |
| **16.2** | Labels in correct scope | Grammar prevents nesting | ✅ **Enforced** |
| **16.3** | Unconditional break | Implicit break, no fallthrough | ✅ **Exceeds** |
| **16.4** | Default required | Required for non-enums; `default(n)` or exhaustive for enums | ✅ **Exceeds** |
| **16.5** | Default first or last | Default must be last (error) | ✅ **Enforced** |
| **16.6** | Minimum 2 clauses | Compiler error if < 2 | ✅ **Enforced** |
| **16.7** | No boolean switch | Compiler error | ✅ **Enforced** |

### C-Next Innovation: Counted Default

C-Next's `default(n)` syntax goes beyond MISRA by providing **compile-time validation** that all enum variants are accounted for, even when using a default clause. This catches enum growth at build time rather than runtime.

**Comparison:**
- **C + MISRA:** `default` required but no validation of completeness
- **Rust:** `_` wildcard is silent when enum grows
- **C-Next:** `default(n)` forces explicit acknowledgment; enum growth breaks build

## References

- [MISRA-C Rule 16 Switch statements](https://hackmd.io/@IloveFSF/Hk9S6LNjK)
- [MISRA C:2023 Rule 16.1 - MathWorks](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule16.1.html)
- [Rust match - Wildcard Pattern](https://www.slingacademy.com/article/avoiding-match-exhaustiveness-errors-with-the-wildcard-pattern/)
- [Rust #[non_exhaustive] RFC](https://rust-lang.github.io/rfcs/2008-non-exhaustive.html)
- [SPARK for MISRA C Developer - AdaCore](https://learn.adacore.com/courses/SPARK_for_the_MISRA_C_Developer/chapters/03_syntactic_guarantees.html)
- C switch statement
- Swift switch (no fallthrough by default)
