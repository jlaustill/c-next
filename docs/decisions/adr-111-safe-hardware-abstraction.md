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

#### Grammar Extension

```antlr
registerDeclaration
    : 'register' IDENTIFIER ('(' parameterList ')')? '@' expression '{' registerMember* '}'
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
void debugUart1(GPIO1 port) { ... }  // Only accepts GPIO1
```

**Any instance of a template** — when you want generic code:
```cnx
void togglePin(GpioPort port, u8 pin) {
    port.DR[pin] <- !port.DR[pin];
}

togglePin(GPIO1, 13);  // OK — GPIO1 is a GpioPort
togglePin(GPIO2, 0);   // OK — GPIO2 is a GpioPort
togglePin(UART1, 0);   // ERROR: UART1 is not a GpioPort
```

The parameterized register type (`GpioPort`) serves as the "interface" type. Any instance of that template satisfies it. The compiler resolves the correct base address at each call site:

```cnx
togglePin(GPIO1, 13);
// Transpiles to: GPIO1_DR ^= (1 << 13);

togglePin(GPIO2, 0);
// Transpiles to: GPIO2_DR ^= (1 << 0);
```

This enables writing reusable HAL code without duplicating functions per instance.

---

## Part 2: Write-Only Register Enforcement

### Problem

Current implementation prevents reading from w1c/wo/w1s registers but doesn't prevent read-modify-write patterns:

```cnx
register INT @ 0x40001000 {
    STATUS: u32 w1c @ 0x00,
}

void bad() {
    // Currently ALLOWED but generates dangerous RMW:
    INT.STATUS[3] <- true;
    // Transpiles to: INT_STATUS = (INT_STATUS & ~mask) | value;
    //                             ^^^^^^^^^^^ BAD: reads w1c register!
}
```

This violates the entire purpose of w1c — the read clears pending interrupts before the write.

### Decision Drivers

1. **Correctness over convenience** — w1c bugs are subtle and dangerous
2. **Clear error messages** — Explain WHY the pattern is wrong
3. **No escape hatch** — If hardware needs RMW, it's not w1c

### No Escape Hatch Needed

If a register is truly w1c (write-1-to-clear), RMW is **always incorrect** — it clears flags you didn't intend to clear. There is no legitimate use case for RMW on a w1c register.

If hardware documentation says "write 1 to clear" but actually requires RMW, the register should be marked `rw`, not `w1c`. The SVD file or manual is wrong, not your code.

**Decision:** No escape hatch. RMW on w1c/w1s/wo is a hard compile error, period.

### Specification: Write-Only Enforcement

#### Prohibited Operations on w1c/w1s/wo Registers

| Operation | Example | Allowed? | Reason |
|-----------|---------|----------|--------|
| Direct write (full register) | `REG.STATUS <- 0x01` | ✅ Yes | No read involved |
| Direct write (literal mask) | `REG.STATUS <- (1 << 3)` | ✅ Yes | No read involved |
| Bit field write | `REG.STATUS[3] <- true` | ❌ **No** | Generates RMW |
| Bitmap field write | `REG.STATUS.Flag <- true` | ❌ **No** | Generates RMW |
| Read | `x <- REG.STATUS` | ❌ No | Already enforced |
| Read in expression | `if (REG.STATUS = 0)` | ❌ No | Already enforced |

#### Error Messages

```
error: bit-field assignment to w1c register 'INT.STATUS' would generate
       read-modify-write, which clears pending flags before writing.

       Use direct write instead:
         INT.STATUS <- (1 << 3);  // Clear only bit 3
         INT.STATUS <- mask;      // Clear bits in mask

       If the hardware truly requires RMW, mark the register as 'rw' instead
       of 'w1c' — this indicates the SVD or datasheet is incorrect.
```

#### Bitmap Masks for w1c Registers

When a w1c register uses a bitmap type, direct writes lose the named-field ergonomics:

```cnx
bitmap32 GpioInterruptFlags {
    Pin0, Pin1, Pin2, Pin3, /* ... */ Pin31
}

register GpioPort(u32 baseAddress) {
    ISR: GpioInterruptFlags w1c @ baseAddress + 0x18,
}

// BLOCKED: GPIO1.ISR.Pin3 <- true           // RMW
// AWKWARD: GPIO1.ISR <- (1 << 3)            // Magic number, loses type safety
```

To preserve named-field ergonomics, bitmap types provide a `.mask()` function:

```cnx
GPIO1.ISR <- GpioInterruptFlags.mask(.Pin3);              // Clear Pin3 only
GPIO1.ISR <- GpioInterruptFlags.mask(.Pin3, .Pin7);       // Clear Pin3 and Pin7
GPIO1.ISR <- GpioInterruptFlags.mask(.Pin0, .Pin1, .Pin2); // Clear multiple
```

The `.mask()` function:
- Accepts one or more field names (prefixed with `.` for clarity)
- Returns the computed bitmask as a compile-time constant
- Preserves type safety — only valid field names accepted
- Generates no runtime code

Transpilation:
```c
GPIO1_ISR = (1 << 3);           // .mask(.Pin3)
GPIO1_ISR = (1 << 3) | (1 << 7); // .mask(.Pin3, .Pin7)
```

#### Implementation

In `AssignmentHandlerUtils.ts`, add validation:

```typescript
static validateWriteOnlyAssignment(
    context: IAssignmentContext,
    state: CodeGenState
): void {
    const accessMod = context.registerAccess?.access;
    if (!RegisterUtils.isWriteOnlyRegister(accessMod)) return;

    // Allow direct whole-register writes
    if (!context.isBitRangeAssignment && !context.bitmapField) return;

    // Disallow bit-field and bitmap-field writes (they generate RMW)
    throw new CodeGenerationError(
        `bit-field assignment to ${accessMod} register '${context.target}' ` +
        `would generate read-modify-write. Use direct write: ` +
        `${context.target} <- (1 << bit). If RMW is truly needed, ` +
        `mark the register as 'rw' instead of '${accessMod}'.`
    );
}
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
--template                     # Generate templates + instances (default)
--flat                         # Generate individual register blocks
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
| `<peripheral>` with `derivedFrom` | Parameterized register + instances |
| `<peripheral>` standalone | `register` block |
| `<register access="read-write">` | `rw` |
| `<register access="read-only">` | `ro` |
| `<register access="write-only">` | `wo` |
| `<register modifiedWriteValues="oneToClear">` | `w1c` |
| `<register modifiedWriteValues="oneToSet">` | `w1s` |
| `<field>` with width > 1 | `FieldName[width]` |
| `<field>` with width = 1 | `FieldName` |
| Reserved gaps | `Reserved[width]` |

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
    </register>
    <register>
      <name>ISR</name>
      <addressOffset>0x18</addressOffset>
      <size>32</size>
      <access>read-write</access>
      <modifiedWriteValues>oneToClear</modifiedWriteValues>
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

register GpioPort(u32 baseAddress) {
    /// Data Register
    DR:  u32 rw  @ baseAddress + 0x00,
    /// Interrupt Status Register (write 1 to clear)
    ISR: u32 w1c @ baseAddress + 0x18,
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

7. **Template detection** — Some SVD files have layout-identical peripherals without `derivedFrom`. Add `--detect-templates` flag to identify and consolidate these automatically:
   ```bash
   npx svd2cnext chip.svd --detect-templates  # Auto-detect identical layouts
   ```

8. **Struct name mapping** — SVD's `<headerStructName>` maps directly to the parameterized register template name

---

## Part 4: Peripheral Initialization Safety

### Problem

Even with perfect register definitions, incorrect usage order causes hardware failures:

```cnx
// All of these compile but fail at runtime:
UART1.write("hello");     // Clock not enabled → hangs
GPIO1.Pin13 <- output;    // Pin muxed to SPI → no effect
DMA.start();              // DMA not initialized → hard fault
ADC.read();               // ADC not calibrated → wrong values
```

### What is "Typestate"?

**Typestate** is a programming language technique where the **type of a value changes based on operations performed on it**. It encodes state machine transitions in the type system so the compiler can verify correct sequencing.

**Simple example:** A file handle that must be opened before reading:

```
File.new()        → File[Closed]
File[Closed].open() → File[Open]
File[Open].read()   → data
File[Open].close()  → File[Closed]
File[Closed].read() → COMPILE ERROR (can't read closed file)
```

The `[Closed]` and `[Open]` are type-level states. The compiler tracks which state you're in and only allows valid transitions.

**For embedded systems**, this means:
- UART in `Uninitialized` state → can't call `send()`
- GPIO pin in `Input` state → can't call `setHigh()`
- DMA channel in `Idle` state → can't call `abort()`

### The Question

Should C-Next add typestate to **guarantee at compile time** that peripherals are used in the correct order? Or is this overkill for the target audience?

**Tradeoffs:**

| Approach | Safety | Complexity | Embedded-Friendly |
|----------|--------|------------|-------------------|
| No enforcement (current) | Runtime bugs | Simple | ✅ |
| Runtime assertions | Debug-time bugs | Simple | ✅ |
| `requires` clauses | Compile-time for simple cases | Medium | ✅ |
| Full typestate | Compile-time for all cases | Complex | ⚠️ |

### Research: Typestate in Other Languages

#### Rust (Embedded HAL)

Uses the type system to encode peripheral state:

```rust
// GPIO pin states are types
struct Pin<const N: u8, MODE> { ... }
struct Input;
struct Output;
struct Disabled;

impl<const N: u8> Pin<N, Disabled> {
    fn into_output(self) -> Pin<N, Output> { ... }
}

impl<const N: u8> Pin<N, Output> {
    fn set_high(&mut self) { ... }
    fn set_low(&mut self) { ... }
}

// Can't call set_high on Input pin — won't compile
```

#### Ada/SPARK

Uses preconditions and ghost state:

```ada
procedure Send (Data : Byte)
  with Pre => UART_Initialized and Clock_Enabled;
```

### Decision Drivers

1. **Compile-time safety** — Catch configuration errors before runtime
2. **Zero runtime cost** — No state tracking in generated code
3. **C-developer friendly** — No ownership semantics, no consumed parameters, no tuple returns
4. **Whole-program analysis** — State tracked across function boundaries and ISRs
5. **Opt-in complexity** — Simple peripherals shouldn't need state machines

### Syntax Options for C-Next Typestate

The goal is compile-time state verification without Rust-style ownership or annotation-heavy syntax.

#### Option A: State Graph Declaration

Define the state machine separately from function implementations:

```cnx
scope Uart1 {
    state UartState { Disabled, Configured, Enabled }

    // State machine definition — which functions cause which transitions
    state graph {
        Disabled   -- init()   --> Configured;
        Configured -- enable() --> Enabled;
        Enabled    -- send()   --> Enabled;      // stays in Enabled
        Enabled    -- deinit() --> Disabled;
    }

    register UART: UartPort(0x40184000);

    public void init(u32 baud) {
        CCM.CCGR5[12, 2] <- 0b11;
        UART.UCR1 <- 0x0001;
    }

    public void enable() {
        UART.UCR2[0] <- true;
    }

    public void send(u8 data) {
        while (UART.USR1[13] = false) { }
        UART.UTXD <- data;
    }

    public void deinit() {
        UART.UCR1 <- 0x0000;
        CCM.CCGR5[12, 2] <- 0b00;
    }
}
```

**Pros:**
- State machine is visible at a glance (like a UML diagram in code)
- Functions are normal C-Next functions — no special parameters
- Easy to read the valid transitions

**Cons:**
- State machine and functions are separate — must keep in sync
- New syntax element (`state graph`)

#### Option B: Phase Blocks

Group functions by the state they're valid in:

```cnx
scope Uart1 {
    state { Disabled, Configured, Enabled }

    register UART: UartPort(0x40184000);

    phase Disabled {
        public void init(u32 baud) -> Configured {
            CCM.CCGR5[12, 2] <- 0b11;
            UART.UCR1 <- 0x0001;
        }
    }

    phase Configured {
        public void enable() -> Enabled {
            UART.UCR2[0] <- true;
        }
    }

    phase Enabled {
        public void send(u8 data) {  // no arrow = stays in current phase
            while (UART.USR1[13] = false) { }
            UART.UTXD <- data;
        }

        public void deinit() -> Disabled {
            UART.UCR1 <- 0x0000;
            CCM.CCGR5[12, 2] <- 0b00;
        }
    }
}
```

**Pros:**
- Functions grouped by valid state — immediately see what's callable when
- `-> State` suffix is lightweight
- Familiar block structure

**Cons:**
- Functions can only be in one phase (can't have a function valid in multiple states without duplication)
- New block syntax (`phase`)

#### Option C: Function-Level State Annotations

Minimal annotations on functions:

```cnx
scope Uart1 {
    state { Disabled, Configured, Enabled }

    register UART: UartPort(0x40184000);

    [Disabled -> Configured]
    public void init(u32 baud) {
        CCM.CCGR5[12, 2] <- 0b11;
        UART.UCR1 <- 0x0001;
    }

    [Configured -> Enabled]
    public void enable() {
        UART.UCR2[0] <- true;
    }

    [Enabled]  // valid in Enabled, stays in Enabled
    public void send(u8 data) {
        while (UART.USR1[13] = false) { }
        UART.UTXD <- data;
    }

    [Enabled -> Disabled]
    public void deinit() {
        UART.UCR1 <- 0x0000;
        CCM.CCGR5[12, 2] <- 0b00;
    }

    [*]  // valid in any state
    public void clearErrors() {
        UART.USR1 <- 0xFFFF;
    }
}
```

**Pros:**
- Annotation directly on function — no lookup needed
- `[*]` for state-independent functions
- Compact

**Cons:**
- Still looks like annotations (though simpler than `requires`/`transitions`)
- State machine not visible at a glance

### Recommendation: NEEDS USER INPUT

All three options achieve the same compile-time safety with zero runtime overhead. The choice is syntax preference:

- **Option A (State Graph)**: Best if you want the state machine visible as documentation
- **Option B (Phase Blocks)**: Best if you think of functions as belonging to states
- **Option C (Annotations)**: Most compact, least new syntax

### Specification: Common Elements (All Options)

#### Whole-Program State Tracking

The compiler tracks peripheral state across the entire program, not just within a single function:

```cnx
void setup() {
    Uart1.init(115200);   // Uart1: Disabled -> Configured
    Uart1.enable();       // Uart1: Configured -> Enabled
}

void loop() {
    Uart1.send(0x55);     // OK: compiler knows Uart1 is Enabled from setup()
}

void main() {
    setup();
    while (true) { loop(); }
}
```

The compiler builds a call graph and propagates state through all paths.

#### ISR State Handling

Interrupt handlers are a special case. The compiler must know what state peripherals are in when the ISR fires:

```cnx
scope Timer1 {
    state { Stopped, Running }

    [Running]
    public void handleInterrupt() {
        // Only valid if Timer1 was started before ISR enabled
    }
}

void main() {
    Timer1.start();           // Timer1: Stopped -> Running
    enableInterrupts();       // ISR can now fire
    // Compiler verifies Timer1 is Running before ISR is enabled
}
```

If the state isn't guaranteed at ISR-enable time, the compiler errors:

```
error: ISR 'Timer1.handleInterrupt' requires Timer1 in state 'Running'
       but state is 'Stopped' when interrupts are enabled at main.cnx:42

       Call 'Timer1.start()' before 'enableInterrupts()'
```

#### No State Tracking (Opt-Out)

Simple peripherals that don't need state tracking can omit the `state` declaration entirely:

```cnx
scope SimpleLed {
    register LED: GpioPort(0x40000000);

    public void on() { LED.DR[13] <- true; }
    public void off() { LED.DR[13] <- false; }
    public void toggle() { LED.DR[13] <- !LED.DR[13]; }
}
// No state tracking — any function callable at any time
```

#### Transpilation

All state tracking is erased at compile time:

```cnx
Uart1.init(115200);
Uart1.enable();
Uart1.send(0x55);
```

Transpiles to:

```c
Uart1_init(115200);
Uart1_enable();
Uart1_send(0x55);
```

Zero runtime overhead.

#### Error Messages

```
error: cannot call 'Uart1.send' — Uart1 is in state 'Configured'
       'send' is only valid in state 'Enabled'

       Did you forget to call 'Uart1.enable()'?

       Valid transitions from 'Configured':
         - enable() → Enabled
```

---

## Part 5: Pin Multiplexing Safety

### Problem

MCU pins are shared between peripherals via multiplexing. Configuring a pin for UART TX while SPI is using it causes silent failures:

```cnx
// Pin 13 is shared between GPIO1.13, SPI1.SCK, and UART3.TX
Spi1.init();              // Configures Pin13 as SPI1.SCK
Uart3.init();             // Reconfigures Pin13 as UART3.TX — SPI1 now broken!
GPIO1.Pin13 <- output;    // Reconfigures as GPIO — both broken!
```

### Research: How Other Systems Handle This

#### Device Tree (Linux)
Pin configurations declared statically:
```dts
&uart3 {
    pinctrl-0 = <&uart3_pins>;
    status = "okay";
};

&uart3_pins {
    pins = "GPIO_AD_B1_06";  // TX
    function = "uart3";
};
```

#### Rust embedded-hal
Pins consumed by peripherals:
```rust
let pins = gpio.split();
let uart = Uart::new(uart1, pins.p13, pins.p14);  // Consumes p13, p14
// pins.p13 no longer usable — moved into uart
```

### Recommendation: Simplified Static Pin Binding

For C developers coming from embedded, the full Rust-style typestate on pins (consumed parameters, tuple returns) is too much ceremony. The **simplified static binding** provides 90% of the safety with 10% of the complexity.

### Specification: Static Pin Binding

#### Pins Declared at Register Instantiation

Pins are bound when a peripheral is instantiated, not at runtime:

```cnx
register UartPort(u32 baseAddress) {
    DR:   u32 rw @ baseAddress + 0x00,
    CR1:  u32 rw @ baseAddress + 0x04,
    // ...

    pins {
        TX: pin,
        RX: pin,
    }
}

// Bind pins at instantiation
register UART1: UartPort(0x40184000) {
    pins {
        TX: GPIO_AD_B0_12,
        RX: GPIO_AD_B0_13,
    }
};

register UART2: UartPort(0x40188000) {
    pins {
        TX: GPIO_AD_B1_02,
        RX: GPIO_AD_B1_03,
    }
};
```

#### Compile-Time Conflict Detection

The compiler tracks all pin bindings globally and errors on conflicts:

```cnx
register UartPort(u32 baseAddress) {
    DR:   u32 rw @ baseAddress + 0x00,
    // ...

    pins {
        TX: pin,
        RX: pin,
    }
}

// Bind pins at instantiation — compiler tracks globally
register UART1: UartPort(0x40184000) {
    pins {
        TX: GPIO_AD_B0_12,
        RX: GPIO_AD_B0_13,
    }
};

register SPI1: SpiPort(0x40394000) {
    pins {
        MOSI: GPIO_AD_B0_12,  // COMPILE ERROR: GPIO_AD_B0_12 already bound to UART1.TX
    }
};
```

#### Error Messages

```
error: pin conflict — GPIO_AD_B0_12 is already bound

       GPIO_AD_B0_12 is bound to UART1.TX at hal/uart.cnx:15
       Cannot also bind to SPI1.MOSI at hal/spi.cnx:8

       Each physical pin can only be assigned to one peripheral.
```

#### Tradeoffs

This approach is:
- **Simple** — No ownership semantics, no consumed parameters, no tuple returns
- **Static** — Pins permanently bound at compile time, not dynamically claimed/released
- **Sufficient** — Covers 95% of embedded use cases where pin assignments are fixed

For rare cases needing dynamic pin reassignment (e.g., runtime-switchable debug/production pins), users can:
1. Use separate compilation units
2. Use C interop for that specific peripheral
3. Request full typestate pins in a future ADR if demand exists

---

## Part 6: Memory-Mapped I/O Safety Checklist

### Complete Safety Requirements

For **100% statically typed, memory-safe hardware access**, the following must be enforced:

| Category | Requirement | Status |
|----------|-------------|--------|
| **Register Definition** | | |
| | Type-safe register access | ✅ Implemented (ADR-004) |
| | Bitmap types with guaranteed layout | ✅ Implemented (ADR-034) |
| | Parameterized registers | 🔶 This ADR |
| | SVD import tooling | 🔶 This ADR |
| **Access Control** | | |
| | Prevent reads from wo/w1c/w1s | ✅ Implemented |
| | Prevent RMW on wo/w1c/w1s | 🔶 This ADR |
| | Enforce read-only (ro) at compile time | ✅ Implemented |
| | Bitmap field overlap detection | ✅ Implemented (ADR-034 "bits must sum to size") |
| **Concurrency** | | |
| | Atomic register access | ✅ Implemented (`atomic` keyword) |
| | Critical sections | ✅ Implemented (`critical { }`) |
| | ISR-safe volatile semantics | ✅ Implemented |
| **Initialization** | | |
| | Peripheral init ordering (typestate) | 🔶 This ADR |
| | Clock gating requirements | 🔶 This ADR (via typestate) |
| | Pin mux conflict detection | 🔶 This ADR |
| **Code Generation** | | |
| | MISRA-compliant C output | ✅ Implemented |
| | Zero runtime overhead | ✅ Implemented |
| | Const-correct volatile pointers | ✅ Implemented |

### Implementation Phases

**Phase 1: Register Safety**
- [ ] Parameterized registers `register Name(u32 base) { ... }`
- [ ] w1c/w1s RMW prevention (hard error, no escape hatch)
- [ ] svd2cnext tool (basic)

**Phase 2: Peripheral Safety**
- [ ] State declarations `state EnumName { ... }`
- [ ] Stateful scopes `scope Name[StateEnum] { ... }`
- [ ] State transition verification
- [ ] Pin resource tracking

**Phase 3: Tooling**
- [ ] svd2cnext improvements (clusters, arrays, alternateRegister)
- [ ] State machine visualization/documentation generation
- [ ] Clock tree modeling (optional enhancement)

---

## Decision

### Accepted

1. **Parameterized registers** — `register Name(u32 baseAddress) { ... }` with `register Instance: Name(address);` instantiation. Template type serves as interface for generic peripheral code.

2. **w1c/w1s RMW prevention** — Hard compile error for bit-field assignments to write-only registers. No escape hatch. Bitmap `.mask()` helper for ergonomic direct writes.

3. **svd2cnext tool** — TypeScript tool to generate C-Next from SVD files. Includes `--detect-templates` for auto-detecting identical peripheral layouts.

4. **Typestate for peripherals** — Compile-time state machine verification with whole-program analysis. Syntax to be chosen from:
   - Option A: State Graph Declaration
   - Option B: Phase Blocks
   - Option C: Function-Level Annotations

5. **Static pin binding** — Pins declared at register instantiation with compile-time conflict detection. No Rust-style ownership semantics.

### Needs User Input

6. **Typestate syntax** — Which of the three options (State Graph, Phase Blocks, Annotations) fits C-Next best?

---

## References

- [CMSIS-SVD Format](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/) — Rust SVD tool
- [Embedded HAL](https://docs.rs/embedded-hal/latest/embedded_hal/) — Rust embedded traits
- [i.MX RT1060 Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMXRT1060RM.pdf)
- ADR-004: Register Bindings
- ADR-034: Bitmap Types for Bit-Packed Data
