# #1322 review — a scoped const belongs to its scope

The program artifact keyed every const by **bare name** (plus, for a scoped one,
its transpiled C name). The bare slot is shared by every scope declaring that
name, so the answer was whichever scope the resolver derived **last**. Wrong in
both directions:

- a **legal program was rejected** — `scope Small { const u8 SIZE <- 2;
u8[SIZE] table <- [1, 2]; }` beside a `Large.SIZE <- 8` reported
  `E0866: declared [8] but the initializer has 2 element(s)`;
- **E0854 became order-dependent** — swapping two scope declarations turned the
  bounds check on and off.

## What is asserted where, and why

The **order-dependence** is asserted by the pair here: one file declares `Small`
first, its sibling declares `Big` first, and both must report the same
diagnostic. A single file could pass by luck; the pair cannot.

The **acceptance** half is asserted by a unit test on `ArrayDeclarationAnalyzer`
rather than by a fixture, and that is a limitation worth stating rather than
working around. A fixture would need a counted initializer, and the emitted
array size still comes from the collided key — that half folds the dimension at
**declare** time, per file, before the program artifact exists, so it is out of
reach of the fix here and reproduces on `main`. It is **#1538**. Compiling code
in that shape produces C the static analysis correctly rejects:
`misra-c2012-9.3` (an `[8]` array with two initializers) and cppcheck's
`arrayIndexOutOfBounds` (a `[2]` array read at index 7). Shipping fixtures that
assert known-wrong C would be asserting the bug.

When #1538 lands, an execution fixture belongs here for both orders.
