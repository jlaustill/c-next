/**
 * 1.2: a C header's tree, turned into the plain data 1.3 declares from
 * (#1991: the tree never leaves 1.2).
 */
import type {
  CompilationUnitContext,
  DeclarationContext,
  DeclarationSpecifiersContext,
  DeclaratorContext,
  EnumSpecifierContext,
  FunctionDefinitionContext,
  ParameterDeclarationContext,
  SpecifierQualifierListContext,
  StructDeclarationContext,
  StructDeclaratorContext,
  StructOrUnionSpecifierContext,
  TypeSpecifierContext,
} from "./grammar/CParser";
import type ICHeaderSyntax from "../types/ICHeaderSyntax";
import type IHeaderDeclaratorSyntax from "../types/IHeaderDeclaratorSyntax";
import type ICEnumSyntax from "../types/ICEnumSyntax";
import type ICFieldSyntax from "../types/ICFieldSyntax";
import type ICStructSyntax from "../types/ICStructSyntax";
import type ICTypeSpecifierSyntax from "../types/ICTypeSpecifierSyntax";
import type TCExternalDeclarationSyntax from "../types/TCExternalDeclarationSyntax";
import type IExtractedParameter from "../shared/IExtractedParameter";
import ParameterExtractorUtils from "../shared/ParameterExtractorUtils";
import ArrayDimensionText from "../../../utils/ArrayDimensionText";
import ParserUtils from "../../../utils/ParserUtils";

class CHeaderLowering {
  static header(tree: CompilationUnitContext): ICHeaderSyntax {
    const declarations: TCExternalDeclarationSyntax[] = [];
    for (const extDecl of tree.translationUnit()?.externalDeclaration() ?? []) {
      const funcDef = extDecl.functionDefinition();
      if (funcDef) {
        declarations.push(CHeaderLowering.functionDefinition(funcDef));
        continue;
      }
      const decl = extDecl.declaration();
      const lowered = decl ? CHeaderLowering.declaration(decl) : null;
      if (lowered) declarations.push(lowered);
    }
    return { declarations };
  }

  private static functionDefinition(
    funcDef: FunctionDefinitionContext,
  ): TCExternalDeclarationSyntax {
    const declSpecs = funcDef.declarationSpecifiers();
    const declarator = funcDef.declarator();
    return {
      kind: "functionDefinition",
      span: ParserUtils.getSpan(funcDef),
      typeSpecifiers: declSpecs
        ? CHeaderLowering.typeSpecifiers(declSpecs)
        : [],
      declarator: declarator ? CHeaderLowering.declarator(declarator) : null,
    };
  }

  private static declaration(
    decl: DeclarationContext,
  ): TCExternalDeclarationSyntax | null {
    const declSpecs = decl.declarationSpecifiers();
    if (!declSpecs) return null;
    const specs = declSpecs.declarationSpecifier();
    const typeSpecs = specs.flatMap((spec) => spec.typeSpecifier() ?? []);
    const structSpec = typeSpecs
      .find((t) => t.structOrUnionSpecifier())
      ?.structOrUnionSpecifier();
    const enumSpec = typeSpecs.find((t) => t.enumSpecifier())?.enumSpecifier();
    const span = ParserUtils.getSpan(decl);
    const initDeclList = decl.initDeclaratorList();
    return {
      kind: "declaration",
      span,
      isTypedef: CHeaderLowering.hasStorageClass(declSpecs, "typedef"),
      isExtern: CHeaderLowering.hasStorageClass(declSpecs, "extern"),
      isVolatile: specs.some(
        (spec) => spec.typeQualifier()?.getText() === "volatile",
      ),
      typeSpecifiers: CHeaderLowering.typeSpecifiers(declSpecs),
      struct: structSpec ? CHeaderLowering.struct(structSpec) : null,
      enum: enumSpec ? CHeaderLowering.enum(enumSpec, span) : null,
      declarators: initDeclList
        ? initDeclList.initDeclarator().flatMap((initDecl) => {
            const declarator = initDecl.declarator();
            return declarator ? [CHeaderLowering.declarator(declarator)] : [];
          })
        : null,
    };
  }

  private static hasStorageClass(
    declSpecs: DeclarationSpecifiersContext,
    storage: string,
  ): boolean {
    return declSpecs
      .declarationSpecifier()
      .some((spec) => spec.storageClassSpecifier()?.getText() === storage);
  }

  private static typeSpecifiers(
    declSpecs: DeclarationSpecifiersContext,
  ): ICTypeSpecifierSyntax[] {
    return declSpecs.declarationSpecifier().flatMap((spec) => {
      const typeSpec = spec.typeSpecifier();
      if (!typeSpec) return [];
      return [
        {
          text: CHeaderLowering.typeSpecifierText(typeSpec),
          typedefName: typeSpec.typedefName()?.getText() ?? null,
        },
      ];
    });
  }

  private static declarator(
    declarator: DeclaratorContext,
  ): IHeaderDeclaratorSyntax {
    const directDecl = declarator.directDeclarator();
    const pointerText = declarator.pointer()?.getText() ?? "";
    const hasParams =
      directDecl.parameterTypeList() !== null ||
      directDecl.LeftParen() !== null;
    const isFunctionPointer =
      hasParams &&
      (directDecl.directDeclarator()?.declarator()?.pointer() ?? null) !== null;
    return {
      name: CHeaderLowering.declaratorName(declarator),
      isFunction: hasParams,
      hasPointer: declarator.pointer() !== null,
      pointerDepth: pointerText.split("*").length - 1,
      functionPointerParams: isFunctionPointer
        ? (directDecl.parameterTypeList()?.getText() ?? "")
        : null,
      parameters: CHeaderLowering.parameters(declarator),
      arrayDimensions: ArrayDimensionText.parse(directDecl.getText()),
    };
  }

  private static declaratorName(
    declarator: DeclaratorContext | null,
  ): string | null {
    let directDecl = declarator?.directDeclarator() ?? null;
    while (directDecl) {
      const identifier = directDecl.Identifier();
      if (identifier) return identifier.getText();
      const nested = directDecl.declarator();
      if (nested) return CHeaderLowering.declaratorName(nested);
      directDecl = directDecl.directDeclarator();
    }
    return null;
  }

  private static parameters(
    declarator: DeclaratorContext,
  ): IExtractedParameter[] {
    const paramList = declarator
      .directDeclarator()
      .parameterTypeList()
      ?.parameterList();
    if (!paramList) return [];
    return ParameterExtractorUtils.processParameterList(
      paramList,
      CHeaderLowering.parameter,
    );
  }

  private static parameter(
    paramDecl: ParameterDeclarationContext,
  ): IExtractedParameter | null {
    const declSpecs = paramDecl.declarationSpecifiers();
    if (!declSpecs) return null;
    const baseType =
      CHeaderLowering.typeSpecifiers(declSpecs)
        .map((spec) => spec.text)
        .join(" ") || "int";
    const declarator = paramDecl.declarator();
    const directText = declarator?.directDeclarator().getText() ?? "";
    const pointerText = declarator?.pointer()?.getText() ?? "";
    return ParameterExtractorUtils.buildParameterInfo(
      declarator,
      baseType + "*".repeat(pointerText.split("*").length - 1),
      declSpecs.getText().includes("const"),
      directText.includes("[") && directText.includes("]"),
      CHeaderLowering.declaratorName,
    );
  }

  private static struct(
    structSpec: StructOrUnionSpecifierContext,
  ): ICStructSyntax {
    const declList = structSpec.structDeclarationList();
    return {
      tag: structSpec.Identifier()?.getText() ?? null,
      isUnion: structSpec.structOrUnion()?.getText() === "union",
      hasBody: declList !== null,
      fields: (declList?.structDeclaration() ?? []).flatMap((decl) =>
        CHeaderLowering.fields(decl),
      ),
    };
  }

  private static fields(decl: StructDeclarationContext): ICFieldSyntax[] {
    const specQualList = decl.specifierQualifierList();
    const declaratorList = decl.structDeclaratorList();
    if (!specQualList || !declaratorList) return [];
    const type = CHeaderLowering.specQualText(specQualList);
    return declaratorList.structDeclarator().flatMap((structDecl) => {
      const declarator = structDecl.declarator();
      return declarator
        ? [{ type, declarator: CHeaderLowering.declarator(declarator) }]
        : [];
    });
  }

  private static enum(
    enumSpec: EnumSpecifierContext,
    span: ReturnType<typeof ParserUtils.getSpan>,
  ): ICEnumSyntax {
    return {
      name: enumSpec.Identifier()?.getText() ?? null,
      members: (enumSpec.enumeratorList()?.enumerator() ?? []).flatMap(
        (enumerator) => {
          const name = enumerator
            .enumerationConstant()
            ?.Identifier()
            ?.getText();
          return name
            ? [{ name, span: ParserUtils.getSpanOr(enumerator, span) }]
            : [];
        },
      ),
    };
  }

  /** A type specifier as C reads it; an anonymous struct is rebuilt spaced */
  private static typeSpecifierText(typeSpec: TypeSpecifierContext): string {
    const structSpec = typeSpec.structOrUnionSpecifier();
    if (structSpec) {
      const identifier = structSpec.Identifier();
      return identifier
        ? identifier.getText()
        : CHeaderLowering.anonymousStructText(structSpec);
    }
    const enumSpec = typeSpec.enumSpecifier();
    if (enumSpec) {
      const identifier = enumSpec.Identifier();
      return identifier
        ? `enum ${identifier.getText()}`
        : `enum ${enumSpec.getText().replace(/^enum/, "")}`;
    }
    return typeSpec.getText();
  }

  private static specQualText(
    specQualList: SpecifierQualifierListContext,
  ): string {
    const parts: string[] = [];
    let current: SpecifierQualifierListContext | null = specQualList;
    while (current) {
      const typeSpec = current.typeSpecifier();
      if (typeSpec) parts.push(CHeaderLowering.typeSpecifierText(typeSpec));
      const typeQual = current.typeQualifier();
      if (typeQual) parts.push(typeQual.getText());
      current = current.specifierQualifierList();
    }
    return parts.join(" ") || "int";
  }

  private static anonymousStructText(
    structSpec: StructOrUnionSpecifierContext,
  ): string {
    const keyword = structSpec.structOrUnion().Struct() ? "struct" : "union";
    const declList = structSpec.structDeclarationList();
    if (!declList) return `${keyword} { }`;
    const fields = declList
      .structDeclaration()
      .flatMap((decl) => CHeaderLowering.anonymousFieldText(decl) ?? [])
      .join(" ");
    return `${keyword} { ${fields} }`;
  }

  private static anonymousFieldText(
    decl: StructDeclarationContext,
  ): string | null {
    const specQualList = decl.specifierQualifierList();
    if (!specQualList) return null;
    const baseType = CHeaderLowering.specQualText(specQualList);
    const declarators = (
      decl.structDeclaratorList()?.structDeclarator() ?? []
    ).flatMap(
      (structDecl) => CHeaderLowering.anonymousDeclaratorText(structDecl) ?? [],
    );
    return declarators.length === 0
      ? `${baseType};`
      : `${baseType} ${declarators.join(", ")};`;
  }

  private static anonymousDeclaratorText(
    structDecl: StructDeclaratorContext,
  ): string | null {
    const name = CHeaderLowering.declaratorName(structDecl.declarator()) ?? "";
    const width = structDecl.constantExpression();
    if (structDecl.Colon() !== null && width) {
      return `${name}: ${width.getText()}`;
    }
    return name || null;
  }
}

export default CHeaderLowering;
