# ADR-021: Increment/Decrement Operators

## Status

**Rejected**

## Context

C's `++` and `--` operators are convenient but problematic:

- Pre vs post confusion (`++i` vs `i++`)
- Side effects in expressions (`a[i++] = b[++j]`)
- Sequence point undefined behavior
- Violation of separation of concerns (mutation + value return)

Should C-Next include them?

## Decision Drivers

1. **Separation of Concerns** - Each statement should do one thing only
2. **Safety** - Pre/post distinction and sequence points cause bugs
3. **Clarity** - Side effects in expressions harm comprehension
4. **Precedent** - Modern languages (Go, Rust, Python, Swift) restrict or remove them
5. **C Familiarity** - Developers expect these operators (trade-off)

## Options Considered

### Option A: No Increment/Decrement (Recommended)

Use compound assignment only:

```cnx
i +<- 1;  // Instead of i++
i -<- 1;  // Instead of i--
```

**Pros:** No ambiguity, no side-effect bugs, clean separation of concerns
**Cons:** More verbose, unfamiliar to C programmers

### Option B: Statement-Only Increment/Decrement

Allow `i++;` and `i--;` as statements, not expressions:

```cnx
i++;           // OK - statement
i--;           // OK - statement
x <- i++;      // ERROR - not allowed in expression
a[i++] <- 5;   // ERROR - not allowed in expression
```

**Pros:** Convenience without expression-context danger
**Cons:** Subtle difference from C, still special syntax for `+= 1`

### Option C: Full C-Style

Allow both pre and post in all contexts:

```cnx
i++;
++i;
x <- i++;
a[++i] <- 5;
```

**Pros:** Full C compatibility
**Cons:** All the C bugs, undefined behavior, security vulnerabilities

### Option D: Post-Only, Statement-Only

```cnx
i++;  // OK
i--;  // OK
++i;  // ERROR - no prefix form
```

**Pros:** Simpler, still familiar
**Cons:** Arbitrary restriction, still redundant syntax

## Recommended Decision

**Option A: No Increment/Decrement** - Use compound assignment exclusively.

### Rationale: Separation of Concerns

A core principle of C-Next is that **each statement should do one thing and one thing only**. The `++` and `--` operators violate this by combining two operations:

1. Reading a value
2. Mutating the variable

This dual nature is the root cause of their problems. When an operator both produces a value AND causes a side effect, it creates ambiguity about ordering and makes code harder to reason about.

With compound assignment, the intent is explicit:

```cnx
i +<- 1;  // Clearly: add 1 to i (mutation only, no value produced)
```

There is no question about "did the increment happen before or after?" because the statement does exactly one thing.

## Syntax

### Incrementing and Decrementing

```cnx
i +<- 1;  // Increment
i -<- 1;  // Decrement
```

### For Loops

```cnx
for (u32 i <- 0; i < 10; i +<- 1) {
    // ...
}
```

### Not Allowed

```cnx
i++;               // ERROR: ++ operator does not exist
++i;               // ERROR: ++ operator does not exist
i--;               // ERROR: -- operator does not exist
--i;               // ERROR: -- operator does not exist
```

## Implementation Notes

### Grammar Changes

None required. The `++` and `--` tokens are simply not recognized as operators. Compound assignment (`+<-`, `-<-`) already exists and handles all use cases.

### Priority

**Low** - No implementation work needed. This is a decision to NOT add syntax.

## Research Findings

### Douglas Crockford's Position (JavaScript: The Good Parts, 2008)

> "The ++ (increment) and -- (decrement) operators have been known to contribute to bad code by encouraging excessive trickiness. They are second only to faulty architecture in enabling viruses and other security menaces."

> "In my own practice, I observed that when I used ++ and --, my code tended to be too tight, too tricky, too cryptic. So, as a matter of discipline, I don't use them any more."

While Crockford's critique focused on JavaScript, his concerns originated from C's buffer overflow vulnerabilities enabled by these operators.

### Undefined Behavior Examples (C/C++)

The following expressions have **undefined behavior** due to sequence point violations:

```c
X[i] = ++i;           // Order of evaluation undefined
X[i++] = i;           // Same variable modified and read
j = i++ + ++i;        // Multiple modifications
i = ++i + ++i;        // Chaotic results
```

Real-world bug found by PVS-Studio static analyzer:

```c
// BUG: Compiler can evaluate & operands in either order
while (!(m_pBitArray[m_nCurrentBitIndex >> 5] &
         Powers_of_Two_Reversed[m_nCurrentBitIndex++ & 31]))
```

### Empirical Evidence

An academic study ("An empirical investigation of the influence of a type of side effects on program comprehension") using crossover design found that **side-effect operators significantly reduce performance in comprehension-related tasks**, providing empirical justification for the belief that side effects are harmful.

### Security History

Buffer overflows (CWE-788) "typically occur when a pointer or its index is incremented to a position after the buffer." The Morris Worm (1988)—the first major internet worm—exploited buffer overflows enabled by pointer arithmetic and increment operators.

### Modern Language Precedent

| Language   | Approach                     | Designer's Rationale                                                                                                                                         |
| ---------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Go**     | Statement-only, postfix-only | "By removing them from the expression hierarchy altogether, expression syntax is simplified and the messy issues around order of evaluation are eliminated." |
| **Rust**   | No `++`/`--`                 | "Behavior is subtle and confusing, usage uncommon enough to not warrant syntax complexity."                                                                  |
| **Python** | No `++`/`--`                 | Guido van Rossum: "No good reason to use them, they increase the risk of silly mistakes."                                                                    |
| **Swift**  | Removed in 3.0               | Deprecated due to confusion and minimal benefit over `+= 1`.                                                                                                 |

### Counter-Arguments Considered

From the Airbnb JavaScript style guide discussion:

> "`++` doesn't cause bugs. Using `++` in 'tricky' ways can lead to bugs... but that's not a problem with the operator, it's a problem with the programmer."

This argument has merit for statement-only usage, but C-Next prioritizes:

1. **Consistency** - One way to do things, not two
2. **Simplicity** - No special-case syntax for `+= 1`
3. **Separation of concerns** - Statements should have single responsibility

## References

- [Douglas Crockford on `++`/`--`](http://linterrors.com/js/unexpected-plus-plus) - JSLint enforcement
- [PVS-Studio: Sequence Points](https://pvs-studio.com/en/blog/terms/0065/) - Undefined behavior examples
- [Go Wiki: GoForCPPProgrammers](https://go.dev/wiki/GoForCPPProgrammers) - Go's design rationale
- [Rust Issue #14686](https://github.com/rust-lang/rust/issues/14686) - Rust's design rationale
- [Airbnb JavaScript Issue #540](https://github.com/airbnb/javascript/issues/540) - Community debate
- [Academia: Side Effects Study](https://www.academia.edu/19345143/An_empirical_investigation_of_the_influence_of_a_type_of_side_effects_on_program_comprehension) - Empirical research
- [OWASP: Buffer Overflow](https://owasp.org/www-community/vulnerabilities/Buffer_Overflow) - Security context
- [Wikipedia: Off-by-one Error](https://en.wikipedia.org/wiki/Off-by-one_error) - Common bug patterns
