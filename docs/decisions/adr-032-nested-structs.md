# ADR-032: Nested Structs

## Status
**Accepted**

## Context

Structs containing other structs are common:
- Configuration hierarchies
- Protocol packets
- Composite data types

```cnx
struct Point { i32 x; i32 y; }
struct Rect { Point topLeft; Point bottomRight; }
```

## Decision Drivers

1. **Composition** - Building complex types from simple ones
2. **Organization** - Logical grouping of related data
3. **C Compatibility** - Generate valid nested structs
4. **Type Safety** - Maintain full type compatibility
5. **MISRA Compliance** - Avoid patterns that cause safety issues

## Research Findings

### Named Nested Structs: Safe and Well-Supported

Named/tagged nested structs are well-established C patterns with no significant MISRA concerns:
- Full type compatibility across translation units
- Forward declaration possible
- Works with C99 and earlier standards
- Clear ownership and reusability

### Anonymous Nested Structs: Multiple Concerns

Research identified several issues with anonymous structs that make them unsuitable for C-Next:

#### 1. Type Compatibility Problems

Each anonymous struct declaration creates a **distinct type**, even with identical members:

```c
struct { int x; int y; } a;
struct { int x; int y; } b;
b = a;  // ERROR: incompatible types!
```

C uses name equivalence within a translation unit. Without a tag, there's no name to match, making anonymous struct members:
- Impossible to pass to functions expecting that type
- Impossible to return from functions
- Impossible to reference via external pointers

#### 2. MISRA Guidelines

- **Rule 19.2** (Advisory): Discourages union keyword usage, applies to anonymous unions
- **MISRA.INCOMPLETE.STRUCT.UNNAMED**: Checker flags incomplete unnamed struct types
- **Amendment 3 (2022)**: Unnamed structs in `_Generic` association lists are violations because each declaration creates a distinct type

#### 3. Pre-C11 Compatibility

Anonymous structs/unions are a **C11 feature**. Code using them won't compile with C99/C90 compilers, which matters for embedded targets where C-Next aims to be useful.

#### 4. Name Collision Risk

Anonymous struct members are accessed directly, which can cause ambiguity if both outer and anonymous inner structs share field names.

#### 5. No Forward Declaration

Anonymous struct types cannot be forward-declared, limiting use in header files and across modules.

## Recommended Decision

**Support named nested structs only. Do not support anonymous nested structs.**

This provides:
- Full type safety and compatibility
- MISRA compliance
- C99 compatibility
- Clear, maintainable code

Users who need the "flattened access" pattern of anonymous structs should define a named struct and access via the member name. This is more explicit and avoids the pitfalls above.

## Syntax

### Basic Nesting
```cnx
struct Point {
    i32 x;
    i32 y;
}

struct Line {
    Point start;
    Point end;
}

struct Rectangle {
    Point topLeft;
    Point bottomRight;
}

// Usage
Rectangle r <- {
    topLeft: Point { x: 0, y: 0 },
    bottomRight: Point { x: 100, y: 100 }
};

i32 width <- r.bottomRight.x - r.topLeft.x;
```

### Deep Nesting
```cnx
struct Color { u8 r; u8 g; u8 b; }

struct Material {
    Color ambient;
    Color diffuse;
    Color specular;
    f32 shininess;
}

struct Mesh {
    Point vertices[100];
    Material material;
}
```

### Alternative to Anonymous Structs

Instead of anonymous structs, use named structs with descriptive member names:

```cnx
// Instead of anonymous:
// struct Packet {
//     u8 type;
//     struct { u16 sequence; u16 length; } header;  // NOT SUPPORTED
// }

// Use named struct:
struct PacketHeader {
    u16 sequence;
    u16 length;
}

struct Packet {
    u8 type;
    PacketHeader header;
    u8 payload[256];
}

// Access is equally clear:
packet.header.sequence <- 1;
```

## Implementation Notes

### Grammar
Already supported - struct members can have user types.

### CodeGenerator
```c
typedef struct { int32_t x; int32_t y; } Point;
typedef struct { Point start; Point end; } Line;
```

### Member Access
Already works via `.` operator chain.

### Declaration Order
Structs must be defined before use. This is consistent with C semantics and avoids the need for forward declarations in most cases.

### Priority
**High** - Common pattern, mostly works already.

## Open Questions

1. ~~Anonymous nested structs?~~ → **Resolved: Not supported**
2. Order of struct definitions (forward declarations)? → Structs must be defined before use

## References

- [MISRA C:2012 Rule 19.2 - MathWorks](https://www.mathworks.com/help/releases/R2021a/polyspace_code_prover_access/ref/misrac2012rule19.2.html)
- [MISRA C:2012 Amendment 3](https://www.misra.org.uk/app/uploads/2022/12/MISRA-C-2012-AMD3.pdf)
- [GCC Unnamed Fields Documentation](https://gcc.gnu.org/onlinedocs/gcc/Unnamed-Fields.html)
- [Type Compatibility in C](https://shape-of-code.com/2018/05/08/type-compatibility-name-vs-structural-equivalence/)
- [SEI CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c)
- ADR-014 Structs
