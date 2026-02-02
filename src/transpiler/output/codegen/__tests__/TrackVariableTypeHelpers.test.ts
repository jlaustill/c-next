/**
 * Unit tests for trackVariableTypeWithName helper methods.
 * Tests the extracted helpers: extractArrayDimensionsSimple, tryRegisterStringType,
 * and resolveBaseTypeFromContext.
 */

import { describe, expect, it } from "vitest";
import transpile from "../../../../lib/transpiler";

/**
 * Helper to transpile C-Next source and return the C output
 */
function transpileSource(source: string): string {
  const result = transpile(source);
  if (result.errors && result.errors.length > 0) {
    throw new Error(
      `Transpile failed: ${result.errors.map((e) => e.message).join(", ")}`,
    );
  }
  return result.code;
}

describe("trackVariableTypeWithName helpers", () => {
  describe("extractArrayDimensionsSimple", () => {
    it("handles string array with single dimension", () => {
      const source = `
        string<32> messages[4];
        void main() {
          messages[0] <- "Hello";
        }
      `;
      const code = transpileSource(source);
      // String array should be declared with both array and string dimensions
      expect(code).toContain("char messages[4][33]");
    });

    it("handles string array with multiple dimensions", () => {
      const source = `
        string<16> grid[2][3];
        void main() {
          grid[0][0] <- "test";
        }
      `;
      const code = transpileSource(source);
      // Multi-dimensional string array
      expect(code).toContain("char grid[2][3][17]");
    });

    it("handles string without array dimensions", () => {
      const source = `
        string<64> message;
        void main() {
          message <- "Hello";
        }
      `;
      const code = transpileSource(source);
      // Simple string should just have capacity + 1 for null terminator
      expect(code).toContain("char message[65]");
    });
  });

  describe("tryRegisterStringType", () => {
    it("registers string type with correct capacity", () => {
      const source = `
        string<100> buffer;
        void main() {
          buffer <- "test";
        }
      `;
      const code = transpileSource(source);
      // String capacity 100 + 1 for null terminator
      expect(code).toContain("char buffer[101]");
    });

    it("registers const string type", () => {
      const source = `
        const string<32> greeting <- "Hello";
        void main() {
          return;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("const char greeting[33]");
    });

    it("enables string helpers when string type is used", () => {
      const source = `
        string<32> a;
        string<32> b;
        void main() {
          a <- "Hello";
          b <- a;
        }
      `;
      const code = transpileSource(source);
      // String assignment should use strncpy with null terminator
      expect(code).toContain("strncpy");
      expect(code).toContain("[32] = '\\0'");
    });
  });

  describe("resolveBaseTypeFromContext", () => {
    it("resolves primitive types", () => {
      const source = `
        u32 counter;
        void main() {
          counter <- 42;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("uint32_t counter");
    });

    it("resolves scoped types (this.Type)", () => {
      const source = `
        scope Motor {
          enum State { OFF, ON }
          this.State currentState;

          public void setState(this.State newState) {
            currentState <- newState;
          }
        }

        void main() {
          Motor.setState(Motor_State.ON);
        }
      `;
      const code = transpileSource(source);
      // Scoped type should be mangled to Motor_State
      expect(code).toContain("Motor_State");
    });

    it("resolves global types (global.Type)", () => {
      const source = `
        enum Status { OK, ERROR }

        scope Handler {
          global.Status result;

          public void setResult(global.Status s) {
            result <- s;
          }
        }

        void main() {
          Handler.setResult(Status.OK);
        }
      `;
      const code = transpileSource(source);
      // Global type should resolve to just Status
      expect(code).toContain("Status Handler_result");
    });

    it("resolves qualified types (Scope.Type)", () => {
      const source = `
        scope Motor {
          public enum State { OFF, ON }
        }

        Motor.State globalMotorState;

        void main() {
          globalMotorState <- Motor_State.OFF;
        }
      `;
      const code = transpileSource(source);
      // Qualified type should resolve to Motor_State
      expect(code).toContain("Motor_State globalMotorState");
    });

    it("resolves user-defined struct types", () => {
      const source = `
        struct Point {
          i32 x;
          i32 y;
        }

        Point origin;

        void main() {
          origin.x <- 0;
          origin.y <- 0;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("Point origin");
    });
  });

  describe("trackVariableTypeWithName integration", () => {
    it("handles array type syntax", () => {
      const source = `
        u8 buffer[10];
        void main() {
          buffer[0] <- 255;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("uint8_t buffer[10]");
    });

    it("handles enum type registration", () => {
      const source = `
        enum Color { RED, GREEN, BLUE }
        Color selected;

        void main() {
          selected <- Color.GREEN;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("Color selected");
      expect(code).toContain("selected = Color_GREEN");
    });

    it("handles bitmap type registration", () => {
      const source = `
        bitmap8 Flags {
          enabled,
          visible,
          active,
          reserved0,
          reserved1,
          reserved2,
          reserved3,
          reserved4
        }
        Flags settings;

        void main() {
          settings.enabled <- 1;
        }
      `;
      const code = transpileSource(source);
      expect(code).toContain("Flags settings");
    });

    it("handles atomic string type", () => {
      const source = `
        atomic string<64> sharedMessage;

        void main() {
          sharedMessage <- "Hello";
        }
      `;
      const code = transpileSource(source);
      // Atomic modifier should be preserved (though string atomicity is limited)
      expect(code).toContain("char sharedMessage[65]");
    });

    it("handles wrap overflow behavior", () => {
      const source = `
        wrap u8 counter;

        void main() {
          counter <- 255;
          counter <- counter + 1;
        }
      `;
      const code = transpileSource(source);
      // Wrap behavior means no overflow check
      expect(code).toContain("uint8_t counter");
    });
  });
});
