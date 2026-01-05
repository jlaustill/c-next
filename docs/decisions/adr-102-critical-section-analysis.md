# ADR-102: Critical Section Complexity Analysis

**Status:** Research (v2)
**Date:** 2026-01-04
**Decision Makers:** C-Next Language Design Team
**Version:** v2

## Context

Long critical sections increase interrupt latency and can cause issues like watchdog starvation, missed real-time deadlines, and poor system responsiveness. This ADR explores compile-time and runtime analysis of critical section complexity.

Deferred from ADR-050 (v1) to keep v1 focused on MVP.

### Related ADRs

- **ADR-050**: Critical sections (v1)
- **ADR-100**: Multi-core synchronization (v2)

---

## Background from ADR-050 Research

### Why Long Critical Sections Are Problematic

1. **Interrupt latency** - Other ISRs can't fire
2. **Watchdog starvation** - Can't service watchdog timer
3. **Real-time deadlines** - May miss timing requirements
4. **System responsiveness** - UI/communication blocked

### Watchdog Timer Considerations

Watchdog timers typically require periodic "feeding" (writing to a register) to prevent system reset. If a critical section runs longer than the watchdog timeout, the system resets unexpectedly.

**Typical watchdog timeouts:**
- Independent Watchdog (IWDG): 100ms - 26s (configurable)
- Window Watchdog (WWDG): ~50ms max

**v2 Analysis Could Detect:**
- Critical sections that exceed estimated watchdog timeout
- Watchdog service calls inside critical sections (may indicate design smell)
- Paths where watchdog might not be serviced in time

### Industry Best Practice

- "Keep critical sections as short as possible"
- "Avoid function calls which may have hidden depths"
- "Never use loops with unbounded iteration counts"
- Typical guidance: microseconds, not milliseconds

---

## Design Questions

### Q1: Warning Categories

What should trigger warnings?

| Warning Type | Complexity |
|--------------|------------|
| Statement count > N | Simple |
| Contains function calls | Simple |
| Contains loops | Simple |
| Cycle estimation | Complex |
| Worst-case execution time (WCET) | Very complex |

### Q2: Opt-In vs Default

Should warnings be:
- Off by default, opt-in via pragma?
- On by default, opt-out via pragma?
- Configurable severity (warning vs error)?

### Q3: Cycle Estimation

Can the compiler estimate execution cycles?

```cnx
@max_cycles(100)
critical {
    // Compiler estimates cycles, errors if exceeded
}
```

Challenges:
- Platform-dependent cycle counts
- Function call depth analysis
- Loop iteration estimation

### Q4: Runtime Instrumentation

Should C-Next support runtime critical section timing?

```cnx
// Debug mode: measure actual critical section duration
#pragma instrument critical_sections

critical {
    // Runtime measures cycles/time, logs if exceeded threshold
}
```

### Q5: Integration with Static Analysis

Could C-Next integrate with external tools like:
- WCET analyzers
- MISRA checkers (LDRA, Polyspace)
- Custom lint rules

---

## Open Questions Summary

1. What warning categories to support?
2. Opt-in or default warnings?
3. Can we estimate cycles at compile time?
4. Should we support runtime instrumentation?
5. Integration with external analysis tools?

---

## References

- [ADR-050: Critical Sections](adr-050-critical-sections.md)
- [Embedded Artistry: Interrupt Handler Rules](https://embeddedartistry.com/blog/2017/08/28/interrupt-handler-rules-of-thumb/)
- [7 Best Practices for Writing ISRs](https://runtimerec.com/best-practices-for-writing-interrupt-service-routines/)
- [WCET Analysis](https://en.wikipedia.org/wiki/Worst-case_execution_time)
