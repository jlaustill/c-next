/**
 * Unit tests for needsConditionalPreprocessing detection logic
 * Issue #945: Tests the regex pattern that determines when header files
 * need preprocessing for conditional compilation evaluation. #1844: 1.1
 * Discover's `HeaderSources` owns it now, with the rest of a header's text.
 */

import { describe, it, expect } from "vitest";
import HeaderSources from "../HeaderSources";

/** The private predicate, reached the way the other private-method tests do */
function needsConditionalPreprocessing(content: string): boolean {
  return (
    HeaderSources as unknown as {
      _needsConditionalPreprocessing: (s: string) => boolean;
    }
  )._needsConditionalPreprocessing(content);
}

describe("needsConditionalPreprocessing", () => {
  describe("patterns that SHOULD trigger preprocessing", () => {
    it("detects #if MACRO != 0", () => {
      const content = `
        #if FEATURE_LABEL != 0
        void create_label(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects #if MACRO == 1", () => {
      const content = `
        #if DEBUG_ENABLED == 1
        void debug_log(const char* msg);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects #if MACRO > 0", () => {
      const content = `
        #if LOG_LEVEL > 0
        void log_debug(const char* msg);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects bare #if MACRO (truthy check)", () => {
      const content = `
        #if FEATURE_ENABLED
        void do_feature(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects #elif MACRO != 0", () => {
      const content = `
        #if FEATURE_A
        void feature_a(void);
        #elif FEATURE_B != 0
        void feature_b(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects #elif with bare macro", () => {
      const content = `
        #ifdef FEATURE_A
        void feature_a(void);
        #elif FEATURE_B
        void feature_b(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("detects #if with arithmetic expression", () => {
      const content = `
        #if MAJOR_VERSION >= 2
        void new_api(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("does not trigger for #if defined(X) && macro (starts with defined)", () => {
      // The regex is conservative: if the line starts with defined(),
      // we assume the parser can handle it. Complex expressions like
      // defined(X) && MACRO > 1 are rare enough that this trade-off is acceptable.
      const content = `
        #if defined(FEATURE_X) && FEATURE_LEVEL > 1
        void advanced_feature(void);
        #endif
      `;
      // Current regex doesn't match this because it starts with defined()
      // This is a known limitation, but acceptable for most real-world headers
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });
  });

  describe("patterns that should NOT trigger preprocessing", () => {
    it("does not trigger for #ifdef MACRO", () => {
      const content = `
        #ifdef FEATURE_ENABLED
        void do_feature(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #ifndef MACRO", () => {
      const content = `
        #ifndef HEADER_GUARD_H
        #define HEADER_GUARD_H
        void foo(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #if defined(MACRO)", () => {
      const content = `
        #if defined(FEATURE_X)
        void feature_x(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #if 0", () => {
      const content = `
        #if 0
        // disabled code
        void old_api(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #if 1", () => {
      const content = `
        #if 1
        void always_enabled(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for plain declarations without conditionals", () => {
      const content = `
        void foo(void);
        void bar(int x);
        typedef struct widget_s widget_t;
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #if 0 with comment", () => {
      const content = `
        #if 0 // disabled
        void disabled(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });

    it("does not trigger for #if 1 with comment", () => {
      const content = `
        #if 1 /* always on */
        void enabled(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(false);
    });
  });

  describe("edge cases", () => {
    it("handles mixed ifdef and if MACRO patterns", () => {
      const content = `
        #ifdef PLATFORM_LINUX
        void linux_init(void);
        #endif

        #if DEBUG_LEVEL != 0
        void debug_init(void);
        #endif
      `;
      // Should trigger because of the #if DEBUG_LEVEL != 0 pattern
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("handles LVGL-style config patterns", () => {
      // Real-world pattern from LVGL headers
      const content = `
        #if LV_USE_LABEL != 0
        lv_obj_t* lv_label_create(lv_obj_t* parent);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("handles FreeRTOS-style config patterns", () => {
      // Real-world pattern from FreeRTOS headers
      const content = `
        #if configUSE_MUTEXES == 1
        SemaphoreHandle_t xSemaphoreCreateMutex(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("handles whitespace variations in #if", () => {
      const content = `
        #if   FEATURE_X
        void feature(void);
        #endif
      `;
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });

    it("handles tab in #if directive", () => {
      const content = "#if\tFEATURE_X\nvoid feature(void);\n#endif";
      expect(needsConditionalPreprocessing(content)).toBe(true);
    });
  });
});
