/**
 * Unit tests for DeclaratorUtils
 */

import { describe, it, expect } from "vitest";
import DeclaratorUtils from "../DeclaratorUtils";
import HeaderParser from "../../../../parser/HeaderParser";

describe("DeclaratorUtils", () => {
  describe("extractTypeFromSpecQualList", () => {
    it("should extract simple type", () => {
      // Parse a struct with a simple int field
      const source = `struct Test { int value; };`;
      const { tree } = HeaderParser.parseC(source);

      // Navigate to the struct's field's specifierQualifierList
      const structSpec = tree
        ?.translationUnit()
        ?.externalDeclaration(0)
        ?.declaration()
        ?.declarationSpecifiers()
        ?.declarationSpecifier(0)
        ?.typeSpecifier()
        ?.structOrUnionSpecifier();

      const fieldDecl = structSpec
        ?.structDeclarationList()
        ?.structDeclaration(0);
      const specQualList = fieldDecl?.specifierQualifierList();

      const result = DeclaratorUtils.extractTypeFromSpecQualList(specQualList);
      expect(result).toBe("int");
    });

    it("should extract unsigned int type", () => {
      const source = `struct Test { unsigned int count; };`;
      const { tree } = HeaderParser.parseC(source);

      const structSpec = tree
        ?.translationUnit()
        ?.externalDeclaration(0)
        ?.declaration()
        ?.declarationSpecifiers()
        ?.declarationSpecifier(0)
        ?.typeSpecifier()
        ?.structOrUnionSpecifier();

      const fieldDecl = structSpec
        ?.structDeclarationList()
        ?.structDeclaration(0);
      const specQualList = fieldDecl?.specifierQualifierList();

      const result = DeclaratorUtils.extractTypeFromSpecQualList(specQualList);
      // For simple types without struct specifier, getText() is used
      // The specifierQualifierList has "unsigned" and "int" as separate tokens
      // which are joined with spaces
      expect(result).toBe("unsigned int");
    });

    it("should extract anonymous struct type with proper spacing", () => {
      // This is the bug case from issue #875
      const source = `typedef struct {
        int value;
        struct {
            unsigned int flag_a: 1;
            unsigned int flag_b: 1;
        } flags;
      } config_t;`;
      const { tree } = HeaderParser.parseC(source);

      const structSpec = tree
        ?.translationUnit()
        ?.externalDeclaration(0)
        ?.declaration()
        ?.declarationSpecifiers()
        ?.declarationSpecifier(1)
        ?.typeSpecifier()
        ?.structOrUnionSpecifier();

      // Get the second field (flags) which is an anonymous struct
      const flagsDecl = structSpec
        ?.structDeclarationList()
        ?.structDeclaration(1);
      const specQualList = flagsDecl?.specifierQualifierList();

      const result = DeclaratorUtils.extractTypeFromSpecQualList(specQualList);

      // Should have proper spacing, not concatenated tokens like "struct{...}"
      expect(result).toContain("struct {");
      // Note: our reconstruction adds spaces around the colon, which is valid C
      expect(result).toContain("unsigned int flag_a : 1;");
      expect(result).toContain("unsigned int flag_b : 1;");
    });
  });
});
