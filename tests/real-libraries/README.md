# Real-World Library Integration Tests

Tests C-Next interop against real C/C++ library headers (not stubs).

## Purpose

Synthetic tests verify what we _think_ might break. Real libraries expose what _actually_ breaks:

- Header complexity (nested includes, macros, conditionals)
- Callback patterns (how real APIs expect callbacks registered)
- Type aliasing (typedef chains, platform-specific types)
- void\* handling (opaque parameter passing)

## Libraries

| Library         | Version | Location               | Status      | Findings                            |
| --------------- | ------- | ---------------------- | ----------- | ----------------------------------- |
| FreeRTOS-Kernel | V11.2.0 | `tests/libs/FreeRTOS/` | In Progress | [findings.md](freertos/findings.md) |

## Running Tests

```bash
# Run all real-library tests
npm test -- tests/real-libraries/

# Run specific library
npm test -- tests/real-libraries/freertos/
```

## Test Markers

All tests use `// test-no-exec` - they transpile and compile but don't execute (no RTOS environment available).

## Adding New Libraries

1. Vendor library to `tests/libs/<library>/` with VERSION.txt
2. Create `tests/real-libraries/<library>/` with tests
3. Document findings in `<library>/findings.md`
4. Update this README

## Related

- Issue #931: Real-world C/C++ library integration tests
- Design: `docs/plans/2026-02-24-real-library-tests-design.md`
