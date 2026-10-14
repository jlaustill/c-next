/**
 * 1.2's C header lowering (#1991): what 1.3 reads instead of the tree.
 */
import { describe, it, expect } from "vitest";
import HeaderParser from "../../HeaderParser";
import type ICStructSyntax from "../../types/ICStructSyntax";
import type TCExternalDeclarationSyntax from "../../types/TCExternalDeclarationSyntax";

function declarations(source: string): readonly TCExternalDeclarationSyntax[] {
  const syntax = HeaderParser.parseC(source).syntax;
  expect(syntax).not.toBeNull();
  return syntax!.declarations;
}

function struct(source: string): ICStructSyntax {
  const decl = declarations(source)[0];
  if (decl.kind !== "declaration" || !decl.struct) {
    throw new Error("expected a struct declaration");
  }
  return decl.struct;
}

describe("CHeaderLowering", () => {
  describe("field types", () => {
    it("lowers a simple field type", () => {
      expect(struct(`struct Test { int value; };`).fields[0].type).toBe("int");
    });

    it("joins a multi-word field type with spaces", () => {
      expect(
        struct(`struct Test { unsigned int count; };`).fields[0].type,
      ).toBe("unsigned int");
    });

    it("rebuilds an anonymous struct field type with spacing (#875)", () => {
      const type = struct(`typedef struct {
        int value;
        struct {
            unsigned int flag_a: 1;
            unsigned int flag_b: 1;
        } flags;
      } config_t;`).fields[1].type;
      expect(type).toContain("struct {");
      expect(type).toContain("unsigned int flag_a : 1;");
      expect(type).toContain("unsigned int flag_b : 1;");
    });

    it("rebuilds an anonymous union field type with the union keyword", () => {
      const type = struct(`typedef struct {
        union {
            int as_int;
            float as_float;
        } value;
      } variant_t;`).fields[0].type;
      expect(type).toContain("union {");
      expect(type).toContain("int as_int;");
      expect(type).toContain("float as_float;");
    });
  });

  describe("declarators", () => {
    it("counts pointer depth and keeps the name", () => {
      const decl = declarations(`int **pp;`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0],
      ).toMatchObject({
        name: "pp",
        hasPointer: true,
        pointerDepth: 2,
        isFunction: false,
        functionPointerParams: null,
      });
    });

    it("records a function pointer's parameter list as written", () => {
      const decl = declarations(`typedef void (*cb_t)(int, char *);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0],
      ).toMatchObject({
        name: "cb_t",
        isFunction: true,
        functionPointerParams: "int,char*",
      });
    });

    it("lowers a prototype's parameters", () => {
      const decl = declarations(`int add(const int a, int b[]);`)[0];
      expect(
        decl.kind === "declaration" && decl.declarators?.[0]?.parameters,
      ).toEqual([
        { name: "a", type: "int", isConst: true, isArray: false },
        { name: "b", type: "int", isConst: false, isArray: true },
      ]);
    });

    it("skips only a declarator error recovery left without its direct declarator", () => {
      const lowered = declarations(`void good(int a);\nint a, 8[2];\n`);
      const good = lowered[0];
      expect(good.kind === "declaration" && good.declarators?.[0]?.name).toBe(
        "good",
      );
    });

    it("leaves declarators null when the declaration has none", () => {
      const decl = declarations(`struct Point { int x; };`)[0];
      expect(decl.kind === "declaration" && decl.declarators).toBeNull();
    });
  });

  it("gives each enum member its own span", () => {
    const decl = declarations(`enum Color {\n  RED,\n  GREEN\n};`)[0];
    if (decl.kind !== "declaration" || !decl.enum) throw new Error("no enum");
    expect(decl.enum.members.map((m) => [m.name, m.span.line])).toEqual([
      ["RED", 2],
      ["GREEN", 3],
    ]);
  });
});
