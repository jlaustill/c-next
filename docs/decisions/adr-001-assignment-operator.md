# ADR-001: Assignment Operator

**Status:** Implemented
**Date:** 2025-12-25
**Decision Makers:** C-Next Language Design Team

## Context

The single most common class of bugs in C programming stems from the visual similarity between the assignment operator (`=`) and the equality comparison operator (`==`). This leads to code like:

```c
if (x = 5) {  // BUG: always true, also modifies x
    // ...
}
```

When the programmer intended:

```c
if (x == 5) {  // Correct: comparison
    // ...
}
```

This bug is:
- Easy to write (single keystroke difference)
- Hard to spot during code review (visually similar)
- Syntactically valid (compiles without error)
- Semantically catastrophic (changes program state AND control flow)

### Industry Recognition of This Problem

This issue is so prevalent that it has been formally catalogued and addressed by multiple safety standards:

**CWE-481: Assigning instead of Comparing**
> "The code uses an operator for assignment when the intention was to perform a comparison."
> — [CWE-481](https://cwe.mitre.org/data/definitions/481.html)

**MISRA C:2023 Rule 13.4**
> "The result of an assignment operator should not be used."

This rule exists specifically because "using the assignment operation in subexpressions introduces an additional side effect making the code less readable and more susceptible to new mistakes. Besides, following this rule significantly reduces the risk of confusing the operators '=' and '=='."
— [PVS-Studio V2561](https://pvs-studio.com/en/docs/warnings/v2561/)

**SEI CERT C Coding Standard EXP45-C**
> "Do not perform assignments in selection statements."

The rationale states: "In a noncompliant code example, an assignment expression is the outermost expression in an if statement. Although the intent of the code may be to assign b to a and test the value of the result for equality to 0, it is frequently a case of the programmer mistakenly using the assignment operator = instead of the equals operator ==."
— [SEI CERT EXP45-C](https://wiki.sei.cmu.edu/confluence/display/c/EXP45-C.+Do+not+perform+assignments+in+selection+statements)

**MISRA C:2025**
The newest revision continues to strengthen rules around conditional expressions, including the new Rule 11.11 which states "Pointer shall not be implicitly compared to NULL" — extending protection against ambiguous boolean-context usage.
— [Qt Blog: MISRA C:2025](https://www.qt.io/quality-assurance/blog/misra-c-2025)

### Real-World Bug Examples

**Miranda IM Project:**
```c
if (ret=0) {return (0);}  // Assignment, not comparison!
```
The programmer wrote `ret=0` instead of `ret==0`.
— [PVS-Studio: 100 bugs in Open Source C/C++ projects](https://pvs-studio.com/en/blog/posts/cpp/a0079/)

This class of bug is documented extensively:
> "Notice that the equal sign used in the if statement is actually the assignment operator, not the relational operator, which tests for equality. In this code a is set to 4 because of the assignment, and the expression a = b is always true, because the value of the expression is 4."
> — [Common C Errors](http://pacman128.github.io/internal/common_c_errors/)

## Decision

C-Next uses `<-` for assignment and `=` for comparison:

```
x <- 5;         // assignment: value flows INTO x
if (x = 5)      // comparison: single equals, just like math
```

### Why This Syntax?

**1. Proven in Production: The R Language Experiment**

R has used `<-` for assignment since its inception in 1993, inheriting it from S (1976) which borrowed it from APL (1960s). This represents a **30+ year natural experiment** with millions of users.

> "APL was designed on a specific keyboard, which had a key for `<-`. At that time, it was also chosen because there was no `==` for testing equality: equality was tested with `=`, so assigning a variable needed to be done with another symbol."
> — [Colin Fay: Why do we use arrow as an assignment operator?](https://colinfay.me/r-assignment/)

> "When R's precursor, S, was conceived, APL keyboards and printing heads existed, and these could print a single `←` character."
> — [R-bloggers: Assignment in R](https://www.r-bloggers.com/2018/07/assignment-in-r-slings-and-arrows/)

**2. Community Consensus**

Both major R style guides mandate `<-` over `=`:

- **[Google's R Style Guide](https://google.github.io/styleguide/Rguide.html):** "Use `<-`, not `=`, for assignment."
- **[Tidyverse Style Guide](https://style.tidyverse.org/syntax.html):** "Use `<-`, not `=`, for assignment."

The reasoning is clear:
> "`<-` always means assignment, while the equal sign is overloaded, taking on the roles of an assignment operator, function argument binding, or depending on the context, case statement."
> — [Ken W. Alger: Assignment Operators in R](https://www.kenwalger.com/blog/uncategorized/assignment-operators-r/)

**3. Visual Semantics: Value Flows Into Variable**

The `<-` operator visually represents what's happening: the value on the right *flows into* the variable on the left. This matches the mental model of assignment.

```
counter <- counter + 1;   // "counter receives counter plus one"
```

**4. Mathematical Consistency**

Using `=` for equality matches mathematical notation, which every programmer learned before programming:

```
if (x = 5)    // "if x equals 5" — matches math
```

This eliminates the cognitive overhead of "wait, is this one equals or two?"

## Alternatives Considered

### Alternative 1: Keep C's `=` and `==`

**Rejected.** This preserves the exact problem we're trying to solve. The 50+ years of evidence shows developers continue to make this mistake regardless of experience level.

### Alternative 2: Use `:=` for Assignment (Pascal/Go style)

**Rejected.** While `:=` distinguishes assignment from comparison, it:
- Doesn't have the visual "flow" semantics of `<-`
- Lacks the decades of production validation that R provides
- Doesn't align with the mathematical intuition of `=` for equality

### Alternative 3: Compiler Warnings Only

**Rejected.** Modern C compilers do warn about `if (x = 5)`, but:
- Warnings can be ignored or disabled
- Some legitimate patterns intentionally assign in conditions: `while ((c = getchar()) != EOF)`
- We prefer making bugs impossible over warning about them

### Alternative 4: Require Parentheses for Intentional Assignment

Some C style guides suggest `if ((x = 5))` for intentional assignment.

**Rejected.** This is a workaround, not a solution. It doesn't prevent the accidental case.

## Consequences

### Positive

1. **Eliminates an entire class of bugs** — The `=` vs `==` confusion becomes impossible
2. **Matches mathematical intuition** — `=` means equality, as taught in math class
3. **Proven syntax** — Validated by 30+ years of R language usage
4. **Automatic MISRA/CERT compliance** — Rules EXP45-C and 13.4 are satisfied by design
5. **Visual clarity** — Assignment "looks different" from comparison

### Negative

1. **Learning curve for C developers** — Muscle memory says `=` is assignment
2. **Two keystrokes instead of one** — Minor ergonomic cost
3. **Unfamiliar to non-R developers** — Though visually intuitive

### Neutral

1. **Transpiles to standard C assignment** — No runtime cost
2. **Clear migration path** — Existing C code comparison with `==` will error, prompting review

## Implementation Notes

The transpiler converts:
- `x <- 5;` → `x = 5;` (C assignment)
- `x = 5` → `x == 5` (C comparison)

This is a simple token substitution with no semantic complexity.

## References

### Safety Standards
- [CWE-481: Assigning instead of Comparing](https://cwe.mitre.org/data/definitions/481.html)
- [CWE-482: Comparing instead of Assigning](https://cwe.mitre.org/data/definitions/482.html)
- [SEI CERT C: EXP45-C](https://wiki.sei.cmu.edu/confluence/display/c/EXP45-C.+Do+not+perform+assignments+in+selection+statements)
- [MISRA C:2025 Overview](https://www.qt.io/quality-assurance/blog/misra-c-2025)
- [MISRA C Rule 13.4](https://pvs-studio.com/en/docs/warnings/v2561/)

### R Language Style Guides
- [Google's R Style Guide](https://google.github.io/styleguide/Rguide.html)
- [Tidyverse Style Guide](https://style.tidyverse.org/syntax.html)
- [Advanced R Style Guide (Hadley Wickham)](http://adv-r.had.co.nz/Style.html)

### Historical Context
- [Why do we use arrow as an assignment operator? (Colin Fay)](https://colinfay.me/r-assignment/)
- [Assignment in R: slings and arrows (R-bloggers)](https://www.r-bloggers.com/2018/07/assignment-in-r-slings-and-arrows/)
- [R programming is from S, influenced by APL](https://ingbrief.wordpress.com/2019/10/02/r-programming-is-from-s-influenced-by-apl/)
- [History and Overview of R](https://bookdown.org/rdpeng/rprogdatascience/history-and-overview-of-r.html)

### Bug Documentation
- [100 bugs in Open Source C/C++ projects (PVS-Studio)](https://pvs-studio.com/en/blog/posts/cpp/a0079/)
- [5 common bugs in C programming (Opensource.com)](https://opensource.com/article/21/10/programming-bugs)
- [Common C Errors](http://pacman128.github.io/internal/common_c_errors/)
- [Bugs in C (University of Guelph)](https://craftofcoding.wordpress.com/wp-content/uploads/2019/12/bugsinc.pdf)
