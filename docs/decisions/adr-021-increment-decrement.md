# ADR-021: Increment/Decrement Operators

## Status
**Research**

## Context

C's `++` and `--` operators are convenient but problematic:
- Pre vs post confusion (`++i` vs `i++`)
- Side effects in expressions (`a[i++] = b[++j]`)
- Sequence point issues

Should C-Next include them?

## Decision Drivers

1. **Convenience** - Very common in loops
2. **Safety** - Pre/post distinction causes bugs
3. **Clarity** - Side effects in expressions are confusing
4. **C Familiarity** - Developers expect these operators

## Options Considered

### Option A: No Increment/Decrement
Use compound assignment only:
```cnx
i +<- 1;  // Instead of i++
i -<- 1;  // Instead of i--
```

**Pros:** No ambiguity, no side-effect bugs
**Cons:** More verbose, unfamiliar

### Option B: Statement-Only Increment/Decrement
Allow `i++;` and `i--;` as statements, not expressions:
```cnx
i++;           // OK - statement
i--;           // OK - statement
x <- i++;      // ERROR - not allowed in expression
a[i++] <- 5;   // ERROR - not allowed in expression
```

**Pros:** Convenience without danger
**Cons:** Subtle difference from C

### Option C: Full C-Style
Allow both pre and post in all contexts:
```cnx
i++;
++i;
x <- i++;
a[++i] <- 5;
```

**Pros:** Full C compatibility
**Cons:** All the C bugs

### Option D: Post-Only, Statement-Only
```cnx
i++;  // OK
i--;  // OK
++i;  // ERROR - no prefix form
```

**Pros:** Simpler, still familiar
**Cons:** Arbitrary restriction

## Recommended Decision

**Option B: Statement-Only** - Convenience without side-effect bugs.

## Syntax

### Allowed
```cnx
// As statements
i++;
i--;

// In for loop update
for (u32 i <- 0; i < 10; i++) {
    // ...
}
```

### Not Allowed
```cnx
x <- i++;          // ERROR: not allowed in expression
arr[i++] <- 5;     // ERROR: not allowed in expression
foo(i++);          // ERROR: not allowed in expression
```

### Equivalent Using Compound Assignment
```cnx
i +<- 1;  // Same as i++
i -<- 1;  // Same as i--
```

## Implementation Notes

### Grammar Changes
```antlr
incrementStatement
    : IDENTIFIER '++' ';'
    | IDENTIFIER '--' ';'
    ;

forUpdate
    : assignmentTarget assignmentOperator expression
    | IDENTIFIER '++'
    | IDENTIFIER '--'
    ;
```

### Priority
**Medium** - Convenient but not critical. Compound assignment works.

## Open Questions

1. Allow in for-loop update specifically? `for (i <- 0; i < 10; i++)`
2. Prefix forms at all? `++i`

## References

- C increment/decrement semantics
- Go's approach (statement only, no prefix)
- Rust's approach (no ++ at all)
