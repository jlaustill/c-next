# Bit Range Test Matrix

## The Bug

When writing `register.DR[0, 16] <- value` on a `u32` register, C-Next currently generates:

```c
#define REG_DR (*(volatile uint32_t*)(ADDR))
REG_DR = (REG_DR & ~(0xFFFFU << 0)) | ((value & 0xFFFFU) << 0);
```

This is **wrong** for embedded systems. The pointer is `uint32_t*`, so this performs a 32-bit memory access, not 16-bit.

### Expected Behavior

For `register.DR[0, 16] <- value`, the generated C should be:

```c
#define REG_DR_16 (*(volatile uint16_t*)(ADDR))
REG_DR_16 = value;
```

Or for non-zero start positions like `[8, 16]`:

```c
#define REG_DR_16_AT_8 (*(volatile uint16_t*)(ADDR + 1))
REG_DR_16_AT_8 = value;
```

## Test Categories

### 1. Memory Access Width Tests (NEW - catches the bug)

For each base type (u8, u16, u32, u64), test writing sub-widths:

| Base | Write Width | Start      | Expected Pointer Type |
| ---- | ----------- | ---------- | --------------------- |
| u32  | 8 bits      | 0          | `uint8_t*`            |
| u32  | 8 bits      | 8          | `uint8_t*` at +1      |
| u32  | 8 bits      | 16         | `uint8_t*` at +2      |
| u32  | 8 bits      | 24         | `uint8_t*` at +3      |
| u32  | 16 bits     | 0          | `uint16_t*`           |
| u32  | 16 bits     | 16         | `uint16_t*` at +2     |
| u64  | 8 bits      | 0-56       | `uint8_t*` at offsets |
| u64  | 16 bits     | 0,16,32,48 | `uint16_t*`           |
| u64  | 32 bits     | 0, 32      | `uint32_t*`           |

### 2. Mask Generation Tests

Verify correct masks for all widths:

| Width | Expected Mask           |
| ----- | ----------------------- |
| 1     | `0x1U`                  |
| 2     | `0x3U`                  |
| 3     | `0x7U`                  |
| 4     | `0xFU`                  |
| 5     | `0x1FU`                 |
| 6     | `0x3FU`                 |
| 7     | `0x7FU`                 |
| 8     | `0xFFU`                 |
| 9     | `0x1FFU`                |
| 10    | `0x3FFU`                |
| 11    | `0x7FFU`                |
| 12    | `0xFFFU`                |
| 13    | `0x1FFFU`               |
| 14    | `0x3FFFU`               |
| 15    | `0x7FFFU`               |
| 16    | `0xFFFFU`               |
| ...   | ...                     |
| 32    | `0xFFFFFFFFU`           |
| 64    | `0xFFFFFFFFFFFFFFFFULL` |

### 3. Shift Position Tests

Verify correct shift amounts for all start positions:

| Start | Width | Expected Shift         |
| ----- | ----- | ---------------------- |
| 0     | any   | `<< 0`                 |
| 1     | any   | `<< 1`                 |
| 7     | 1     | `<< 7`                 |
| 8     | 8     | `<< 8` OR byte offset  |
| 16    | 16    | `<< 16` OR word offset |

### 4. Other Bits Unchanged Tests (Execution)

For read-modify-write operations, verify other bits are preserved:

```cnx
u32 main() {
    u32 value <- 0xFFFFFFFF;
    value[0, 8] <- 0x00;
    if (value != 0xFFFFFF00) return 1;

    value <- 0xFFFFFFFF;
    value[8, 8] <- 0x00;
    if (value != 0xFFFF00FF) return 2;

    // ... etc for all positions
    return 0;
}
```

### 5. Access Modifier Tests

| Modifier | Bit Range | Expected Behavior           |
| -------- | --------- | --------------------------- |
| `rw`     | `[0, 16]` | 16-bit RMW or 16-bit direct |
| `wo`     | `[0, 16]` | 16-bit direct write         |
| `ro`     | `[0, 16]` | Compile error on write      |
| `w1c`    | `[0, 16]` | 16-bit direct write         |
| `w1s`    | `[0, 16]` | 16-bit direct write         |

### 6. Register vs Variable Tests

Ensure consistent behavior between:

- `u32 variable; variable[0, 16] <- x;`
- `register REG { DR: u32 rw }; REG.DR[0, 16] <- x;`

## Test Files to Create

1. `tests/bit-range/memory-width-u32.test.cnx` - All sub-widths of u32
2. `tests/bit-range/memory-width-u64.test.cnx` - All sub-widths of u64
3. `tests/bit-range/mask-generation.test.cnx` - Verify masks 1-64 bits
4. `tests/bit-range/shift-positions.test.cnx` - Verify shift amounts
5. `tests/bit-range/unchanged-bits.test.cnx` - Execution test for preservation
6. `tests/register/register-bit-range-width.test.cnx` - Register-specific width tests

## Priority

1. **HIGH**: Memory access width tests (catches the bug)
2. **HIGH**: Unchanged bits execution tests (runtime verification)
3. **MEDIUM**: Mask generation tests
4. **MEDIUM**: Access modifier combinations
5. **LOW**: Exhaustive width coverage (1-64)
