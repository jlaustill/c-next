# ADR-012: Static Analysis for Generated C Code

**Status:** Accepted
**Date:** 2025-12-28
**Decision Makers:** C-Next Language Design Team

## Context

C-Next transpiles to C code. One of the primary value propositions is generating safer, more reliable embedded C code. However, we currently have no automated verification that the generated C code meets quality standards.

### The Opportunity

Industry-standard static analyzers (cppcheck, clang-tidy, MISRA checkers) can validate generated C code quality. Rather than treating these tools as compliance checkboxes, we can use them as a **guiding light** for C-Next language design:

- Warnings reveal patterns where the generated C could be improved
- Some warnings may indicate C-Next should prevent certain constructs entirely
- Other warnings validate that C-Next's design already prevents common issues

### MISRA C and Embedded Systems

MISRA C 2012 is the industry standard for safety-critical embedded systems (automotive, medical, aerospace). It defines 143 rules:
- **Mandatory**: Must comply (no exceptions)
- **Required**: Should comply (deviations must be documented)
- **Advisory**: Recommended practices

C-Next already aligns with many MISRA rules by design:
- **No dynamic allocation** (ADR-003) → Compliant with Rule 21.3
- **Explicit types** (u8, u16, etc.) → Helps with Rule 10.x (type conversions)
- **No implicit type promotion** → Addresses Rule 10.8

---

## Decision: Incremental Static Analysis Integration

### Tool Roadmap

| Phase | Tool | Purpose |
|-------|------|---------|
| 1 | **cppcheck** | General static analysis, easy baseline |
| 2 | **clang-tidy** | Comprehensive checks, CERT guidelines |
| 3 | **MISRA checker** | Full MISRA C 2012 compliance |

### Long-term Goal

**Full MISRA C 2012 compliance** for generated code, or documented deviations with rationale.

This is ambitious but achievable because:
1. C-Next controls code generation completely
2. Language design can prevent violations at the source level
3. Deviations can be documented once (in this ADR) rather than per-project

---

## Implementation

### Phase 1: cppcheck Integration

**Install:**
```bash
sudo apt install cppcheck
```

**Run:**
```bash
cppcheck --enable=all --std=c99 --force generated.c
```

**Configuration (`tools/cppcheck.cfg`):**
```
# Suppress known false positives with documented rationale
# suppressions-list=tools/cppcheck-suppressions.txt
```

### Phase 2: clang-tidy Integration

**Useful check categories:**
- `bugprone-*` — Bug-prone patterns
- `cert-*` — CERT C Coding Standard
- `clang-analyzer-*` — Deep static analysis
- `misc-*` — Miscellaneous checks
- `readability-*` — Code clarity

**Configuration (`.clang-tidy`):**
```yaml
Checks: >
  bugprone-*,
  cert-*,
  clang-analyzer-*,
  -clang-analyzer-security.insecureAPI.DeprecatedOrUnsafeBufferHandling
```

### Phase 3: MISRA Compliance

**Options:**
1. **clang-tidy community configs** — Free but incomplete
2. **cppcheck --addon=misra** — Requires MISRA rules text (copyrighted)
3. **PC-lint Plus** — Commercial, gold standard
4. **Polyspace** — Commercial, automotive-focused

**Recommendation:** Start with cppcheck + clang-tidy. Evaluate commercial tools if/when C-Next targets safety-critical applications.

---

## Analysis Script

**Location:** `scripts/static-analysis.sh`

**Functionality:**
1. Transpile all examples to temp directory
2. Run cppcheck on generated files
3. (Later) Run clang-tidy
4. Report summary with categorized findings

**npm integration:**
```json
{
  "scripts": {
    "analyze": "./scripts/static-analysis.sh"
  }
}
```

---

## Triage Process

For each warning from static analyzers:

### Category 1: Fix in CodeGenerator
**Criteria:** Generated C pattern can be improved without changing semantics.

**Example:** Missing `static` on file-scope variables
**Action:** Update CodeGenerator.ts to emit `static` keyword

### Category 2: Fix in C-Next Language
**Criteria:** Warning indicates potential for user error that C-Next should prevent.

**Example:** Uninitialized variable warning
**Action:** C-Next requires variable initialization (already enforced)

### Category 3: Suppress with Documentation
**Criteria:** Warning is false positive or conflicts with C-Next design goals.

**Example:** MISRA Rule 11.3 (pointer casts) triggered by register bindings
**Action:** Document in this ADR why deviation is acceptable

### Category 4: Track for Future
**Criteria:** Valid concern but requires significant work to address.

**Action:** Create tracking issue, add to roadmap

---

## MISRA Deviation Log

This section documents intentional deviations from MISRA C 2012 rules.

### Rule 11.3 - Pointer Type Casts
**Rule:** "A cast shall not be performed between a pointer to object type and a pointer to a different object type."

**Deviation:** Register bindings require casting integer addresses to `volatile` pointers:
```c
#define GPIO7_DR (*(volatile uint32_t*)(0x42004000 + 0x00))
```

**Rationale:** This is the standard pattern for memory-mapped I/O in embedded systems. The address is a hardware specification, not an arbitrary cast. All major embedded compilers and MISRA deviation databases accept this pattern with documentation.

### (Additional deviations will be added as discovered)

---

## Success Metrics

### Short Term
- [ ] cppcheck runs with 0 errors on all examples
- [ ] npm script: `npm run analyze`
- [ ] Baseline metrics documented

### Medium Term
- [ ] clang-tidy passes with `bugprone-*` and `cert-*`
- [ ] CodeGenerator improvements based on findings
- [ ] CI integration

### Long Term
- [ ] MISRA Mandatory rules: 100% compliance or documented deviation
- [ ] MISRA Required rules: >90% compliance
- [ ] Metrics tracked over time

---

## File Structure

```
c-next/
├── scripts/
│   └── static-analysis.sh     # Analysis runner
├── tools/
│   ├── cppcheck.cfg           # cppcheck configuration
│   ├── cppcheck-suppressions.txt
│   └── .clang-tidy            # clang-tidy configuration (future)
└── docs/decisions/
    └── adr-012-static-analysis.md  # This file
```

---

## References

### Static Analysis Tools
- [cppcheck](http://cppcheck.sourceforge.net/)
- [clang-tidy](https://clang.llvm.org/extra/clang-tidy/)
- [PC-lint Plus](https://pclintplus.com/)

### Coding Standards
- [MISRA C:2012](https://www.misra.org.uk/)
- [CERT C Coding Standard](https://wiki.sei.cmu.edu/confluence/display/c)
- [Barr Group Embedded C Standard](https://barrgroup.com/embedded-systems/books/embedded-c-coding-standard)

### C-Next Related ADRs
- ADR-003: Memory Model (no dynamic allocation)
- ADR-006: Pointer Semantics
