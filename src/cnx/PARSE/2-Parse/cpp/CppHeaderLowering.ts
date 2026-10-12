/**
 * CppHeaderLowering - 1.2's plain-data form of a C++ header (#1991).
 *
 * Reads what 1.3's CppResolver declares off the tree while 1.2 still holds
 * it, so no later pass needs the tree. A template declaration is not
 * lowered: 1.3 declares nothing from one.
 */

import type {
  AbstractDeclaratorContext,
  ClassSpecifierContext,
  DeclarationContext,
  DeclaratorContext,
  DeclSpecifierSeqContext,
  EnumSpecifierContext,
  FunctionDefinitionContext,
  MemberdeclarationContext,
  NamespaceDefinitionContext,
  NoPointerDeclaratorContext,
  ParameterDeclarationContext,
  ParametersAndQualifiersContext,
  PointerDeclaratorContext,
  PointerOperatorContext,
  SimpleDeclarationContext,
  TranslationUnitContext,
} from "./grammar/CPP14Parser";
import type ICppHeaderSyntax from "../types/ICppHeaderSyntax";
import type ICppClassSyntax from "../types/ICppClassSyntax";
import type ICppEnumSyntax from "../types/ICppEnumSyntax";
import type ICppFunctionDefinitionSyntax from "../types/ICppFunctionDefinitionSyntax";
import type IHeaderDeclaratorSyntax from "../types/IHeaderDeclaratorSyntax";
import type TCppDeclarationSyntax from "../types/TCppDeclarationSyntax";
import type TCppMemberSyntax from "../types/TCppMemberSyntax";
import type TCppTypeSpecifierSyntax from "../types/TCppTypeSpecifierSyntax";
import type IExtractedParameter from "../shared/IExtractedParameter";
import type ISourceSpan from "../../../types/ISourceSpan";
import ParameterExtractorUtils from "../shared/ParameterExtractorUtils";
import ArrayDimensionText from "../../../utils/ArrayDimensionText";
import ParserUtils from "../../../utils/ParserUtils";

class CppHeaderLowering {
  static header(tree: TranslationUnitContext): ICppHeaderSyntax {
    return {
      declarations: CppHeaderLowering.declarations(
        tree.declarationseq()?.declaration() ?? [],
      ),
    };
  }

  private static declarations(
    decls: DeclarationContext[],
  ): TCppDeclarationSyntax[] {
    const lowered: TCppDeclarationSyntax[] = [];
    for (const decl of decls) {
      const one = CppHeaderLowering.declaration(decl);
      if (one) lowered.push(one);
    }
    return lowered;
  }

  private static declaration(
    decl: DeclarationContext,
  ): TCppDeclarationSyntax | null {
    const span = ParserUtils.getSpan(decl);
    const funcDef = decl.functionDefinition();
    if (funcDef) return CppHeaderLowering.functionDefinition(funcDef, span);
    const nsDef = decl.namespaceDefinition();
    if (nsDef) return CppHeaderLowering.namespace(nsDef, span);
    const block = decl.blockDeclaration();
    const alias = block?.aliasDeclaration();
    if (alias) {
      return { kind: "alias", span, name: alias.Identifier().getText() };
    }
    const simple = block?.simpleDeclaration();
    return simple ? CppHeaderLowering.simpleDeclaration(simple, span) : null;
  }

  private static functionDefinition(
    funcDef: FunctionDefinitionContext,
    span: ISourceSpan,
  ): ICppFunctionDefinitionSyntax {
    const declSpecSeq = funcDef.declSpecifierSeq();
    return {
      kind: "functionDefinition",
      span,
      returnType: declSpecSeq
        ? CppHeaderLowering.baseType(declSpecSeq)
        : "void",
      declarator: CppHeaderLowering.declarator(funcDef.declarator()),
    };
  }

  private static namespace(
    nsDef: NamespaceDefinitionContext,
    span: ISourceSpan,
  ): TCppDeclarationSyntax {
    return {
      kind: "namespace",
      span,
      name:
        nsDef.Identifier()?.getText() ??
        nsDef.originalNamespaceName()?.getText() ??
        null,
      declarations: CppHeaderLowering.declarations(
        nsDef.declarationseq()?.declaration() ?? [],
      ),
    };
  }

  private static simpleDeclaration(
    simple: SimpleDeclarationContext,
    span: ISourceSpan,
  ): TCppDeclarationSyntax | null {
    const declSpecSeq = simple.declSpecifierSeq();
    if (!declSpecSeq) return null;
    return {
      kind: "simple",
      span,
      baseType: CppHeaderLowering.baseType(declSpecSeq),
      isTypedef: declSpecSeq
        .declSpecifier()
        .some((spec) => spec.getText() === "typedef"),
      isVolatile: CppHeaderLowering.isVolatile(declSpecSeq),
      typeSpecifiers: CppHeaderLowering.typeSpecifiers(declSpecSeq),
      declarators:
        simple
          .initDeclaratorList()
          ?.initDeclarator()
          .map((init) => CppHeaderLowering.declarator(init.declarator())) ??
        null,
    };
  }

  private static typeSpecifiers(
    declSpecSeq: DeclSpecifierSeqContext,
  ): TCppTypeSpecifierSyntax[] {
    const specs: TCppTypeSpecifierSyntax[] = [];
    for (const spec of declSpecSeq.declSpecifier()) {
      const typeSpec = spec.typeSpecifier();
      const classSpec = typeSpec?.classSpecifier();
      if (classSpec) {
        specs.push({
          kind: "class",
          class: CppHeaderLowering.classSpecifier(classSpec),
        });
      }
      const enumSpec = typeSpec?.enumSpecifier();
      if (enumSpec) {
        specs.push({
          kind: "enum",
          enum: CppHeaderLowering.enumSpecifier(enumSpec),
        });
      }
    }
    return specs;
  }

  private static classSpecifier(
    classSpec: ClassSpecifierContext,
  ): ICppClassSyntax {
    const memberSpec = classSpec.memberSpecification();
    return {
      name:
        classSpec
          .classHead()
          .classHeadName()
          ?.className()
          .Identifier()
          ?.getText() ?? null,
      members: memberSpec
        ? CppHeaderLowering.members(memberSpec.memberdeclaration())
        : null,
    };
  }

  /**
   * `memberSpecification` is `(memberdeclaration | accessSpecifier ':')+`;
   * the access labels are not lowered, so 1.3 records every member "public"
   * (#1475).
   */
  private static members(
    memberDecls: MemberdeclarationContext[],
  ): TCppMemberSyntax[] {
    const members: TCppMemberSyntax[] = [];
    for (const memberDecl of memberDecls) {
      const span = ParserUtils.getSpan(memberDecl);
      const funcDef = memberDecl.functionDefinition();
      if (funcDef) {
        members.push(CppHeaderLowering.functionDefinition(funcDef, span));
        continue;
      }
      const declSpecSeq = memberDecl.declSpecifierSeq();
      const list = memberDecl.memberDeclaratorList();
      if (!declSpecSeq || !list) continue;
      const declarators: IHeaderDeclaratorSyntax[] = [];
      for (const member of list.memberDeclarator()) {
        const declarator = member.declarator();
        if (declarator) {
          declarators.push(CppHeaderLowering.declarator(declarator));
        }
      }
      members.push({
        kind: "declaration",
        span,
        fieldType: CppHeaderLowering.baseType(declSpecSeq),
        declarators,
      });
    }
    return members;
  }

  private static enumSpecifier(enumSpec: EnumSpecifierContext): ICppEnumSyntax {
    const head = enumSpec.enumHead();
    return {
      name: head.Identifier()?.getText() ?? null,
      baseType: head.enumbase()?.typeSpecifierSeq().getText() ?? null,
    };
  }

  private static declarator(
    declarator: DeclaratorContext,
  ): IHeaderDeclaratorSyntax {
    const pointer = declarator.pointerDeclarator();
    const noPointer = CppHeaderLowering.noPointer(declarator);
    const paramsAndQuals = noPointer?.parametersAndQualifiers() ?? null;
    return {
      name: noPointer ? CppHeaderLowering.noPointerName(noPointer) : null,
      isFunction: paramsAndQuals !== null,
      hasPointer: CppHeaderLowering.hasPointer(pointer),
      pointerDepth: pointer
        ? CppHeaderLowering.starCount(pointer.pointerOperator())
        : 0,
      functionPointerParams:
        paramsAndQuals && CppHeaderLowering.isFunctionPointer(declarator)
          ? paramsAndQuals.getText().slice(1, -1)
          : null,
      parameters: CppHeaderLowering.parameters(paramsAndQuals),
      arrayDimensions: noPointer
        ? ArrayDimensionText.parse(noPointer.getText())
        : [],
    };
  }

  private static noPointer(
    declarator: DeclaratorContext,
  ): NoPointerDeclaratorContext | null {
    return (
      declarator.pointerDeclarator()?.noPointerDeclarator() ??
      declarator.noPointerDeclarator()
    );
  }

  private static declaratorName(declarator: DeclaratorContext): string | null {
    const noPointer = CppHeaderLowering.noPointer(declarator);
    return noPointer ? CppHeaderLowering.noPointerName(noPointer) : null;
  }

  /**
   * A parenthesized pointer declarator, `(*readLevel)` in
   * `float (*readLevel)()`, holds its name inside it (#1760 review).
   */
  private static noPointerName(
    noPointer: NoPointerDeclaratorContext,
  ): string | null {
    const identifier = noPointer
      .declaratorid()
      ?.idExpression()
      .unqualifiedId()
      ?.Identifier();
    if (identifier) return identifier.getText();
    const inner = noPointer.noPointerDeclarator();
    if (inner) return CppHeaderLowering.noPointerName(inner);
    const innerPointer = noPointer.pointerDeclarator();
    return innerPointer
      ? CppHeaderLowering.noPointerName(innerPointer.noPointerDeclarator())
      : null;
  }

  private static hasPointer(pointer: PointerDeclaratorContext | null): boolean {
    return (
      pointer !== null &&
      (pointer.pointerOperator().length > 0 || pointer.getText().includes("*"))
    );
  }

  /**
   * A pointer to a function, `(*readLevel)()`: its parameters apply to a
   * parenthesized pointer declarator, where a function's apply to its name
   * (#1760 review).
   */
  private static isFunctionPointer(declarator: DeclaratorContext): boolean {
    const outer = declarator.pointerDeclarator()?.noPointerDeclarator();
    const inner = outer?.noPointerDeclarator()?.pointerDeclarator();
    return (
      outer?.parametersAndQualifiers() != null &&
      inner != null &&
      CppHeaderLowering.starCount(inner.pointerOperator()) > 0
    );
  }

  /** How many of a declarator's pointer operators are `*`, not `&` */
  private static starCount(operators: PointerOperatorContext[]): number {
    return operators.filter((op) => op.getText().startsWith("*")).length;
  }

  private static parameters(
    paramsAndQuals: ParametersAndQualifiersContext | null,
  ): IExtractedParameter[] {
    const clause = paramsAndQuals?.parameterDeclarationClause();
    if (!clause) return [];
    return ParameterExtractorUtils.processParameterList(
      clause.parameterDeclarationList(),
      (paramDecl: ParameterDeclarationContext) =>
        CppHeaderLowering.parameter(paramDecl),
    );
  }

  /**
   * One `*` whatever the declarator spells -- `Dev**` and a reference alike.
   * The C lowering keeps the depth; this one never has.
   */
  private static parameter(
    paramDecl: ParameterDeclarationContext,
  ): IExtractedParameter {
    const declSpecSeq = paramDecl.declSpecifierSeq();
    const baseType = CppHeaderLowering.baseType(declSpecSeq);
    const declarator = paramDecl.declarator();
    const abstractDecl = paramDecl.abstractDeclarator();
    const isPointer =
      (declarator !== null &&
        CppHeaderLowering.hasPointer(declarator.pointerDeclarator())) ||
      (abstractDecl !== null &&
        CppHeaderLowering.abstractHasPointer(abstractDecl));
    return ParameterExtractorUtils.buildParameterInfo(
      declarator,
      isPointer ? `${baseType}*` : baseType,
      declSpecSeq.getText().includes("const"),
      false,
      (decl: DeclaratorContext) => CppHeaderLowering.declaratorName(decl),
    );
  }

  private static abstractHasPointer(
    abstractDecl: AbstractDeclaratorContext,
  ): boolean {
    return (
      (abstractDecl.pointerAbstractDeclarator()?.pointerOperator().length ??
        0) > 0 || abstractDecl.getText().includes("*")
    );
  }

  /**
   * Whether a declaration is `volatile` (#1760 review): the base type keeps
   * simple type specifiers alone, so it drops the qualifier.
   */
  private static isVolatile(declSpecSeq: DeclSpecifierSeqContext): boolean {
    return declSpecSeq
      .declSpecifier()
      .some(
        (spec) =>
          spec
            .typeSpecifier()
            ?.trailingTypeSpecifier()
            ?.cvQualifier()
            ?.getText() === "volatile",
      );
  }

  private static baseType(declSpecSeq: DeclSpecifierSeqContext): string {
    const parts: string[] = [];
    for (const spec of declSpecSeq.declSpecifier()) {
      const simple = spec
        .typeSpecifier()
        ?.trailingTypeSpecifier()
        ?.simpleTypeSpecifier();
      if (simple) parts.push(simple.getText());
    }
    return parts.join(" ") || "int";
  }
}

export default CppHeaderLowering;
