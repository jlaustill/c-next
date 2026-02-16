# ADR-110: DO-178C Compliance Support

## Status

**Research**

## Context

C-Next currently enforces MISRA C:2012 compliance through a combination of:

- **15 actively enforced rules** via analyzers and TypeValidator
- **43+ rules by design** - language features (no pointers, no malloc) make violations impossible
- Documented in `docs/misra-compliance.md`

Aviation software requires DO-178C certification. This ADR captures initial research on what transpiler-level support could look like.

## DO-178C vs MISRA: Key Differences

| Aspect           | MISRA C:2012                 | DO-178C                                             |
| ---------------- | ---------------------------- | --------------------------------------------------- |
| **Focus**        | Coding rules to prevent bugs | Full software lifecycle certification               |
| **Scope**        | Source code only             | Requirements → Design → Code → Testing → Deployment |
| **Output**       | Clean code                   | Documentation artifacts proving correctness         |
| **Verification** | Static analysis              | MC/DC coverage, requirements traceability           |
| **Levels**       | One standard                 | 5 Design Assurance Levels (DAL A-E)                 |

**Key insight**: MISRA says "don't do X", DO-178C says "prove you did Y correctly and document everything."

## DO-178C Coverage Requirements by DAL

| DAL Level | Failure Impact | Coverage Requirement                         |
| --------- | -------------- | -------------------------------------------- |
| A         | Catastrophic   | MC/DC (Modified Condition/Decision Coverage) |
| B         | Hazardous      | Decision + Statement Coverage                |
| C         | Major          | Statement Coverage                           |
| D         | Minor          | Less stringent                               |
| E         | No effect      | Minimal                                      |

## Potential Transpiler Features

### Feasible Additions

1. **Dead Code Detection** - DO-178C prohibits deactivated code at all DAL levels
   - Static analysis similar to existing analyzers
   - Flag unreachable code paths

2. **Requirement Traceability Comments** - Parse annotations like `// @requirement REQ-123`
   - Validate referenced requirements exist
   - Generate traceability matrix reports

3. **Stricter MISRA Enforcement** - DO-178C often references MISRA as coding standard
   - Complete remaining partial rules

### Complex Additions

4. **MC/DC Instrumentation** - Generate code with coverage hooks
   - Track every boolean condition outcome
   - Requires significant code transformation
   - Output coverage data for external tools

5. **Data/Control Coupling Analysis** - Track variable dependencies
   - Generate coupling reports for certification docs

### Outside Transpiler Scope

- Documentation generation (PSAC, Software Development Plan)
- Requirements management systems
- Test management and execution
- Certification authority interaction

## Research Questions

1. What subset of DO-178C objectives can a transpiler reasonably support?
2. How do existing DO-178C toolchains (LDRA, VectorCAST, Parasoft) handle instrumentation?
3. Should C-Next generate gcov-compatible instrumentation or define its own format?
4. What's the minimum viable feature set that provides value for avionics developers?

## References

- [DO-178C Overview](https://en.wikipedia.org/wiki/DO-178C)
- [MISRA C:2012](https://www.misra.org.uk/misra-c/)
- Current implementation: `docs/misra-compliance.md`
- Comment validation: `src/transpiler/logic/analysis/CommentExtractor.ts`
- Condition checks: `src/transpiler/output/codegen/TypeValidator.ts`
