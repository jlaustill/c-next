# ADR-071: Constant Expressions

**Status:** Research
**Date:** 2026-10-03
**Decision Makers:** Language Design Team
**Related ADRs:** ADR-017 (Enums), ADR-023 (sizeof), ADR-036 (Multi-Dimensional Arrays), ADR-007 (Bit Indexing and Slices), ADR-025 (Switch Statements), ADR-024 (Type Casting), ADR-044 (Primitive Types and Overflow), ADR-052 (Safe Numeric Literals), ADR-057 (Name Binding)
**Related Issues:** #1175 (array dimensions), #1669 (enum member values), #1728 (leading-zero literals), #1861, #1862

## Context

Four ADRs require a value known at compile time and call it a constant expression. An array's
size "must be constant expression (no VLAs)" (ADR-023). A `switch` case label takes "constant
expressions only" (ADR-025). A slice's offset and length must be "literals or `const`
variables" (ADR-007). ADR-052 lists constant expressions among the places a literal is
generated. ADR-017's grammar gives an enum member an expression as its value:

```ebnf
enumMember ::= IDENTIFIER ( "<-" expression )?
```

ADR-017 also assigns member values "like C", and in C an enumerator's value is an integer
constant expression. **No ADR says what a constant expression is.** In the gap, the transpiler
decides by the expression's spelling. Measured on 2026-10-03, in C and C++ alike:

| C-Next                                                  | Generated                         | What goes wrong                                        |
| ------------------------------------------------------- | --------------------------------- | ------------------------------------------------------ |
| `enum E { A <- 1 + 2, B }`                              | `E__A = 1, E__B = 2`              | exit 0; the values are 3 and 4                         |
| `enum E { A <- 0x10 + 1 }`                              | `E__A = 16`                       | exit 0; the value is 17                                |
| `enum E { A <- -0x1 }`                                  | `E__A = 0`                        | exit 0; a negative value that E0894 exists to reject   |
| `const u32 FOO <- 3;` `enum E { A <- FOO }`             | none                              | `1:0 Code generation failed`: no code and no position  |
| `u8[1 - -1] neg;`                                       | `.c`: `neg[2]`; `.h`: `neg[1--1]` | the header does not compile: C reads `--` as decrement |
| `u8[(u32)EColor.COUNT + 1] c;`                          | `.h`: `c[(u32)EColor__COUNT+1]`   | a C-Next type name in C; the header does not compile   |
| `const u8 LOCAL <- 8;` `struct Info { u8[(LOCAL)] p; }` | `uint8_t p[(LOCAL)];`             | the header does not compile: `'LOCAL' undeclared here` |
| `void f(u32 n) { u8[n] arr; arr[0] <- 1; }`             | `uint8_t arr[n] = {0};`           | exit 0; a variable-length array, which ADR-023 forbids |

Three faults share one cause:

1. **What folds depends on the spelling, not the meaning.** `1 + 2` folds as a dimension and
   `1 + 2 + 3` does not.
2. **One expression gets two values.** The `.c` and the `.h` above disagree about the size of
   `neg`, and two translation units that disagree about a type's size have an ABI mismatch.
3. **An expression that is not folded is copied into the C as source text, without its
   spacing.** That text can name things C does not know (`u32`, a C-Next `const`), and it can
   become a different operator once its tokens are joined (`1 - -1` becomes `1--1`).

## Decision

### 1. What a constant expression is

A **constant expression** is an integer-valued expression that C-Next evaluates when it
compiles the program. Its operands are only:

- integer literals (ADR-052);
- names of constants that have a value (§3), bound by ADR-057's rules from where the
  expression is written. The constant may be declared in this file or in any file it includes,
  directly or transitively;
- qualified enum members (`EColor.COUNT`), whose value is the member's value (ADR-017). An
  enum member is an operand on the same terms it is anywhere else in the language. This ADR
  adds no rule of its own about enum arithmetic;
- `sizeof` of a primitive type, whose size the language fixes (ADR-023).

Its operators are the integer operators the language already defines:

- unary `-` and `~`;
- binary `*`, `/`, `%`, `+`, `-`, `<<`, `>>`, `&`, `^` and `|`;
- parentheses;
- a cast to an integer type (ADR-024);
- `c ? a : b`, where the condition `c` is built from `=`, `!=`, `<`, `<=`, `>`, `>=`, `&&`,
  `||` and `!` over constant expressions.

Nothing else is a constant expression. That includes:

- a variable or a parameter;
- a function call;
- an array element or a struct field;
- a floating-point operand (ADR-024);
- a string;
- `sizeof` of an expression, or of a type whose size the target decides, such as a struct.

### 2. Where a constant expression is required

- **An enum member's value** (ADR-017).
- **An array dimension** (ADR-023, ADR-036), at every place an array can be declared: file
  scope, a scope member, a local, and a struct field.

Two positions keep the restrictions their own ADRs place on them. ADR-025's grammar limits a
case label to a literal or a name, so `case K + 1` is a syntax error. ADR-007 limits a slice's
offset and length. This ADR does not widen either one.

### 3. Constants that have a value

A `const` of an integer type **has a value** when its initializer is a constant expression and
its declared type holds that value. Two kinds of `const` have no value:

- `const u8 B <- 300`, which is also rejected in its own right;
- a `const` of a floating-point type.

A constant that has no value is still a constant object. It cannot be an operand of a constant
expression.

### 4. How a constant expression is evaluated

**A constant expression's value is the value the same expression has when the program runs.**
Every rule below follows from that.

- Arithmetic is exact. A literal has no type of its own (ADR-052).
- An operation whose operands are typed has the type it has at run time (ADR-024). A constant's
  type is its declared type, and a cast's type is the type it names. The operation has a value
  only when its type holds the exact result. When the type cannot hold it, the program would
  clamp or wrap at that point (ADR-044). Folding the exact value would then give the constant a
  value the program never computes, so the expression is not constant.
- `/` and `%` truncate toward zero, as in C. Division or modulo by zero is not constant, and
  E0800 reports it (ADR-051).
- A shift amount must not be negative. When the left operand is typed, the amount must also be
  less than its type's width. A left shift of an untyped literal is exact: `1 << 4` is 16.
- `&`, `|` and `^` act on the two's-complement representation of their operands.

### 5. One value, emitted as a value

A constant expression has exactly **one** value. Every part of the program uses that value:
the check that bounds a constant subscript (ADR-036), the generated `.c`, and the generated
`.h`. The generated C carries the value as an integer literal, never the expression's source
text:

```cnx
const u8 LOCAL <- 8;
u8[1 - -1] neg;
struct Info { u8[(LOCAL) * 2] p; }
```

```c
/* .h, and the .c alike */
extern uint8_t neg[2];
    uint8_t p[16];          /* the field, inside struct Info */
```

A name that an included C or C++ header defines as a macro has no value C-Next computes. In an
array dimension, where C can evaluate it, the dimension is emitted for C to evaluate. It is
written from the expression's structure, never copied from its source text, so the `.c` and
the `.h` carry the same expression: `u8[BUF_SIZE + 1]` keeps `BUF_SIZE + 1`.

### 6. Where a constant expression is required and not given

A position that requires a constant expression and is given anything else is rejected with
**E0909**, reported at the expression. A dimension that names a variable or a parameter is
included, because C-Next has no variable-length arrays (ADR-023):

```cnx
void f(u32 n) {
    u8[n] arr;      // error[E0909]: an array dimension must be a constant expression
}

const u32 FOO <- 3;
enum E {
    A <- FOO + 1,   // 4
    B,              // 5
    C <- f(),       // error[E0909]: an enum member's value must be a constant expression
}
```

**What compiles changes:**

- A dimension that names a variable is rejected. It used to produce C that does not compile:
  either an initialized variable-length array, or an array at file scope whose size is not an
  integer constant expression.
- An enum member value written as a constant expression now gets its true value. `A <- 1 + 2`
  was 1 and is 3. Measured on 2026-10-03, no explicit enum value in the conformance corpus is
  anything but a single literal: 0 of 203.

### Rejected alternatives

- **An enum member's value may only be an integer literal.** No program in the corpus would
  break, but it narrows syntax ADR-017's grammar already admits. It would also make an enum
  value the one compile-time position where a constant cannot be named, while ADR-007 and
  ADR-023 both accept one.
- **Fold a recognized set of shapes, such as a literal, a name, or two operands with one
  operator.** This is the failure mode itself: each new shape that is not on the list leaks,
  and adding shapes one at a time never closes the category (#1175).
- **Copy an expression that does not fold into the C as source text.** C may not know what the
  text names. Where it does, two translation units can fold the same dimension differently. And
  source text without its spacing can re-tokenize as different operators.

## Diagnostics

| Code  | Meaning                                                                                                                                         | Asserted by                                  |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| E0909 | A position that requires a constant expression is given something else: a variable, a call, a value its type cannot hold, or a division by zero | added with the implementation (#1175, #1669) |

## Scope-Context Matrix (#1219)

Declared for the rule that a constant expression has one value, computed from the constants
in view where it is written, and that a non-constant one is rejected.

<!-- MATRIX-SEVERITY -->

| Context            | Relationship        | Severity |
| ------------------ | ------------------- | -------- |
| global variable    | same file           | error    |
| top-level function | same file           | error    |
| scope member       | same file           | error    |
| scope method       | same file           | error    |
| global variable    | imported direct     | error    |
| top-level function | imported direct     | error    |
| scope member       | imported direct     | error    |
| scope method       | imported direct     | error    |
| global variable    | imported transitive | error    |
| top-level function | imported transitive | error    |
| scope member       | imported transitive | error    |
| scope method       | imported transitive | error    |

All twelve cells are `error`. An array dimension can be written in each of the four contexts:
at file scope, as a scope member, and as a local in a function or a scope method. The constant
it names can be declared in the same file or one or two includes away. A checker that read only
the file it was looking at would find no value for an included constant, and the dimension
would reach C as text. That is the failure in the Context table, so the imported cells are the
ones this ADR most needs to hold.

An enum member's value occupies no cell of its own. An enum declaration is neither a function
nor a variable declaration, so the context axis cannot place it. The enum position is held to
account by its own fixtures, which the matrix does not see.

## Consequences

- The `.c` and the `.h` can no longer disagree about an array's size, because both are written
  from one value.
- No C-Next name reaches the generated C through a dimension, an enum member's value, or a
  constant's initializer.
- The generated C changes wherever a dimension that used to be emitted as text now folds. That
  count is measured with the implementation and recorded on #1175.
- The value rule in §4 is stricter than C when C would wrap. A program cannot get a constant
  that differs from what it computes at run time, which is the point.

## Open Questions

1. **`~`, and `>>` of a negative value, on an untyped literal.** `~0` has no width until it
   has a type. Recommendation: not constant until decided. Write `~(u32)0`.
2. **A header macro as an enum member's value** (`A <- RCC_MODE`). C-Next needs the value for
   auto-increment, for E0894, and for the range check #1862 adds. Recommendation: rejected with
   E0909 for now. Accepting it later breaks nothing.
3. **An earlier member of the same enum as an operand** (`RW <- (u8)Perm.READ | (u8)Perm.WRITE`
   inside `enum Perm`). C allows an enumerator to use the enumerators declared before it.
   Recommendation: allow members declared earlier, and reject the member itself and any later
   member, since either would make a cycle.
4. **A leading-zero literal** (`010`) is decided by #1728.
5. **The range of an enum member's value** is decided by #1862.

## References

- #1175: an array dimension that does not fold leaks C-Next source text into C
- #1669: enum member values were read with a prefix parser
- #1861: a private scope `const` inlined as source text without its spacing
- ISO/IEC 9899:1999 §6.6 (constant expressions), §6.7.2.2 (enumeration specifiers), §6.7.5.2
  (array declarators)
- MISRA C:2012 Rule 18.8 (variable-length array types shall not be used)
