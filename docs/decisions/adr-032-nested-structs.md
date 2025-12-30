# ADR-032: Nested Structs

## Status
**Research**

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

## Recommended Decision

**Support nested structs** - straightforward extension of ADR-014.

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
Rectangle r <- Rectangle {
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

### Anonymous Nested Structs
```cnx
struct Packet {
    u8 type;
    struct {
        u16 sequence;
        u16 length;
    } header;
    u8 payload[256];
}

// Access
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

### Priority
**High** - Common pattern, mostly works already.

## Open Questions

1. Anonymous nested structs?
2. Order of struct definitions (forward declarations)?

## References

- C nested structs
- ADR-014 Structs
