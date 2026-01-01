# ADR-022: Conditional Expressions (If/Else and Ternary)

## Status
**Implemented**

## Context

Conditional control flow is fundamental to any programming language. C-Next needs to support:
1. **If/else statements** - Standard conditional branching
2. **Ternary operator** - Inline conditional expressions

---

## Part 1: If/Else Statements (Implemented)

### Decision

**Use standard C-style if/else syntax** - It's familiar, clear, and works well.

### Syntax

```cnx
// Basic if
if (condition) {
    doSomething();
}

// If/else
if (x > 0) {
    handlePositive();
} else {
    handleNonPositive();
}

// If/else-if/else chain
if (x > 0) {
    doPositive();
} else if (x < 0) {
    doNegative();
} else {
    doZero();
}
```

### Key Differences from C

1. **Comparison operator** - Uses `=` for equality (not `==`)
2. **Assignment operator** - Uses `<-` (not `=`), eliminating the classic `if (x = 5)` bug

```cnx
// C-Next prevents accidental assignment in conditions
if (x = 5) {      // This is COMPARISON (equals 5?)
    // ...
}

// Assignment would be:
x <- 5;           // Clear and distinct
```

### Implementation Notes

**Grammar:**
```antlr
ifStatement
    : 'if' '(' expression ')' block ('else' 'if' '(' expression ')' block)* ('else' block)?
    ;
```

**Code Generation:**
Direct mapping to C with operator translation:
```c
// C-Next: if (x = 5)
// C output: if (x == 5)
```

---

## Part 2: Ternary Operator (Accepted)

### Decision

**Standard C ternary with safety constraints:**
1. **Parentheses required** around the condition
2. **Boolean condition required** - must be an explicit comparison
3. **No nesting allowed** - nested ternaries are a compile error

### Decision Drivers

1. **Convenience** - Avoids verbose if/else for simple cases
2. **Expression Context** - Works where statements don't
3. **Readability** - Can be clearer OR more confusing
4. **C Compatibility** - Familiar syntax
5. **MISRA Compliance** - Follows safety-critical coding standards

### MISRA C Alignment

C-Next's ternary constraints align with these MISRA C rules:

| Rule | Requirement | C-Next Approach |
|------|-------------|-----------------|
| **14.4** | Condition must have essential Boolean type | Required: explicit comparison |
| **14.3** | Condition must not be invariant | Compiler can warn |
| **13.4** | Assignment results should not be used | `<-` syntax prevents this |
| **12.1** | Use parentheses to make precedence explicit | Required: parentheses mandatory |

#### MISRA Rule 14.4 - Boolean Condition

```cnx
// ERROR: integer used as condition (not boolean)
i32 x <- 5;
i32 y <- x ? 1 : 0;           // x is not a boolean expression

// OK: explicit comparison produces boolean
i32 y <- (x != 0) ? 1 : 0;    // explicit comparison
```

#### MISRA Rule 12.1 - Explicit Precedence

```cnx
// ERROR: parentheses required around condition
i32 result <- a = b ? a : a - b;

// OK: parentheses make precedence explicit
i32 result <- (a = b) ? a : (a - b);
```

#### MISRA Rule 13.4 - No Assignment in Expression

C-Next's `<-` assignment operator naturally prevents this class of bugs:

```c
// C: Non-compliant - using assignment result
y = (x = getValue()) ? x : default;
```

```cnx
// C-Next: This pattern isn't possible with <- syntax
// Must write it clearly:
x <- getValue();
y <- (x != 0) ? x : default;
```

### Options Considered

#### Option A: Standard C Ternary (with constraints) - SELECTED
```cnx
u32 max <- (a > b) ? a : b;
u32 abs <- (x < 0) ? -x : x;
```

**Pros:** Familiar, concise, MISRA-compliant with our constraints
**Cons:** Slightly more restrictive than C

#### Option B: Keyword-Based
```cnx
u32 max <- if a > b then a else b;
```

**Pros:** More readable
**Cons:** Unfamiliar, longer

#### Option C: No Ternary
Use if/else statements only.

**Pros:** Forces explicit code
**Cons:** Verbose, can't use in expressions

### Syntax

#### Valid Usage
```cnx
// Simple conditional - parentheses required, boolean expression required
u32 result <- (x > 0) ? x : 0;

// With equality comparison (= is comparison in C-Next)
bool isEven <- (n % 2 = 0) ? true : false;

// Min/max
u32 min <- (a < b) ? a : b;
u32 max <- (a > b) ? a : b;

// Default value with null check
u32 value <- (ptr != null) ? ptr.value : 0;
```

#### Errors
```cnx
// ERROR: No parentheses around condition
u32 result <- x > 0 ? x : 0;
//            ^~~~~ missing parentheses

// ERROR: Condition is not a boolean expression
u32 result <- (x) ? 1 : 0;
//             ^ not a boolean expression, use (x != 0)

// ERROR: Nested ternaries not allowed
u32 sign <- (x > 0) ? 1 : (x < 0) ? -1 : 0;
//                        ^~~~~~~~~~~~~~ nested ternary not allowed

// Use if/else instead:
i32 sign;
if (x > 0) {
    sign <- 1;
} else if (x < 0) {
    sign <- -1;
} else {
    sign <- 0;
}

// ERROR: Nested ternary in clamp pattern
u32 clamped <- (x < min) ? min : (x > max) ? max : x;
//                               ^~~~~~~~~~~~~~~ nested ternary not allowed

// Use a function or if/else instead:
u32 clamped <- clamp(x, min, max);
```

### Implementation Notes

#### Grammar
```antlr
// Ternary cannot contain another ternary - enforced in semantic analysis
conditionalExpression
    : '(' booleanExpression ')' '?' nonTernaryExpression ':' nonTernaryExpression
    ;

booleanExpression
    : comparisonExpression
    | logicalExpression
    ;
```

#### Semantic Checks
1. Verify condition is wrapped in parentheses
2. Verify condition is a boolean expression (comparison or logical op)
3. Verify neither branch contains a ternary operator
4. Verify both branches have compatible types

#### Code Generation
Direct pass-through to C:
```c
// C-Next: (x > 0) ? x : 0
// C output: (x > 0) ? x : 0
```

#### Priority
**Medium** - Useful but if/else covers most cases.

---

## References

- C conditional statements
- C ternary operator
- [MISRA C:2023 Rule 12.1 - Operator Precedence](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule12.1.html)
- [MISRA C:2023 Rule 13.4 - Assignment Results](https://www.mathworks.com/help/bugfinder/ref/misrac2023rule13.4.html)
- [MISRA C:2012 Rule 14.3 - Invariant Expressions](https://www.mathworks.com/help/bugfinder/ref/misrac2012rule14.3.html)
- [PVS-Studio V2584 - Essential Boolean Type](https://pvs-studio.com/en/docs/warnings/v2584/)
