# ADR-013: Const Qualifier for Immutable Values

**Status:** Implemented
**Date:** 2025-12-28
**Decision Makers:** C-Next Language Design Team

## Context

C-Next's mission is to provide "a safer C for embedded systems." The `const` qualifier is fundamental to this mission—it allows developers to explicitly declare that a value should not be modified after initialization.

### The Current Situation

C-Next's grammar already supports `const` syntax:

```antlr
// grammar/CNext.g4 lines 152-158, 167-169
parameter: constModifier? type IDENTIFIER arrayDimension?;
constModifier: 'const';
variableDeclaration: constModifier? type IDENTIFIER arrayDimension? ('<-' expression)? ';';
```

The code generator extracts and emits `const` to generated C code:

```typescript
// src/codegen/CodeGenerator.ts line 784, 811
const constMod = ctx.constModifier() ? "const " : "";
```

**However, there is no semantic enforcement.** This code compiles without error:

```cnx
const u32 CONFIG <- 100;
CONFIG <- 200;  // Should ERROR: cannot assign to const variable

void process(const i32 value) {
    value <- value + 1;  // Should ERROR: cannot assign to const parameter
}
```

### Why This Matters for Embedded Systems

1. **Memory Safety Statistics**: In a [2019 Microsoft study](https://msrc-blog.microsoft.com/2019/07/16/a-proactive-approach-to-more-secure-code/), 70% of all security vulnerabilities were memory safety issues. [Google reported](https://www.chromium.org/Home/chromium-security/memory-safety/) that 70% of severe security bugs in Chromium were memory safety problems. While `const` doesn't prevent all memory issues, it prevents accidental mutation of read-only data—a common source of subtle, hard-to-diagnose bugs.

2. **Federal Government Concern**: In February 2024, [CISA and the White House](https://www.cisa.gov/news-events/news/urgent-need-memory-safety-software-products) urged developers to move away from memory-unsafe languages like C/C++. C-Next aims to be a safer alternative that generates MISRA-compliant C.

3. **ADR-006 Interaction**: C-Next uses pass-by-reference for all parameters. Without `const` enforcement, every function can modify every argument—a dangerous default. ADR-006's Open Question Q1 explicitly asks: "Should there be a `const` keyword for read-only parameters?"

4. **MISRA C Alignment**: [MISRA C:2023 Rule 8.13](https://www.perforce.com/resources/qac/misra-c-cpp) states that "A pointer should point to a const-qualified type whenever possible." C-Next can enforce this automatically.

---

## Research: How Other Languages Handle Immutability

### C: const Qualifier

C introduced `const` in C89:

```c
const int CONFIG = 100;
CONFIG = 200;  // ERROR: assignment of read-only variable

void process(const int* value) {
    *value = 10;  // ERROR: assignment of read-only location
}
```

**Strengths:**

- Compile-time enforcement
- Zero runtime cost
- Clear intent documentation

**Weaknesses:**

- Easy to forget `const`
- Pointer constness is confusing (`const int*` vs `int* const`)
- No default immutability

### Rust: Default Immutability

Rust takes the most aggressive approach—**all variables are immutable by default**:

```rust
let x = 5;       // Immutable by default
x = 6;           // ERROR: cannot assign twice to immutable variable

let mut y = 5;   // Explicit mutability required
y = 6;           // OK

fn process(value: &i32) {      // Immutable borrow
    // *value = 10;            // ERROR
}

fn modify(value: &mut i32) {   // Mutable borrow required
    *value = 10;               // OK
}
```

**Key insight from Rust**: The borrow checker enforces that you can have either:

- One mutable reference, OR
- Any number of immutable references

...but never both simultaneously. This eliminates data races at compile time.

**Source**: [Rust Book - References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)

**Trade-off**: Steep learning curve (lifetimes, borrow checker), but eliminates entire classes of bugs.

### Swift: let vs var

Swift separates declaration keywords:

```swift
let constant = 5   // Immutable - compiler error if assigned
var variable = 5   // Mutable

func process(value: Int) {  // Parameters are immutable by default
    value = 10  // ERROR: Cannot assign to value: 'value' is a 'let' constant
}

func modify(value: inout Int) {  // Explicit mutability required
    value = 10  // OK
}
```

**Strengths:**

- Clear distinction between mutable and immutable
- Parameters immutable by default (safe default)
- `inout` makes mutation explicit at both call site and definition

**Trade-off**: Two keywords for declaration (`let`/`var`).

**Source**: [Swift inout Parameters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#In-Out-Parameters)

### Ada/SPARK: Parameter Modes

Ada uses explicit parameter modes with strict semantics:

```ada
procedure Process(
    Input  : in     Integer;    -- Read-only
    Output : out    Integer;    -- Write-only (must initialize before return)
    Both   : in out Integer     -- Read-write
);

-- SPARK adds formal verification
procedure Safe_Process(X : in Integer)
  with Pre => X > 0,        -- Precondition
       Post => Result > X;  -- Postcondition
```

**From SPARK User's Guide**: "Parameter mode `in` indicates that the object should be completely initialized before calling the subprogram. It should not be written in the subprogram."

**Source**: [SPARK Specification Features](https://docs.adacore.com/spark2014-docs/html/ug/en/source/specification_features.html)

**Trade-off**: Very explicit and safe, but more verbose. SPARK enables formal verification of safety properties.

### Go: No const for Variables

Go deliberately omits `const` for variables:

```go
const Pi = 3.14159  // Only for compile-time constants

func process(value int) {
    value = 10  // Modifies local copy (pass-by-value)
}

func modify(value *int) {
    *value = 10  // Modifies original via pointer
}
```

**Design choice**: Go uses pass-by-value as default, making mutation explicit through pointers. There's no way to declare a variable that can't be reassigned.

### JavaScript/TypeScript: const for Bindings

Modern JavaScript uses `const` for immutable bindings:

```javascript
const x = 5;
x = 6; // TypeError: Assignment to constant variable

const obj = { a: 1 };
obj.a = 2; // OK! const only prevents reassignment of binding
obj = {}; // ERROR: Assignment to constant variable
```

**Key distinction**: `const` prevents rebinding, not deep immutability. This is different from C's `const` which prevents value modification.

### Comparison Matrix

| Language              | Default            | Immutable Syntax   | Mutable Syntax    | Enforcement         | Deep Immutability |
| --------------------- | ------------------ | ------------------ | ----------------- | ------------------- | ----------------- |
| **C**                 | Mutable            | `const T`          | `T`               | Compile-time        | Yes (value)       |
| **Rust**              | Immutable          | `let x`            | `let mut x`       | Borrow checker      | Yes (ownership)   |
| **Swift**             | Immutable (params) | `let x` / param    | `var x` / `inout` | Compile-time        | Yes               |
| **Ada/SPARK**         | Mode-based         | `in` mode          | `out`/`in out`    | Formal verification | Yes               |
| **Go**                | Mutable            | N/A (no var const) | `var x`           | N/A                 | No                |
| **JS/TS**             | Mutable            | `const x`          | `let x`           | Runtime             | No (binding only) |
| **C-Next (current)**  | Mutable            | `const T`          | `T`               | **NONE**            | N/A               |
| **C-Next (proposed)** | Mutable            | `const T`          | `T`               | Compile-time        | Yes               |

---

## Research: Bugs Caused by Missing Const Enforcement

### Configuration Corruption

Without const enforcement, hardware configuration can be accidentally modified:

```cnx
// Intent: LED_PIN should never change
const u32 LED_PIN <- 13;

void reconfigure() {
    // Bug: typo, meant LED_BIT
    LED_PIN <- 7;  // Silently corrupts configuration!
}
```

In a real embedded system, this could cause:

- Wrong GPIO being driven
- Hardware damage if pin is connected to sensitive circuitry
- Intermittent failures that only manifest under certain conditions

### Read-Only Parameter Violation

ADR-006 makes all parameters pass-by-reference. Without const, every function can modify any argument:

```cnx
void printSensorValue(i32 value) {
    Console.print(value);
    value <- 0;  // Bug: accidentally clearing the sensor reading!
}

i32 temperature <- readSensor();
printSensorValue(temperature);
// temperature is now 0, not the sensor reading
```

### Contract Violation with External Code

When interfacing with C libraries, const correctness matters:

```cnx
// C function expects const char*
extern void log_message(const char[] message);

void logError() {
    char[64] buffer <- "Error occurred";
    buffer[0] <- 'W';  // OK: buffer is mutable
    log_message(buffer);  // OK

    const char[] constMsg <- "Critical failure";
    constMsg[0] <- 'M';  // Should ERROR: constMsg is const
    log_message(constMsg);  // C expects const, we should enforce it
}
```

### MISRA C Violations in Generated Code

MISRA C:2012 Rule 8.13 (Advisory): "A pointer should point to a const-qualified type whenever possible."

Currently, C-Next emits `const` to C but doesn't enforce it. This means:

1. Generated C has correct `const` qualifiers
2. C compiler enforces them
3. But C-Next developer gets no feedback about violations

The error appears in the C compiler output, not the C-Next transpiler—confusing for developers.

---

## Decision: Compile-Time Const Enforcement

### Design Principles

1. **Familiar to C developers**: Use existing `const` keyword (already in grammar)
2. **Compile-time enforcement**: Errors, not warnings
3. **Strict MISRA alignment**: Follow Rule 8.13 spirit
4. **Works with ADR-006**: Const parameters are read-only references
5. **ro registers are const**: Read-only register members implicitly behave as const

### Syntax (Already Implemented)

No grammar changes needed. The following syntax already parses:

```cnx
// Const variable - cannot be reassigned
const u32 BUFFER_SIZE <- 256;

// Const parameter - cannot be modified inside function
void printValue(const i32 value) {
    Console.print(value);  // OK: reading
    // value <- 5;         // ERROR: cannot assign to const parameter
}

// Mutable parameter (default) - can be modified
void increment(i32 value) {
    value <- value + 1;  // OK: ADR-006 pass-by-reference
}

// Const array parameter - elements cannot be modified
void sumArray(const u8 data[], u32 size) {
    u32 sum <- 0;
    for (u32 i <- 0; i < size; i <- i + 1) {
        sum <- sum + data[i];  // OK: reading
        // data[i] <- 0;       // ERROR: cannot modify const array
    }
}
```

### Semantic Rules

1. **Const variables** cannot appear on the left side of any assignment operator (`<-`, `+<-`, `-<-`, etc.)
2. **Const parameters** cannot appear on the left side of any assignment operator
3. **Const array parameters** — neither the array nor its elements can be assigned
4. **Const applies to the value**, not the storage (like C's `const int*` vs `int* const`)
5. **Const propagates through member access** — `const Point p` means `p.x` is also const
6. **ro register members are implicitly const** — cannot assign to read-only hardware registers

### Error Messages

Clear, actionable error messages:

```
error: cannot assign to const variable 'BUFFER_SIZE'
  --> config.cnx:15:5
   |
15 |     BUFFER_SIZE <- 512;
   |     ^^^^^^^^^^^ declared as const on line 3
   |
help: remove 'const' from declaration if mutation is intended

error: cannot assign to const parameter 'value'
  --> utils.cnx:23:5
   |
23 |     value <- value + 1;
   |     ^^^^^ parameter declared const in function signature
   |
help: remove 'const' from parameter if mutation is needed

error: cannot assign to read-only register member 'PSR'
  --> gpio.cnx:45:5
   |
45 |     GPIO7.PSR <- 0xFF;
   |     ^^^^^^^^^ register member has 'ro' (read-only) access
   |
note: PSR is defined with 'ro' access modifier in register binding
```

### Register Binding Integration

Read-only register members (`ro` access modifier) are implicitly const:

```cnx
register GPIO7 @ 0x42004000 {
    DR:     u32 rw @ 0x00;  // Data register - read/write
    GDIR:   u32 rw @ 0x04;  // Direction register - read/write
    PSR:    u32 ro @ 0x08;  // Pad status register - READ ONLY
    DR_SET: u32 wo @ 0x84;  // Set register - WRITE ONLY
}

void example() {
    u32 status <- GPIO7.PSR;  // OK: reading ro register
    // GPIO7.PSR <- 0xFF;     // ERROR: cannot assign to read-only register

    GPIO7.DR_SET <- 0x01;     // OK: writing to wo register
    // u32 x <- GPIO7.DR_SET; // ERROR: cannot read write-only register (ADR-004)
}
```

This aligns software semantics with hardware reality—you physically cannot write to a read-only register.

---

## Implementation

### Phase 1: Track Const in Type System

**Add `isConst` to ParameterInfo** (`src/codegen/CodeGenerator.ts` line 49-53):

```typescript
interface ParameterInfo {
  name: string;
  isArray: boolean;
  isStruct: boolean;
  isConst: boolean; // NEW
}
```

**Add `isConst` to TypeInfo** (`src/codegen/CodeGenerator.ts` line 58-63):

```typescript
interface TypeInfo {
  baseType: string;
  bitWidth: number;
  isArray: boolean;
  arrayLength?: number;
  isConst: boolean; // NEW
}
```

**Update `setParameters()`** (`src/codegen/CodeGenerator.ts` lines 371-390):

```typescript
private setParameters(params: Parser.ParameterListContext | null): void {
    this.context.currentParameters.clear();
    if (!params) return;

    for (const param of params.parameter()) {
        const name = param.IDENTIFIER().getText();
        const isArray = param.arrayDimension() !== null;
        const isConst = param.constModifier() !== null;  // NEW
        // ... existing struct detection ...

        this.context.currentParameters.set(name, {
            name, isArray, isStruct, isConst  // NEW
        });
    }
}
```

**Update `trackVariableType()`** (`src/codegen/CodeGenerator.ts` lines 307-359):

```typescript
private trackVariableType(varDecl: Parser.VariableDeclarationContext): void {
    const name = varDecl.IDENTIFIER().getText();
    const isConst = varDecl.constModifier() !== null;  // NEW
    // ... existing type detection ...

    this.context.typeRegistry.set(name, {
        baseType, bitWidth, isArray, arrayLength, isConst  // NEW
    });
}
```

### Phase 2: Validate Assignments

**Add validation helper**:

```typescript
/**
 * Check if assigning to an identifier would violate const rules
 * Returns error message if const, null if mutable
 */
private checkConstAssignment(identifier: string): string | null {
    // Check if it's a const parameter
    const paramInfo = this.context.currentParameters.get(identifier);
    if (paramInfo?.isConst) {
        return `cannot assign to const parameter '${identifier}'`;
    }

    // Check if it's a const variable
    const typeInfo = this.context.typeRegistry.get(identifier);
    if (typeInfo?.isConst) {
        return `cannot assign to const variable '${identifier}'`;
    }

    // Check if it's a read-only register member
    // (Implementation depends on how register members are tracked)

    return null;  // Mutable, assignment OK
}
```

**Update `generateAssignment()`** (`src/codegen/CodeGenerator.ts` lines 883-981):

```typescript
private generateAssignment(ctx: Parser.AssignmentStatementContext): string {
    const targetCtx = ctx.assignmentTarget();

    // Validate const before generating
    if (targetCtx.IDENTIFIER()) {
        const id = targetCtx.IDENTIFIER()!.getText();
        const error = this.checkConstAssignment(id);
        if (error) {
            throw new Error(error);
        }
    }

    // Check array element assignments
    if (targetCtx.arrayAccess()) {
        const arrayName = targetCtx.arrayAccess()!.IDENTIFIER().getText();
        const error = this.checkConstAssignment(arrayName);
        if (error) {
            throw new Error(`${error} (array element)`);
        }
    }

    // Check member access on const structs
    if (targetCtx.memberAccess()) {
        const parts = targetCtx.memberAccess()!.IDENTIFIER();
        const rootName = parts[0].getText();
        const error = this.checkConstAssignment(rootName);
        if (error) {
            throw new Error(`${error} (member access)`);
        }
    }

    // ... existing assignment generation ...
}
```

### Phase 3: Compound Assignment Operators

Ensure all assignment forms are checked: `<-`, `+<-`, `-<-`, `*<-`, `/<-`, `%<-`, `&<-`, `|<-`, `^<-`, `<<<-`, `>><-`

The grammar defines these in `compoundAssignment` rule. All should route through the same const validation.

---

## Alternatives Considered

### Alternative 1: Default Immutability (Rust-style)

Make all parameters immutable by default, require `mut` keyword for mutable ones:

```cnx
// All parameters immutable by default
void printValue(i32 value) {
    // value <- 5;  // ERROR by default
}

// Explicit mutability
void increment(mut i32 value) {
    value <- value + 1;  // OK
}
```

**Why Rejected:**

- Breaks familiarity with C (C-Next's core principle)
- Would break all existing C-Next code
- Requires new keyword (`mut`)
- Too aggressive for embedded C developers transitioning to C-Next

**Future Consideration**: May revisit as C-Next matures and community provides feedback.

### Alternative 2: Ada-style Parameter Modes

Use `in`, `out`, `inout` keywords instead of `const`:

```cnx
void process(in i32 read, out i32 write, inout i32 both) {
    // read is const
    // write must be assigned before return
    // both can be read and written
}
```

**Why Rejected:**

- Adds three new keywords
- Significantly different from C
- `out` semantics (must write before return) add complexity beyond const
- Doesn't match how C developers think

### Alternative 3: Warning-Only Mode

Emit warnings instead of errors for const violations.

**Why Rejected:**

- Warnings are often ignored
- Doesn't provide the safety guarantee
- MISRA requires enforcement, not suggestions
- C-Next's philosophy is "make bugs impossible"

### Alternative 4: Runtime Enforcement

Generate runtime checks for const violations.

**Why Rejected:**

- Adds runtime overhead (violates "zero runtime cost")
- Bug still ships—just crashes at runtime
- Embedded systems can't afford runtime checks
- Compile-time is always better when possible

---

## Consequences

### Positive

1. **Eliminates accidental mutation bugs**: Const violations become compile-time errors
2. **MISRA Rule 8.13 alignment**: C-Next enforces what MISRA recommends
3. **Clear intent documentation**: `const` signals to readers that value won't change
4. **Better static analysis**: ADR-012 cppcheck `constParameterPointer` warnings are resolved
5. **ADR-006 integration**: Read-only references are now truly read-only
6. **No learning curve**: Uses familiar C `const` keyword
7. **Hardware alignment**: ro registers can't be written (matches reality)

### Negative

1. **Breaking change (minimal)**: Existing code with `const` violations will now fail
2. **Additional validation logic**: Slight increase in transpiler complexity
3. **Error message infrastructure**: Need to implement proper error reporting

### Neutral

1. **No runtime cost**: All enforcement at compile time
2. **Generated C unchanged**: `const` already emitted, just now enforced in C-Next
3. **Grammar unchanged**: `const` already in grammar

---

## Test Cases

### Should Compile Successfully

```cnx
// 1. Const variable with no reassignment
const u32 MAX_SIZE <- 100;
void test1() {
    u32 x <- MAX_SIZE;  // Reading const is fine
}

// 2. Const parameter read-only
void printValue(const i32 value) {
    Console.print(value);  // Reading is fine
}

// 3. Const array parameter, elements read-only
void sumArray(const u8 data[], u32 size) {
    u32 total <- 0;
    for (u32 i <- 0; i < size; i <- i + 1) {
        total <- total + data[i];  // Reading is fine
    }
}

// 4. Mutable parameter modification (no const)
void increment(i32 value) {
    value <- value + 1;  // No const, modification OK
}

// 5. Const in namespace
namespace Config {
    const u32 BUFFER_SIZE <- 256;
    const u32 TIMEOUT_MS <- 1000;
}

// 6. Reading ro register
void readStatus() {
    u32 status <- GPIO7.PSR;  // Reading ro is fine
}
```

### Should Fail Compilation

```cnx
// 1. Direct const variable assignment
const u32 CONFIG <- 100;
void test1() {
    CONFIG <- 200;  // ERROR: cannot assign to const variable 'CONFIG'
}

// 2. Const parameter assignment
void process(const i32 value) {
    value <- value + 1;  // ERROR: cannot assign to const parameter 'value'
}

// 3. Const array element assignment
void clearArray(const u8 data[], u32 size) {
    data[0] <- 0;  // ERROR: cannot assign to const variable 'data' (array element)
}

// 4. Compound assignment to const
const u32 COUNTER <- 0;
void test4() {
    COUNTER +<- 1;  // ERROR: cannot assign to const variable 'COUNTER'
}

// 5. Const struct member assignment
struct Point { i32 x; i32 y; }
void move(const Point p) {
    p.x <- 10;  // ERROR: cannot assign to const parameter 'p' (member access)
}

// 6. ro register assignment
void test6() {
    GPIO7.PSR <- 0xFF;  // ERROR: cannot assign to read-only register member 'PSR'
}
```

---

## Design Decisions

### Q1: Missing const is an ERROR (Aggressive Safety)

MISRA Rule 8.13 says pointers SHOULD point to const-qualified types when possible. C-Next takes the aggressive approach:

- **Decision**: ERROR if const is missing where it could be used
- **Rationale**: Forces developers to intentionally remove `const` if they need mutability
- **Philosophy**: "Pit of success" — the safe path is the default path

```cnx
// If parameter 'value' is never modified in the function body:
void printValue(i32 value) {  // ERROR: parameter 'value' can be const
    Console.print(value);
}

// Developer must explicitly declare intent:
void printValue(const i32 value) {  // OK: const is explicit
    Console.print(value);
}
```

### Q2: Const propagates through function returns

```cnx
const Point p <- getOrigin();
p.x <- 5;  // ERROR: p is const, so p.x is const
```

**Decision**: Yes, const propagates. The variable `p` is declared const, so `p.x` is also const.

### Q3: Const classes (Deferred to ADR-005)

Allow marking an entire class as const:

```cnx
const class Config {
    u32 baudRate;
    u32 timeout;

    Config(u32 baud, u32 time) {
        baudRate <- baud;   // OK: assignment in constructor
        timeout <- time;    // OK: assignment in constructor
    }

    void update() {
        baudRate <- 9600;   // ERROR: class is const, cannot modify after constructor
    }
}
```

**Decision**: Defer to ADR-005 (Classes). When a class is marked `const class`, all members are immutable after constructor completes.

### Q4: Passing const to non-const is an ERROR

This is critical for const-correctness with ADR-006's pass-by-reference model:

```cnx
const u8 flags <- 0b01010101;

void modifyFlags(u8 f) {    // Non-const parameter - can modify
    f <- 0;
}

modifyFlags(flags);  // ERROR: cannot pass const 'flags' to non-const parameter 'f'
```

**Rationale**: In C-Next, all parameters are passed by reference (ADR-006). If a function takes a non-const parameter, it has the right to modify it. Passing a const value to such a function would violate the const contract.

**Implementation**: When generating function calls, check if any const argument is being passed to a non-const parameter. If so, error.

### Q5: Future consideration—default immutability?

As C-Next matures, consider making parameters `const` by default (like Swift/Rust) and requiring explicit `mut` for mutable parameters. This would be a major breaking change requiring community consensus.

---

## Automatic Const Inference for Pointer Parameters (Issue #268)

**Status:** Implemented

Instead of erroring on missing `const` (aggressive approach), C-Next automatically infers `const` for pointer parameters that are never modified within the function body. This eliminates cppcheck `constParameterPointer` warnings while maintaining developer ergonomics.

### How It Works

The transpiler tracks parameter modifications during function body generation:

1. **Track assignment targets**: During code generation, collect all identifiers that appear on the left side of assignment operators (`<-`, `+<-`, etc.)
2. **Track array element modifications**: `arr[i] <- value` marks `arr` as modified
3. **Track member access modifications**: `param.field <- value` marks `param` as modified
4. **Track pass-through modifications**: If a parameter is passed to another function that modifies its corresponding parameter, the outer parameter is also marked as modified
5. **Generate parameter list after body**: Parameters are generated after the function body, so modification tracking can inform `const` qualifiers

### Example

```cnx
// C-Next source - no explicit const needed
void readOnly(u32 value) {
    u32 local <- value;  // Only reads, never assigns
}

void modified(u32 value) {
    value <- 42;  // Direct assignment - modified
}
```

```c
// Generated C - const automatically added where safe
void readOnly(const uint32_t* value) {  // const inferred
    uint32_t local = (*value);
}

void modified(uint32_t* value) {  // no const - parameter is modified
    (*value) = 42;
}
```

### Pass-Through Modification Tracking

When a parameter is passed to another function that modifies it, the parameter is transitively marked as modified:

```cnx
void modifiesParam(u32 val) {
    val <- 42;
}

void passesThrough(u32 val) {
    modifiesParam(val);  // val is passed to a function that modifies it
}
```

```c
// Both functions get non-const parameters
void modifiesParam(uint32_t* val) { (*val) = 42; }
void passesThrough(uint32_t* val) { modifiesParam(val); }
```

### Order-Dependent Detection Limitation

Pass-through modification tracking only works when the **callee is defined before the caller** in the source file. This is because the transpiler processes functions in order and needs to know whether a callee modifies its parameters.

```cnx
// Case 1: Callee defined FIRST (correctly detected)
void modifies(u32 val) { val <- 42; }           // Processed first
void caller(u32 val) { modifies(val); }         // Knows modifies() modifies val

// Case 2: Callee defined AFTER (not detected, C compiler catches)
void caller(u32 val) { modifies(val); }         // Doesn't know yet if modifies() modifies val
void modifies(u32 val) { val <- 42; }           // Processed later
```

In Case 2, the transpiler conservatively assumes the parameter is unmodified (adds `const`). If this is incorrect, the C compiler will catch the mismatch with a clear error message about passing `const` to non-`const` parameter.

**Design rationale**: This conservative approach is safe because:

- If we incorrectly add `const`, the C compiler catches it
- If we incorrectly omit `const`, we just miss an optimization opportunity
- Reordering function definitions fixes the issue

### Header Generation Sync

The auto-const information is synchronized to symbol metadata so header files (`.h`) match implementation files (`.c`):

```c
// Generated .h file
void readOnly(const uint32_t* value);
void modified(uint32_t* value);

// Generated .c file
void readOnly(const uint32_t* value) { ... }
void modified(uint32_t* value) { ... }
```

### What Gets Auto-Const

Auto-const is applied to:

- **Pointer parameters** (non-array, non-float, non-enum types that become `T*` in C)
- **Array parameters** (already pointers in C, get `const` if unmodified)

Auto-const is NOT applied to:

- **Float parameters** (`f32`, `f64`) - passed by value, not by pointer
- **Enum parameters** - passed by value, not by pointer
- **ISR parameters** - function pointer type, not data pointer
- **Explicitly `const` parameters** - already const, redundant

### Implementation Details

Files modified:

- `src/codegen/CodeGenerator.ts`: Tracks `modifiedParameters` Set during function body generation
- `src/codegen/generators/declarationGenerators/FunctionGenerator.ts`: Generates body before parameters
- `src/codegen/generators/expressions/CallExprGenerator.ts`: Tracks pass-through modifications
- `src/codegen/HeaderGenerator.ts`: Uses `isAutoConst` for prototype generation
- `src/pipeline/Pipeline.ts`: Syncs auto-const info to symbols before header generation
- `src/types/ISymbol.ts`: Added `isAutoConst` field to parameter interface

---

## Impact on Static Analysis (ADR-012)

With const enforcement, the following cppcheck warnings should be resolved:

**Before (11 `constParameterPointer` warnings)**:

```
style: Parameter 'dividend' can be declared as pointer to const [constParameterPointer]
style: Parameter 'divisor' can be declared as pointer to const [constParameterPointer]
...
```

**After**: These warnings indicate parameters that aren't modified. Developers can now add `const` and C-Next will enforce it, or the generated C will not have `const` (matching intent).

---

## References

### Memory Safety Research

- [Microsoft Security: 70% of CVEs are memory safety issues](https://msrc-blog.microsoft.com/2019/07/16/a-proactive-approach-to-more-secure-code/)
- [Chromium Memory Safety](https://www.chromium.org/Home/chromium-security/memory-safety/) — 70% of severe security bugs
- [CISA: The Urgent Need for Memory Safety](https://www.cisa.gov/news-events/news/urgent-need-memory-safety-software-products)
- [TrustInSoft: Memory Safety Issues Still Plague New Code](https://www.trust-in-soft.com/resources/blogs/memory-safety-issues-still-plague-new-c-cpp-code)

### Coding Standards

- [MISRA C Guidelines](https://www.perforce.com/resources/qac/misra-c-cpp) — Rule 8.13 on const
- [MISRA C:2025 Changes](https://www.qt.io/quality-assurance/blog/misra-c-2025)
- [Barr Group Embedded C Standard](https://barrgroup.com/embedded-systems/books/embedded-c-coding-standard)

### Language Design

- [Rust Book: References and Borrowing](https://doc.rust-lang.org/book/ch04-02-references-and-borrowing.html)
- [Rust: Borrow Checker Fundamentals](https://www.slingacademy.com/article/borrow-checker-fundamentals-how-rust-enforces-memory-safety/)
- [Swift inout Parameters](https://docs.swift.org/swift-book/documentation/the-swift-programming-language/functions/#In-Out-Parameters)
- [SPARK User's Guide: Specification Features](https://docs.adacore.com/spark2014-docs/html/ug/en/source/specification_features.html)
- [Ada Memory Safety](https://www.adacore.com/blog/memory-safety-in-ada-and-spark-through-language-features-and-tool-support)

### C-Next Related ADRs

- [ADR-004: Register Bindings](adr-004-register-bindings.md) — ro/wo/rw access modifiers
- [ADR-006: Simplified References](adr-006-simplified-references.md) — Pass-by-reference model
- [ADR-008: Language Bug Prevention](adr-008-language-bug-prevention.md) — Bug prevention strategies
- [ADR-012: Static Analysis](adr-012-static-analysis.md) — MISRA compliance framework
