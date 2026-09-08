# ADR-014: Structs

**Status:** Implemented
**Date:** 2025-12-28
**Decision Makers:** C-Next Language Design Team

## Context

C-Next needs a way to group related data fields together. This is the foundation for:

- Complex data types (point, vector, configuration)
- Register layouts with multiple fields
- The `class` feature (ADR-005) which adds methods to structs

C already has `struct`, and C-Next should provide an equivalent with:

- Same semantics as C structs
- Fixed-width types (`u8`, `u32`, etc.)
- Integration with null state semantics (ADR-015)

## Decision

### Struct Syntax

```cnx
struct Point {
    i32 x;
    i32 y;
}

struct UARTConfig {
    u32 baudRate;
    u8 dataBits;
    u8 stopBits;
    u8 parity;
}
```

### Declaration and Initialization

```cnx
// Declaration (zero-initialized per ADR-015)
Point origin;
UARTConfig config;

// Initialization in init()
void init() {
    origin <- { x: 0, y: 0 };
    config <- {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 0
    };
}
```

### Inline Initialization (for const structs)

```cnx
const Point ORIGIN <- { x: 0, y: 0 };
```

### Member Access

```cnx
i32 xVal <- origin.x;
origin.x <- 100;
```

### Pass by Reference (per ADR-006)

All parameters are passed by reference, including primitives. This means you cannot pass literals directly (no magic numbers):

```cnx
void movePoint(Point p, i32 dx, i32 dy) {
    p.x +<- dx;
    p.y +<- dy;
}

// Usage - named values required (per ADR-006)
const i32 MOVE_X <- 10;
const i32 MOVE_Y <- 20;
movePoint(origin, MOVE_X, MOVE_Y);  // origin is modified
```

This enforces self-documenting code and eliminates magic numbers.

### Transpilation

```cnx
struct Point {
    i32 x;
    i32 y;
}

Point p;
p <- { x: 10, y: 20 };
```

Generates:

```c
typedef struct {
    int32_t x;
    int32_t y;
} Point;

Point p = {0};

// In function:
p = (Point){ .x = 10, .y = 20 };
```

## What Structs Do NOT Have

| Feature                   | Rationale                                                                                  |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| Methods                   | Use `namespace` (ADR-002) for singleton services, `class` (ADR-005) for multiple instances |
| Constructors              | Use `class` or inline initialization                                                       |
| Visibility modifiers      | All fields are public (use `class` for encapsulation)                                      |
| Inheritance               | Not in C-Next                                                                              |
| Nested struct definitions | Define separately, compose by field                                                        |

## Design Decisions

### All Fields Public

Structs are pure data containers. For behavior, use `namespace` or `class`:

```cnx
// Struct: public data, no behavior
struct Point {
    i32 x;
    i32 y;
}

// Namespace: singleton service with behavior (ADR-002)
namespace PointUtils {
    public void move(Point p, i32 dx, i32 dy) {
        p.x +<- dx;
        p.y +<- dy;
    }
}

// Class: multiple instances with encapsulated behavior (ADR-005)
class Circle {
    i32 centerX;    // private by default
    i32 centerY;
    u32 radius;

    public Circle(i32 x, i32 y, u32 r) { ... }
    public u32 area() { ... }
}
```

### Named Field Initialization

Use `{ field: value }` syntax (like Rust, Go, TypeScript):

```cnx
Point p <- { x: 10, y: 20 };
```

The type is **not** repeated. It is already declared to the left, and repeating
it is an error (E0356). Every position that declares a type behaves the same
way: a variable's declaration, an assignment target, a field of an enclosing
initializer, a call argument, and a `return` statement.

```cnx
// NOT SUPPORTED -- the type is already declared
Point p <- Point { x: 10, y: 20 };
```

**Literals are allowed** in struct initializers because initialization is not a function call — no pass-by-reference occurs. This is the same as `u8 flags <- 44;`.

Not positional (error-prone with many fields):

```cnx
// NOT SUPPORTED
Point p <- Point(10, 20);
```

### Zero Initialization by Default

Per ADR-015, uninitialized structs are zero-initialized:

```cnx
Point p;  // p.x = 0, p.y = 0
```

This is explicit in generated C:

```c
Point p = {0};
```

## Relationship to Namespaces and Classes

| Feature     | Struct         | Namespace         | Class              |
| ----------- | -------------- | ----------------- | ------------------ |
| Fields      | Yes            | Yes               | Yes                |
| Methods     | No             | Yes               | Yes                |
| Constructor | No             | No                | Yes                |
| Visibility  | All public     | Private default   | Private default    |
| Instances   | N/A            | Singleton         | Multiple           |
| Use case    | Data container | Singleton service | Multiple instances |

### When to Use Each

| Scenario                                       | Use                                 |
| ---------------------------------------------- | ----------------------------------- |
| Group related data fields                      | `struct`                            |
| Singleton service (LED, Console, ErrorHandler) | `namespace`                         |
| Multiple instances (UART1, UART2, UART3)       | `class`                             |
| Data + behavior, only one exists               | `namespace` with `struct` parameter |
| Data + behavior, multiple exist                | `class`                             |

### Examples

```cnx
// Struct: just data
struct Point { i32 x; i32 y; }

// Namespace: singleton service operating on data
namespace LED {
    public void on() { ... }
    public void off() { ... }
}

// Class: multiple instances with their own data
class UART {
    u32 baseAddress;
    public UART(u32 base) { ... }
    public void send(u8* data, u32 len) { ... }
}
```

## Examples

### Simple Data Types

```cnx
struct Vector3 {
    f32 x;
    f32 y;
    f32 z;
}

struct Color {
    u8 r;
    u8 g;
    u8 b;
    u8 a;
}
```

### Configuration Structures

```cnx
struct SPIConfig {
    u32 clockSpeed;
    u8 mode;
    u8 bitOrder;
}

struct I2CConfig {
    u32 clockSpeed;
    u8 address;
}
```

### Composition

```cnx
struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

Rectangle r <- {
    topLeft: { x: 0, y: 0 },
    bottomRight: { x: 100, y: 50 }
};
```

## Diagnostics

| Code  | Reported when                                                                           | Asserted by                                                  |
| ----- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| E0356 | A struct initializer writes a type where the position it stands in already declares one | `tests/adr-014/struct-redundant-type-error.test.cnx`         |
| E0357 | A struct initializer writes no type and stands where no position declares one           | `tests/adr-014/struct-no-type-error.test.cnx`                |
| E0508 | A C++ class with a constructor is initialized where no statement can follow it          | `tests/external-types/cpp-class-scope-member-error.test.cnx` |

A struct literal has no type of its own, and the position it stands in gives it
one. The positions that do are a variable's declaration (including a `for`
header's), an assignment target, a field of an enclosing initializer, a call
argument, and a `return` statement, whose type is the enclosing function's
declared return type. Repeating the type in any of them is an error.

Every position that carries a value is on that list, so the written form
`Point { x: 1 }` is left legal only where nothing consumes it -- a bare
expression statement. E0357's help therefore does not offer "write the type" as
a remedy: it would name the other error.

All three are decided during analysis, at the initializer's own position, and
every offense in a file is reported.

**E0508 is the one place this syntax depends on the target language.** A C++
class with a user-defined constructor is not an aggregate, so the initializer
cannot be a single expression: the fields are assigned one at a time, and
assignments are statements. A declaration outside a function body has no
statement position after it, and that is true of a **scope member** as much as
of a global -- a scope member becomes a file-scope definition. So the rule is
about where the initializer stands, not about what it initializes, which is why
it lives beside E0356 and E0357 rather than with the interop decisions.

## Scope-Context Matrix (#1219)

Severity follows the eslint model: `off` records that a cell **cannot exist**,
`warn` that it should be covered and is not, `error` that it must be.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| top-level function | same file           | error    |
| scope method       | same file           | error    |
| global variable    | same file           | error    |
| scope member       | same file           | error    |
| top-level function | imported direct     | off      |
| scope method       | imported direct     | off      |
| global variable    | imported direct     | off      |
| scope member       | imported direct     | off      |
| top-level function | imported transitive | off      |
| scope method       | imported transitive | off      |
| global variable    | imported transitive | off      |
| scope member       | imported transitive | off      |

Both rules are decided entirely within the file that writes the initializer:
whether a type is written is syntax, and whether the position supplies one is a
question about that initializer's own ancestors. Nothing crosses an include, so
the imported cells record that they cannot exist rather than that they are
uncovered. The struct being initialized may of course be declared elsewhere --
that is what makes it a struct, not what makes either rule fire.

## Implementation Notes

### Grammar Changes

Add to `CNext.g4`:

```antlr
structDeclaration
    : 'struct' IDENTIFIER '{' structMember* '}'
    ;

structMember
    : type IDENTIFIER ';'
    ;

structInitializer
    : typeName '{' (fieldInitializer (',' fieldInitializer)*)? '}'
    ;

fieldInitializer
    : IDENTIFIER ':' expression
    ;
```

### Code Generator Changes

1. Generate `typedef struct { ... } Name;` for struct declarations
2. Generate `= {0}` for uninitialized struct variables
3. Generate `(Type){ .field = value }` for struct initializers
4. Handle struct member access with `.`

## References

- ADR-002: Namespaces (singleton services with behavior)
- ADR-005: Classes Without Inheritance (multiple instances with behavior)
- ADR-006: Simplified References (structs passed by reference)
- ADR-015: Null State / Zero Initialization (default struct values)
