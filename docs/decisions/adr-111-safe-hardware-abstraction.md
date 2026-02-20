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

#### Type Identity

Each register instance is a distinct type for type-checking purposes:

```cnx
void configureGpio(GPIO1 port) { ... }  // Only accepts GPIO1

configureGpio(GPIO1);  // OK
configureGpio(GPIO2);  // ERROR: GPIO2 is not GPIO1
```

For generic peripheral handling, see Part 4 (Peripheral Traits).

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

1. **Peripheral derivation** — SVD uses `derivedFrom` for identical peripherals; emit as template + instances
2. **Reserved field generation** — Calculate gaps between fields and emit `Reserved[N]`
3. **Field name sanitization** — SVD field names may conflict with C-Next keywords
4. **Cluster handling** — SVD `<cluster>` elements represent register arrays; emit with appropriate indexing
5. **Dim handling** — SVD `<dim>` represents repeated elements; expand or use array syntax

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
3. **Incremental adoption** — Can use without full typestate
4. **Embedded-appropriate** — Works with static allocation, no heap

### Options Considered

#### Option A: Peripheral Scopes with Init Blocks

Leverage C-Next's existing `scope` construct with initialization requirements:

```cnx
scope Uart1 requires clock(UART1_CLK) {
    register UART1: UartPort @ 0x40184000;

    public void init(u32 baud) {
        // Configuration code
    }

    public void send(u8 data) requires init {
        UART1.DR <- data;
    }
}

// Usage
clock.enable(UART1_CLK);  // Satisfies 'requires clock'
Uart1.init(115200);       // Satisfies 'requires init'
Uart1.send(0x55);         // Now allowed
```

**Analysis:**
- `requires` clauses checked at compile time via call graph analysis
- Works for simple linear initialization sequences
- Doesn't handle runtime-conditional initialization

#### Option B: State Machine Types

Explicit state encoding in types:

```cnx
state UartState { Disabled, Initialized, Enabled }

scope Uart1 {
    state: UartState <- Disabled;

    public Uart1[Initialized] init(Uart1[Disabled] self, u32 baud) {
        // Returns Uart1 in Initialized state
    }

    public void send(Uart1[Enabled] self, u8 data) {
        // Requires Enabled state
    }
}
```

**Analysis:**
- More expressive than Option A
- Requires significant type system additions
- Higher learning curve

#### Option C: Compile-Time Assertions

Simpler approach using static assertions:

```cnx
scope Uart1 {
    static initialized: bool <- false;

    public void init(u32 baud) {
        // ...
        initialized <- true;
    }

    public void send(u8 data) {
        static_assert(initialized, "UART1 must be initialized before send");
        // ...
    }
}
```

**Analysis:**
- Leverages existing language features
- Limited to compile-time-known state
- Doesn't prevent runtime ordering issues

### Decision: Full Typestate

C-Next will implement compile-time typestate for peripheral initialization safety. Invalid state transitions are compile errors, not runtime bugs.

### Specification: Typestate for Peripherals

#### State Declarations

Peripherals declare their possible states using a `state` enum:

```cnx
state UartState { Disabled, Configured, Enabled }
state GpioState { Unclaimed, Input, Output, Alternate }
state DmaState  { Idle, Configured, Running }
```

#### Stateful Scopes

Scopes can be parameterized by state:

```cnx
scope Uart1[UartState] {
    register UART: UartPort(0x40184000);

    /// Transition from Disabled → Configured
    public Uart1[Configured] init(Uart1[Disabled] self, u32 baud) {
        // Enable clock, configure pins, set baud
        CCM.CCGR5[12, 2] <- 0b11;
        UART.UCR1 <- 0x0001;
        // ...
    }

    /// Transition from Configured → Enabled
    public Uart1[Enabled] enable(Uart1[Configured] self) {
        UART.UCR2[0] <- true;  // Enable transmitter
    }

    /// Only callable in Enabled state
    public void send(Uart1[Enabled] self, u8 data) {
        while (UART.USR1[13] = false) { }
        UART.UTXD <- data;
    }

    /// Transition from Enabled → Disabled
    public Uart1[Disabled] deinit(Uart1[Enabled] self) {
        UART.UCR1 <- 0x0000;
        CCM.CCGR5[12, 2] <- 0b00;
    }
}
```

#### Usage

```cnx
void main() {
    // Uart1 starts in Disabled state
    Uart1.send(0x55);           // COMPILE ERROR: Uart1 is Disabled, send requires Enabled

    Uart1.init(115200);         // Uart1 transitions to Configured
    Uart1.send(0x55);           // COMPILE ERROR: Uart1 is Configured, send requires Enabled

    Uart1.enable();             // Uart1 transitions to Enabled
    Uart1.send(0x55);           // OK: Uart1 is Enabled
    Uart1.send(0x48);           // OK: still Enabled

    Uart1.deinit();             // Uart1 transitions to Disabled
    Uart1.send(0x00);           // COMPILE ERROR: Uart1 is Disabled
}
```

#### Initial State

Scopes have a default initial state (first enum value) or can be explicitly initialized:

```cnx
// Default: Uart1 starts as Disabled (first state in UartState)
scope Uart1[UartState] { ... }

// Explicit: Uart1 starts as Configured
scope Uart1[UartState <- Configured] { ... }
```

#### State-Independent Methods

Methods without state parameters work in any state:

```cnx
scope Uart1[UartState] {
    /// Works in any state
    public UartState getState(Uart1 self) {
        // Return current state (compiler tracks this)
    }

    /// Works in any state, returns to same state
    public void clearErrors(Uart1 self) {
        UART.USR1 <- 0xFFFF;  // Clear all flags
    }
}
```

#### Conditional State (Runtime Branching)

When state depends on runtime conditions, use state unions:

```cnx
scope Uart1[UartState] {
    /// May succeed or fail — returns either Enabled or Configured
    public Uart1[Enabled | Configured] tryEnable(Uart1[Configured] self) {
        if (hardware_ready()) {
            UART.UCR2[0] <- true;
            return self[Enabled];
        } else {
            return self[Configured];
        }
    }
}

// Usage requires handling both cases
void main() {
    Uart1.init(115200);
    match Uart1.tryEnable() {
        Uart1[Enabled] -> {
            Uart1.send(0x55);  // OK
        }
        Uart1[Configured] -> {
            // Handle failure, can't send
        }
    }
}
```

#### Transpilation

Typestate is erased at compile time — no runtime overhead:

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

The state machine is verified during compilation, then discarded. Generated C has zero typestate overhead.

#### Error Messages

```
error: cannot call 'Uart1.send' — Uart1 is in state 'Configured'
       'send' requires state 'Enabled'

       Did you forget to call 'Uart1.enable()'?

       State transitions available from 'Configured':
         - enable() → Enabled
         - deinit() → Disabled
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

### Specification: Pin Resource Tracking

#### Pin Type with Typestate

Pins are first-class types with their own state machine:

```cnx
state PinState { Unclaimed, Gpio, Alternate }

/// Pin declaration — each physical pin is a unique type
pin GPIO_AD_B0_12[PinState];
pin GPIO_AD_B0_13[PinState];
// ... all MCU pins declared
```

#### Peripheral Pin Requirements

Peripherals declare which pins they need and in what state:

```cnx
scope Uart1[UartState] {
    register UART: UartPort(0x40184000);

    /// Requires two unclaimed pins, claims them as Alternate
    public Uart1[Configured] init(
        Uart1[Disabled] self,
        GPIO_AD_B0_12[Unclaimed] tx,
        GPIO_AD_B0_13[Unclaimed] rx,
        u32 baud
    ) -> (Uart1[Configured], GPIO_AD_B0_12[Alternate], GPIO_AD_B0_13[Alternate]) {
        // Configure IOMUXC for UART function
        IOMUXC.MUX_GPIO_AD_B0_12 <- 0x02;  // ALT2 = UART1_TX
        IOMUXC.MUX_GPIO_AD_B0_13 <- 0x02;  // ALT2 = UART1_RX
        // ... rest of init
    }

    /// Returns pins to Unclaimed when peripheral is disabled
    public Uart1[Disabled] deinit(
        Uart1[Enabled] self,
        GPIO_AD_B0_12[Alternate] tx,
        GPIO_AD_B0_13[Alternate] rx
    ) -> (Uart1[Disabled], GPIO_AD_B0_12[Unclaimed], GPIO_AD_B0_13[Unclaimed]) {
        // Release pins
    }
}
```

#### Compile-Time Conflict Detection

```cnx
void main() {
    // All pins start Unclaimed
    Uart1.init(GPIO_AD_B0_12, GPIO_AD_B0_13, 115200);
    // GPIO_AD_B0_12 is now Alternate

    Spi1.init(GPIO_AD_B0_12, ...);  // COMPILE ERROR: GPIO_AD_B0_12 is Alternate, needs Unclaimed
}
```

#### GPIO Pin Usage

```cnx
scope Gpio[GpioState] {
    /// Claim a pin for GPIO output
    public Gpio[Output] asOutput(
        pin[Unclaimed] p
    ) -> (Gpio[Output], pin[Gpio]) {
        // Configure as GPIO output
    }

    public void setHigh(Gpio[Output] self) { ... }
    public void setLow(Gpio[Output] self) { ... }
}

void main() {
    Gpio led <- Gpio.asOutput(GPIO_AD_B0_03);
    led.setHigh();  // OK
    led.setLow();   // OK

    // Can't use GPIO_AD_B0_03 for anything else — it's in Gpio state
    Uart2.init(GPIO_AD_B0_03, ...);  // COMPILE ERROR: pin is Gpio, needs Unclaimed
}
```

#### Alternative: Simplified Pin Binding (Less Type-Safe)

For simpler use cases, pins can be bound at peripheral declaration time:

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

This is simpler but less flexible — pins are permanently bound at compile time rather than dynamically claimed/released via typestate.

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

1. **Parameterized registers** — `register Name(u32 baseAddress) { ... }` with `register Instance: Name(address);` instantiation

2. **w1c/w1s RMW prevention** — Hard compile error for bit-field assignments to write-only registers. No escape hatch — if hardware needs RMW, mark it `rw`, not `w1c`.

3. **svd2cnext tool** — TypeScript tool to generate C-Next from SVD files

4. **Full typestate** — Compile-time state machine verification for peripheral initialization using `scope Name[StateEnum]` syntax. Zero runtime overhead.

5. **Pin mux tracking** — Static conflict detection via pin declarations in register blocks

---

## References

- [CMSIS-SVD Format](https://arm-software.github.io/CMSIS_5/SVD/html/index.html)
- [svd2rust](https://docs.rs/svd2rust/latest/svd2rust/) — Rust SVD tool
- [Embedded HAL](https://docs.rs/embedded-hal/latest/embedded_hal/) — Rust embedded traits
- [i.MX RT1060 Reference Manual](https://www.nxp.com/docs/en/reference-manual/IMXRT1060RM.pdf)
- ADR-004: Register Bindings
- ADR-034: Bitmap Types for Bit-Packed Data
