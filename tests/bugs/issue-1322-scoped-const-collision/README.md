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

The **acceptance** half is asserted by the execution pair `accept-small-first`
and `accept-big-first`: both scopes' counted initializers are exact in either
order, and the emitted sizes are `Small__table[2]` and `Large__table[8]`.

Until #1538 was fixed (#1668, C11) this half could only be a unit test on
`ArrayDeclarationAnalyzer`. The analyzer asked from the scope, but the emitted
size still came from the shared bare key, which 1.3 folded at declare time and
render folded again from its own flat map. A fixture then would have asserted
C that the static analysis rejects: `misra-c2012-9.3` (an `[8]` array with two
initializers) in one order, and in the other a `[2]` array with eight
initializers, read at index 7. The unit test stays beside the pair.
