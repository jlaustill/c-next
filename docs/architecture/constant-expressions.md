# Constant expressions: one value, decided once

How the transpiler decides what a value fixed at compile time is worth: an
array dimension, an enum member's value, a const's initializer, and every
operand an analyzer needs as a number (#1175, #1669). The language rules are
ADR-017 "Member Values", ADR-023 (no variable-length arrays) and ADR-044 "Values
fixed at compile time". This document is how the implementation meets them.

## What was wrong

Five places each decided what a constant expression was worth, and they
disagreed:

| Decider                            | Where     | What it did                                                                    |
| ---------------------------------- | --------- | ------------------------------------------------------------------------------ |
| `ArrayDimensionParser`             | 1.3 - 2.3 | regexes over `getText()`: a literal, a name, one operator between two words    |
| `ExpressionEvaluator`              | 1.3       | `parseInt` for an enum value: `1 + 2` was 1, `0x10 + 1` was 16, `-0x1` was 0   |
| `BinaryExprUtils.tryFoldConstants` | 2.3       | folded generated C operand text, so a `.c` dimension could fold where the `.h` |
| `OperandTyper.constantOf`          | 2.1       | a literal under minus signs or a bound name; arithmetic was "a runtime value"  |
| `LiteralEvaluator`                 | none      | no production caller; deleted (#1418)                                          |

What did not fold was copied into the C as `getText()`, which ANTLR builds by
joining tokens with no separator. So `u8[1 - -1]` was `neg[2]` in the `.c`
(render's fold) and `neg[1--1]` in the `.h`, which C reads as a decrement; and
`(LOCAL)`, `u32` and `src.element_count` reached headers as names C cannot see.

## The design

```
1.3 Declare     tree --ConstExprLowering--> TConstExpr  (plain data, on the symbol)
1.4 Resolve     TConstExpr --ConstantEvaluator + ConstantNames--> number | C | nothing
2.1 Analyze     the same, through Program; nothing is E0909 / E0910 / E0911
2.3 Render      a value is written as its number; C-only (a macro) by ConstExprPrinter
```

### `TConstExpr`: the expression as plain data

`src/types/TConstExpr.ts`. Literals, names (with their whole path and the
position they are written at), `sizeof`, casts, unary, binary and ternary
nodes, and `other` for what no constant contains (a call, a subscript, a float),
carrying its spelling for a message. A literal keeps its value as decimal
digits: a u64 is past what a `number` holds exactly, and a `bigint` is not JSON,
while a symbol must stay JSON-encodable (#1298).

### Why neither the tree nor text can reach 1.4

| Representation             | Verdict    | Why                                                                                                                                        |
| -------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| the parse tree             | out        | Tier 1, short lifetime: 1.3 does not re-export it (#1317, `parse-tree-confined-to-parser`)                                                 |
| `getText()`, re-parsed     | out        | unsound: `(LIM < -1)` reads back as `(LIM<-1)`, and `<-` is assignment. Re-parsing it fails with `no viable alternative at input '(LIM<-'` |
| the source span, re-parsed | rejected   | lexically sound, but 1.4 would re-run 1.2, and the 2.x callers would keep a second input form                                              |
| plain data from the tree   | the design | Tier 1, serializable, lowered once where the tree is in hand, and never re-lexed                                                           |

### `ConstExprLowering`: tree to plain data

`src/utils/ConstExprLowering.ts`. Every binary level from `||` to `*` is one
left-associative chain, so `1 + 2 + 3` is `(1 + 2) + 3`. A leading-zero literal
lowers to `other` (#1728's interim answer: no value until #1728 decides whether
it is octal, so no reading disagrees with what C reads). `lowerNode` takes any
expression-level node, for a caller holding an operand rather than an
`expression`. It is the one module here that names parse contexts.

### `ConstantEvaluator`: the one rule

`src/utils/ConstantEvaluator.ts`. A constant expression's value is the value
the same expression has when the program runs (ADR-044):

- arithmetic is exact (`bigint`);
- an operation happens at its typed operands' width, the wider of two
  (ADR-024); an untyped literal takes the other operand's type, else its
  context's -- the type it is written into, passed as `context` -- else `i32`
  (ADR-044 "Integer Literals": the smallest type that fits the context at
  compile time). A cast is the context of what it encloses;
- a suffixed literal must fit its type (`300u8` does not), and a comparison
  happens at its operands' type too (`N > -1` with a u32 `N` has no value);
- where that type cannot hold the result, the answer is `overflow`, not a
  value -- the program would clamp or wrap there;
- division or modulo by zero, and a negative shift, have no value;
- a ternary and `&&`/`||` evaluate only what C evaluates (C99 6.6p3).

A name is the environment's to answer (`IConstantEnvironment`), because only
the pass evaluating knows what is in view. A name only C knows makes the whole
expression `foreign` -- unless an operand beside it has no value: a ternary
whose condition only C knows still needs both arms, so `MACRO ? 4 : n` is no
value, not a variable-length array.

### `ConstantNames`: what a name is worth

`src/PARSE/4-Resolve/ConstantNames.ts`. One walk from the binder's answer for a
chain's head: a local or a const with a folded value (typed by its
declaration); a scope's member or an enum's, found by C name; a header's bare
name (`foreign`); in a file that includes a header, a bare name nothing binds
may be a macro, since a `#define` never reaches the symbol model (`foreign`,
why `maybeHeader`); anything else has no value, with a reason for the message.
Only a bare name is `foreign`, because C evaluates it as written: C has no
spelling of `X.y` that C-Next could write for a header's `X`.

1.4 asks it while it settles, and every later pass asks it through
`IProgram.constantValueOf`, with the same facts (`IConstantNameFacts`). That is
what makes `u8[N]` one size in the `.c` and the `.h`.
`IProgram.constantOf(binding)` answers through the same walk.

### Settling in 1.4

`Program.deriveConstants` settles every file-scope and scope const and every
C-Next enum in one worklist, because each may name the other
(`const u32 N <- (u32)EColor.COUNT`, `A <- N + 1`). An item waits on the C names
it found unsettled and is retried only when one settles. An enum publishes the
members that have settled while the rest wait (`partialEnums`), so an enum and a
const, or two enums, that name each other's settled members settle in either
order (#1863 review: settling a whole enum at a time made declaration order
decide). An enum whose wait cannot end -- it names a const with no value, or a
cycle -- settles last, with what it waited on counted as having none.

A const settles by `ConstantFold.constValue`, the one rule for a file-scope,
scope and local const: its initializer evaluated at its declared type, its
context, and a value only when that type holds it. What settles is a
`TSettledConst`: the value as decimal digits, exact for a u64 and JSON-safe, or
why there is none, which a use of the const repeats ("its initializer overflows
u8").

`Program.settleValues` runs the consts and the dimensions in rounds, because a
const may read a dimension through a length property
(`const u32 K <- arr.element_count`). The consts settle again only while one has
no value and a dimension moved, so a program that converges in one round costs
one.

An enum's members are computed by `EnumMemberValues` (`src/utils`), shared
with nothing else: ADR-017's auto-increment, the `i32` range, and "a member may
name members of its enum declared above it, with no cast". `ownMember` is how
the environment answers a member of the enum being computed: the member itself
and those below it have no value yet.

`Program.resolveDimensions` settles each dimension 1.3 could not size, and
`LexicalFrames.settle` does the same for locals, against the sized symbols,
both by `ConstantFold.dimension`: its value; for a `foreign` one, its C from
`ConstExprPrinter`; otherwise `UNRESOLVED_DIMENSION`, which 2.1 reports before
anything emits it. A function's parameter dimensions are settled once more
through the frames' own settled declarations (`settledOf`), so a parameter
sized by an earlier one (`u8[a.element_count] b`) reads what its frame settled,
and the header writes the same size the `.c` does.

### Reporting in 2.1

- `ConstantDimensionAnalyzer` listens on the grammar's dimension nodes, so
  every position -- a declaration at any scope, a struct field, a parameter --
  is checked by construction: E0909 (no value), E0910 (overflow). A rule
  checked at some positions and silent at others is how a parameter-sized
  local reached C as an initialized variable-length array.
- `TypeDeclarationAnalyzer` reads each enum's settled members through
  `IProgram.enumMemberValues` (the symbol table holds 1.3's record, with no
  number): E0894 (negative), E0909, E0910, E0911 (outside `i32`).
- `ConstantDiagnostics` holds the wording once for both. An undeclared bare
  name is E0427's, so it is not reported twice. A member a scope or an enum
  lacks (`S.NOPE`) and a divisor that is zero only once computed
  (`4 / (2 - 2)`) are reported by nothing else, so E0909 says them (#1863
  review: they reached the header as `f[0]`, or render's invariant).
- `LiteralFormAnalyzer` reports a leading-zero decimal literal (E0912), in a
  stage before any of these: ADR-044 has no octal literal, so no reading gives
  `010` a value.
- The dimension stage runs right after E0427's and E0800's, before anything
  that reads a dimension's size, so a slice into an array a variable sizes is
  told the cause (E0909), not that its size is unknown (E0858).

### Emitting in 2.3

`ConstantFold.settled` decides what C a dimension is written as, once: its
value, or, for a `foreign` one, `ConstExprPrinter.toC`, the C written from the
expression's structure, with every part that has a value written as that value,
C's operators (`=` is `==`), and a negative value parenthesized so no two tokens
join. `CodeGenWalker.renderDimension` writes it in the `.c`; 1.4 records it on
the symbol, through `ConstantFold.dimension`, and the header path writes that.
So the two files write one answer rather than two that agree. A dimension with
no value is an `invariant` in render, because 2.1 rejected it; that makes a gap
in 2.1's coverage fail loudly rather than emit C.

An arithmetic chain in ordinary code that is a constant expression is written
as its value, too. 2.2 decides the value by the one evaluator, while the tree
is in hand, and the plan carries it (`TPlannedBinaryExpr.constantValue`).
Render writes it where every operand rendered as a plain integer, which is
where render's own fold over the generated C text (`tryFoldConstants`) used to
apply; where a context gave a literal a `U` suffix, the chain is written as
before. That fold read `010` as decimal, so `i32 a <- 010 + 1` was written as
`11` where C reads octal and computes 9; the evaluator gives a leading-zero
literal no value (#1728), so the chain is written as it is and C computes it.

## What 1.3 records

| Carrier               | Size                                      | As written            |
| --------------------- | ----------------------------------------- | --------------------- |
| `IVariableSymbol`     | `arrayDimensions`                         | `arrayDimensionExprs` |
| `IParameterInfo`      | `arrayDimensions`                         | `arrayDimensionExprs` |
| `IStructFieldSymbol`  | `dimensions`                              | `dimensionExprs`      |
| `ILocalDeclaration`   | `arrayDimensions`                         | `arrayDimensionExprs` |
| a const's initializer | `constValue` (locals; settled)            | `initialValueExpr`    |
| `IEnumMemberSymbol`   | `value` (null out of 1.3; settled by 1.4) | `valueExpr`           |

A size 1.3 can know alone (a literal, `sizeof` of a primitive, arithmetic over
those) is a number with no expression. Anything that needs a name is
`UNRESOLVED_DIMENSION` with the expression, for 1.4.

### ADR-058 length properties

`.element_count`, `.bit_length` and `.byte_length` are constants, so
`u8[src.element_count]` is a constant dimension. `ConstantNames` measures the
value they are taken of -- through struct fields, `cfg.data.element_count`;
through elements, `m[0].element_count`, where the lowering records the
subscript as a step (`ELEMENT_STEP`) because the property is the same for every
element; and on a header's array, from the dimensions its header declares --
and `LengthProperty` (`src/utils`) decides the number from its settled
dimensions and its element's width. Render's property generator asks the same
`LengthProperty`, so a dimension sized by a property is the number the property
reads as. 1.4 settles dimensions to a fixpoint, because a property's base may
itself be sized by a const.

## Known limits

- A header array's `element_count` is measured from its declared dimensions,
  but its `bit_length` and `byte_length` are not constants: they need the C
  element type's width, and that table lives in render, which 1.4 cannot read.
  Render measures one through the operand typer and the target's data model.
  #1878 tracks giving both one table.
- Only a bare name is C's to evaluate as written (`foreign`). A member of
  anything else a header declares has no value, so `CEnum.MEMBER` in a
  dimension is E0909 until #1877 decides what that spelling means.
- A header macro as an enum member's value is rejected for now (owner ruling,
  ADR-017): C-Next needs the value itself.
- An array whose every element C-Next spells (ADR-029: a callback array, an
  array of a struct with a default) needs its count. `ElementCount` folds the
  dimension as above, except that a header macro of plain integer arithmetic
  answers the value `HeaderMacros` read from the macro dump. The dimension
  itself stays the macro. A count it cannot read is E0359 (#1283).
