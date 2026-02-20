# ADR-111: Safe Hardware Abstraction Primitives

**Status:** Research
**Date:** 2026-02-20
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-004 (Register Bindings), ADR-034 (Bitmap Types)

## Context

C-Next's register and bitmap primitives (ADR-004, ADR-034) provide the foundation for type-safe hardware access. However, several gaps prevent achieving **100% statically typed, memory-safe hardware access**:

1. **No parameterized register blocks** — MCUs have multiple instances of identical peripherals (9 GPIO ports, 8 UARTs, etc.). Currently requires copy-pasting definitions.

2. **Incomplete w1c/w1s enforcement** — The compiler prevents reads from write-only registers but doesn't prevent read-modify-write (RMW) patterns that violate w1c semantics.

3. **No SVD import tooling** — Every Cortex-M chip has an SVD file describing its peripherals. Manual transcription is error-prone and tedious.

4. **Missing safety guarantees** — No compile-time enforcement of peripheral initialization order, clock gating, or pin multiplexing conflicts.

### The Goal

Enable writing MCU libraries where **invalid hardware access is a compile error**, not a runtime bug:

```cnx
// Ideal: compiler prevents all these mistakes
GPIO1.ISR <- GPIO1.ISR;           // ERROR: RMW on w1c register
UART1.send("hello");              // ERROR: UART1 clock not enabled
GPIO1.Pin13 <- output;            // ERROR: Pin13 muxed to SPI
DMA.transfer(src, dst, 1000);     // ERROR: DMA not initialized
```

---

## Part 1: Parameterized Register Blocks

### Problem

The i.MX RT1062 (Teensy 4.x) has 9 GPIO ports with identical register layouts at different base addresses. Current syntax requires 9 separate definitions:

```cnx
// Current: repetitive and error-prone
register GPIO1 @ 0x401B8000 {
    DR:   GpioDirection rw @ 0x00,
    GDIR: GpioDirection rw @ 0x04,
    PSR:  GpioDirection ro @ 0x08,
    // ... 10 more fields
}

register GPIO2 @ 0x401BC000 {
    // ... exact same fields repeated
}

// ... 7 more times
```

### Research: How Other Languages Solve This

#### Rust (svd2rust)
Uses generics with marker types:
```rust
pub struct GPIO<const BASE: u32> {
    dr: Reg<DR_SPEC>,
    gdir: Reg<GDIR_SPEC>,
}

const GPIO1: GPIO<0x401B8000> = GPIO::new();
const GPIO2: GPIO<0x401BC000> = GPIO::new();
```

#### Zig
Uses comptime parameters:
```zig
fn GPIO(comptime base: u32) type {
    return struct {
        const DR = @intToPtr(*volatile u32, base + 0x00);
        const GDIR = @intToPtr(*volatile u32, base + 0x04);
    };
}

const GPIO1 = GPIO(0x401B8000);
```

#### C (CMSIS)
Uses macros and base address offsets:
```c
#define GPIO_DR_OFFSET   0x00
#define GPIO_GDIR_OFFSET 0x04

#define GPIO1_BASE 0x401B8000
#define GPIO1_DR   (*(volatile uint32_t*)(GPIO1_BASE + GPIO_DR_OFFSET))
```

### Decision Drivers

1. **Minimize repetition** — Define peripheral layout once, instantiate many times
2. **Type safety** — Each instance should be a distinct type (GPIO1 ≠ GPIO2)
3. **Zero runtime cost** — All addresses resolved at compile time
4. **MISRA compliance** — Generated C must pass static analysis
5. **SVD compatibility** — Syntax should map cleanly from SVD peripheral definitions

### Recommendation: Parameterized Register Blocks

Parameterized registers follow C-Next's function-like patterns and are straightforward to implement — the base address is just a compile-time constant parameter.

### Specification: Parameterized Registers

#### Grammar (Breaking Change)

All registers now use parameterized syntax, even single-instance peripherals. The old `register Name @ address { }` syntax is removed.

```antlr
registerDefinition
    : 'register' IDENTIFIER '(' parameterList ')' '{' registerMember* '}'
    ;

parameterList
    : parameter (',' parameter)*
    ;

parameter
    : type IDENTIFIER
    ;

registerInstantiation
    : 'register' IDENTIFIER ':' IDENTIFIER '(' argumentList ')' ';'
    ;
```

Single-instance peripherals simply have one instantiation:

```cnx
// Single-instance peripheral (e.g., system control block)
register SystemControl(u32 baseAddress) {
    CPUID: u32 ro @ baseAddress + 0x00,
    ICSR:  u32 rw @ baseAddress + 0x04,
}

register SCB: SystemControl(0xE000ED00);  // Only one instance
```

#### Syntax

```cnx
// Parameterized register definition
register GpioPort(u32 baseAddress) {
    DR:     GpioDirection rw  @ baseAddress + 0x00,
    GDIR:   GpioDirection rw  @ baseAddress + 0x04,
    PSR:    GpioDirection ro  @ baseAddress + 0x08,
    ICR1:   u32           rw  @ baseAddress + 0x0C,
    ICR2:   u32           rw  @ baseAddress + 0x10,
    IMR:    GpioDirection rw  @ baseAddress + 0x14,
    ISR:    GpioDirection w1c @ baseAddress + 0x18,
    EDGE:   u32           rw  @ baseAddress + 0x1C,
    DR_SET: GpioDirection wo  @ baseAddress + 0x84,
    DR_CLR: GpioDirection wo  @ baseAddress + 0x88,
    DR_TOG: GpioDirection wo  @ baseAddress + 0x8C,
}

// Instantiate at specific addresses
register GPIO1: GpioPort(0x401B8000);
register GPIO2: GpioPort(0x401BC000);
register GPIO3: GpioPort(0x401C0000);
register GPIO4: GpioPort(0x401C4000);
register GPIO5: GpioPort(0x400C0000);
register GPIO6: GpioPort(0x42000000);
register GPIO7: GpioPort(0x42004000);
register GPIO8: GpioPort(0x42008000);
register GPIO9: GpioPort(0x4200C000);
```

#### Transpilation

```cnx
register GpioPort(u32 baseAddress) {
    DR:   u32 rw @ baseAddress + 0x00,
    GDIR: u32 rw @ baseAddress + 0x04,
}

register GPIO1: GpioPort(0x401B8000);
register GPIO2: GpioPort(0x401BC000);
```

Transpiles to:

```c
// Each instance gets its own macro set with computed addresses
#define GPIO1_DR   (*(volatile uint32_t*)(0x401B8000 + 0x00))
#define GPIO1_GDIR (*(volatile uint32_t*)(0x401B8000 + 0x04))

#define GPIO2_DR   (*(volatile uint32_t*)(0x401BC000 + 0x00))
#define GPIO2_GDIR (*(volatile uint32_t*)(0x401BC000 + 0x04))
```

#### Implementation Notes

This is straightforward to implement:

1. **Parser**: Add optional parameter list to `registerDeclaration` rule
2. **Symbol Collection**: Store parameter name and type with register definition
3. **Instantiation**: When processing `register GPIO1: GpioPort(0x401B8000)`:
   - Look up `GpioPort` definition
   - Substitute `baseAddress` with `0x401B8000` in all offset expressions
   - Evaluate constant expressions at compile time
   - Generate macros with resolved addresses

The key insight: **all expressions are compile-time constants**. No runtime evaluation needed — just constant folding during transpilation.

#### Type Identity and Generic Peripheral Code

Register instances can be used in two ways:

**Specific instance** — when you need a particular peripheral:
```cnx
void debugGpio1() {
    GPIO1.DR[13] <- true;  // Only works with GPIO1
}
```

**Any instance of a template** — when you want generic code:
```cnx
void setPin(GpioPort port, u8 pin) {
    port.DR[pin] <- true;
}

void clearPin(GpioPort port, u8 pin) {
    port.DR[pin] <- false;
}

setPin(GPIO1, 13);   // OK — GPIO1 is a GpioPort
setPin(GPIO2, 0);    // OK — GPIO2 is a GpioPort
setPin(UART1, 0);    // ERROR: UART1 is not a GpioPort
```

#### Function Specialization

The compiler **specializes** generic peripheral functions at each call site. There is no runtime indirection:

```cnx
setPin(GPIO1, 13);
setPin(GPIO2, 0);
```

Transpiles to:

```c
// Inlined/specialized — no function call overhead
GPIO1_DR |= (1 << 13);
GPIO2_DR |= (1 << 0);
```

If the function is too large to inline, the compiler generates separate specialized versions:

```c
void setPin_GPIO1(uint8_t pin) { GPIO1_DR |= (1 << pin); }
void setPin_GPIO2(uint8_t pin) { GPIO2_DR |= (1 << pin); }
```

This enables writing reusable HAL code without runtime overhead or duplicating source code per instance.

---

## Part 2: w1c/wo/w1s Codegen Fix

### Problem

Current implementation generates read-modify-write for bit-field assignments, which is incorrect for w1c registers:

```cnx
INT.STATUS[3] <- true;
// Currently generates: INT_STATUS = (INT_STATUS & ~mask) | value;  // BUG!
// Should generate:     INT_STATUS = (1 << 3);                      // Direct write
```

### Fix

Bit-field and bitmap-field writes to w1c/wo/w1s registers must generate **direct writes**, not RMW.

#### Correct Codegen for w1c

| C-Next | Generated C |
|--------|-------------|
| `INT.STATUS <- 0x0F` | `INT_STATUS = 0x0F;` |
| `INT.STATUS[3] <- true` | `INT_STATUS = (1 << 3);` |
| `INT.STATUS.Pin3 <- true` | `INT_STATUS = (1 << 3);` |
| `INT.STATUS[3] <- false` | **Compiler error** |
| `INT.STATUS.Pin3 <- false` | **Compiler error** |

Writing `false` to a w1c bit is an error — it has no effect (w1c bits are cleared by writing `1`, not `0`).

#### Implementation

In the register assignment codegen, check the access modifier and generate direct writes instead of RMW:

```typescript
// For w1c/wo/w1s bit-field assignments:
if (RegisterUtils.isWriteOnlyRegister(accessMod)) {
    if (value === false) {
        throw new CodeGenerationError(
            `writing 'false' to ${accessMod} register bit has no effect`
        );
    }
    // Generate direct write: REG = (1 << bit)
    return `${regName} = (1 << ${bitPosition});`;
}
// For rw registers, use existing RMW codegen
```

---

## Part 3: SVD Import Tool

### Problem

Every Cortex-M microcontroller ships with an SVD (System View Description) file that describes all peripherals, registers, fields, and access types. Manual transcription to C-Next is:

- **Error-prone** — Typos in addresses, field widths, access types
- **Tedious** — Thousands of registers per chip
- **Maintenance burden** — SVD files get updated with errata

### Research: SVD Format

SVD is an XML format standardized by ARM (CMSIS-SVD). Example:

```xml
<peripheral>
  <name>GPIO1</name>
  <baseAddress>0x401B8000</baseAddress>
  <registers>
    <register>
      <name>DR</name>
      <addressOffset>0x00</addressOffset>
      <access>read-write</access>
      <fields>
        <field>
          <name>PIN0</name>
          <bitOffset>0</bitOffset>
          <bitWidth>1</bitWidth>
        </field>
        <!-- ... -->
      </fields>
    </register>
  </registers>
</peripheral>
```

### Specification: svd2cnext Tool

#### Usage

```bash
# Generate C-Next register definitions from SVD
npx svd2cnext MIMXRT1062.svd --output src/hal/imxrt1062/

# Options
--peripheral GPIO1,GPIO2,UART  # Only specific peripherals
--exclude USB,ENET             # Exclude peripherals
--split                        # One file per peripheral
```

#### Output Structure

```
src/hal/imxrt1062/
├── gpio.cnx          # GPIO template + instances
├── uart.cnx          # UART template + instances
├── spi.cnx           # SPI template + instances
├── peripherals.cnx   # Re-exports all peripherals
└── _raw/             # Optional: raw per-peripheral files
```

#### SVD to C-Next Mapping

| SVD | C-Next |
|-----|--------|
| `<peripheral>` (any) | Parameterized register + instance(s) |
| `<peripheral>` with `derivedFrom` | Additional instance of same template |
| `<register access="read-write">` | `rw` |
| `<register access="read-only">` | `ro` |
| `<register access="write-only">` | `wo` |
| `<register modifiedWriteValues="oneToClear">` | `w1c` |
| `<register modifiedWriteValues="oneToSet">` | `w1s` |
| `<register>` with `<field>` definitions | Generate bitmap type |
| Reserved gaps in fields | `Reserved[width]` |

#### Bitmap Generation

The tool generates bitmap types for any register with `<field>` definitions. Field names are preserved from SVD:

Input SVD:
```xml
<register>
  <name>CR1</name>
  <addressOffset>0x00</addressOffset>
  <size>32</size>
  <access>read-write</access>
  <fields>
    <field>
      <name>ENABLE</name>
      <bitOffset>0</bitOffset>
      <bitWidth>1</bitWidth>
    </field>
    <field>
      <name>MODE</name>
      <bitOffset>1</bitOffset>
      <bitWidth>3</bitWidth>
    </field>
    <field>
      <name>PRESCALER</name>
      <bitOffset>4</bitOffset>
      <bitWidth>4</bitWidth>
    </field>
  </fields>
</register>
```

Generated C-Next:
```cnx
bitmap32 UartCr1 {
    Enable,
    Mode[3],
    Prescaler[4],
    Reserved[24]
}

register UartPort(u32 baseAddress) {
    CR1: UartCr1 rw @ baseAddress + 0x00,
}
```

The tool applies naming conventions:
- `ENABLE` → `Enable` (PascalCase)
- `GPIO1_DR` → `GpioDr` (strip peripheral prefix, PascalCase)
- Reserved gaps calculated automatically

#### Example Output

Input SVD:
```xml
<peripheral>
  <name>GPIO1</name>
  <baseAddress>0x401B8000</baseAddress>
  <registers>
    <register>
      <name>DR</name>
      <addressOffset>0x0</addressOffset>
      <size>32</size>
      <access>read-write</access>
      <fields>
        <field><name>PIN0</name><bitOffset>0</bitOffset><bitWidth>1</bitWidth></field>
        <field><name>PIN1</name><bitOffset>1</bitOffset><bitWidth>1</bitWidth></field>
        <!-- ... PIN2-PIN31 ... -->
      </fields>
    </register>
    <register>
      <name>ISR</name>
      <addressOffset>0x18</addressOffset>
      <size>32</size>
      <access>read-write</access>
      <modifiedWriteValues>oneToClear</modifiedWriteValues>
      <fields>
        <field><name>PIN0</name><bitOffset>0</bitOffset><bitWidth>1</bitWidth></field>
        <!-- ... same fields ... -->
      </fields>
    </register>
  </registers>
</peripheral>

<peripheral derivedFrom="GPIO1">
  <name>GPIO2</name>
  <baseAddress>0x401BC000</baseAddress>
</peripheral>
```

Generated C-Next:
```cnx
/// GPIO - General Purpose Input/Output
/// Generated from MIMXRT1062.svd

bitmap32 GpioPins {
    Pin0, Pin1, Pin2, Pin3, Pin4, Pin5, Pin6, Pin7,
    Pin8, Pin9, Pin10, Pin11, Pin12, Pin13, Pin14, Pin15,
    Pin16, Pin17, Pin18, Pin19, Pin20, Pin21, Pin22, Pin23,
    Pin24, Pin25, Pin26, Pin27, Pin28, Pin29, Pin30, Pin31
}

register GpioPort(u32 baseAddress) {
    /// Data Register
    DR:  GpioPins rw  @ baseAddress + 0x00,
    /// Interrupt Status Register (write 1 to clear)
    ISR: GpioPins w1c @ baseAddress + 0x18,
}

register GPIO1: GpioPort(0x401B8000);
register GPIO2: GpioPort(0x401BC000);
```

#### Implementation Approach

The tool should be implemented in TypeScript as part of the C-Next toolchain:

```
src/tools/svd2cnext/
├── index.ts           # CLI entry point
├── SvdParser.ts       # XML parsing
├── SvdTransformer.ts  # SVD -> C-Next AST
├── CnextEmitter.ts    # AST -> .cnx files
└── types/
    └── ISvdTypes.ts   # SVD type definitions
```

Key implementation considerations:

1. **Peripheral derivation** — SVD uses `derivedFrom` for identical peripherals; emit as parameterized register + instances

2. **Reserved field generation** — Calculate gaps between fields and emit `Reserved[N]`

3. **Field name sanitization** — SVD field names may conflict with C-Next keywords

4. **Cluster handling** — SVD `<cluster>` elements represent register arrays; emit with appropriate indexing

5. **Dim handling** — SVD `<dim>`, `<dimIncrement>`, `<dimIndex>` represent register arrays (e.g., GPT timer's `OCR1`, `OCR2`, `OCR3` with dim=3). Default: expand to individual registers. Future: emit array syntax if C-Next adds register arrays.

6. **Alternate registers** — SVD `<alternateGroup>` and `<alternateRegister>` handle registers sharing the same address with different access (e.g., UART THR/RBR). Emit as two register fields at same offset with `wo` and `ro` — C-Next already supports this.

7. **Layout deduplication** — SVD files with layout-identical peripherals (without `derivedFrom`) are automatically consolidated into one template with multiple instances. The compiler enforces this: duplicate register definitions are an error.

8. **Struct name mapping** — SVD's `<headerStructName>` maps directly to the parameterized register template name

9. **Bitmap reuse** — When multiple registers have identical field layouts (e.g., DR and ISR both have Pin0-Pin31), generate one bitmap type and reuse it

#### Compiler Enforcement

Duplicate register definitions are a compile error:

```cnx
register Gpio1Port(u32 base) { DR: u32 rw @ base + 0x00 }
register Gpio2Port(u32 base) { DR: u32 rw @ base + 0x00 }
// ERROR: Gpio2Port has identical layout to Gpio1Port — use Gpio1Port instead
```

---

## Summary

This ADR covers three features for safe hardware abstraction in C-Next:

1. **Parameterized registers** — Define peripheral layouts once, instantiate at multiple addresses
2. **w1c/wo/w1s codegen fix** — Generate direct writes instead of RMW for write-only registers
3. **svd2cnext tool** — Import register definitions from ARM SVD files

### Out of Scope (Future ADRs if needed)

- **Peripheral initialization ordering** — Developer responsibility; easy to catch during testing
- **Pin multiplexing conflicts** — HAL concern, not a language concern

---

## Decision

### Accepted

1. **Parameterized registers** — `register Name(u32 baseAddress) { ... }` with `register Instance: Name(address);` instantiation. All registers use this syntax (breaking change). Template type serves as interface for generic peripheral code. Duplicate definitions are a compiler error.

2. **w1c/wo/w1s codegen fix** — Bit-field and bitmap-field writes generate direct writes, not RMW. Writing `false` to a w1c bit is a compiler error.

3. **svd2cnext tool** — TypeScript tool to generate C-Next from SVD files. Auto-generates bitmap types from field definitions with good naming.

---

## References

- [CMSIS-SVD Format](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/) — Rust SVD tool
- [Embedded HAL](https://docs.rs/embedded-hal/latest/embedded_hal/) — Rust embedded traits
- [i.MX RT1060 Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMXRT1060RM.pdf)
- ADR-004: Register Bindings
- ADR-034: Bitmap Types for Bit-Packed Data
