# ADR-036: Multi-dimensional Arrays

## Status
**Research**

## Context

Multi-dimensional arrays are used for:
- Matrices (graphics, transforms)
- 2D sensor data
- Lookup tables with multiple indices
- Display buffers

## Decision Drivers

1. **Graphics** - Transformation matrices
2. **Display** - Framebuffers, character buffers
3. **Tables** - 2D lookup tables
4. **C Compatibility** - Row-major layout

## Recommended Decision

**Support multi-dimensional arrays** with standard C semantics.

## Syntax

### 2D Arrays
```cnx
u8 display[24][80];  // 24 rows, 80 columns

display[0][0] <- 'H';
display[0][1] <- 'i';
```

### 3D Arrays
```cnx
u8 voxels[16][16][16];

voxels[x][y][z] <- material;
```

### Matrices
```cnx
f32 transform[4][4];

// Identity matrix
transform[0][0] <- 1.0;
transform[1][1] <- 1.0;
transform[2][2] <- 1.0;
transform[3][3] <- 1.0;
```

### With Initialization
```cnx
u8 font[128][8] <- {
    {0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00},  // ' '
    {0x18, 0x3C, 0x3C, 0x18, 0x18, 0x00, 0x18, 0x00},  // '!'
    // ... more character data
};
```

### In Struct
```cnx
struct Image {
    u32 width;
    u32 height;
    u8 pixels[240][320];  // 320x240 display
}
```

### As Function Parameter
```cnx
void matrixMultiply(f32 a[4][4], f32 b[4][4], f32 result[4][4]) {
    // Implementation
}
```

## Implementation Notes

### Grammar Changes
```antlr
arrayDimension
    : '[' expression? ']' ('[' expression? ']')*
    ;
```

### Memory Layout
C-Next uses row-major (same as C):
- `arr[i][j]` = `arr + i * cols + j`

### CodeGenerator
Direct mapping to C:
```c
uint8_t display[24][80];
float transform[4][4];
```

### `.length` Property
For multi-dimensional arrays:
```cnx
u8 matrix[4][8];
matrix.length;      // 4 (outer dimension)
matrix[0].length;   // 8 (inner dimension)
```

### Priority
**Medium** - Useful but many embedded apps don't need.

## Open Questions

1. Row-major vs column-major (always row-major like C)?
2. Bounds checking?
3. Slicing? `matrix[0]` as 1D array?

## References

- C multi-dimensional arrays
- Row-major order
