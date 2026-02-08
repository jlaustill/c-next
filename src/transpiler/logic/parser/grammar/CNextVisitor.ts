// Generated from grammar/CNext.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


import { ProgramContext } from "./CNextParser.js";
import { IncludeDirectiveContext } from "./CNextParser.js";
import { PreprocessorDirectiveContext } from "./CNextParser.js";
import { DefineDirectiveContext } from "./CNextParser.js";
import { ConditionalDirectiveContext } from "./CNextParser.js";
import { PragmaDirectiveContext } from "./CNextParser.js";
import { DeclarationContext } from "./CNextParser.js";
import { ScopeDeclarationContext } from "./CNextParser.js";
import { ScopeMemberContext } from "./CNextParser.js";
import { VisibilityModifierContext } from "./CNextParser.js";
import { RegisterDeclarationContext } from "./CNextParser.js";
import { RegisterMemberContext } from "./CNextParser.js";
import { AccessModifierContext } from "./CNextParser.js";
import { StructDeclarationContext } from "./CNextParser.js";
import { StructMemberContext } from "./CNextParser.js";
import { EnumDeclarationContext } from "./CNextParser.js";
import { EnumMemberContext } from "./CNextParser.js";
import { BitmapDeclarationContext } from "./CNextParser.js";
import { BitmapTypeContext } from "./CNextParser.js";
import { BitmapMemberContext } from "./CNextParser.js";
import { FunctionDeclarationContext } from "./CNextParser.js";
import { ParameterListContext } from "./CNextParser.js";
import { ParameterContext } from "./CNextParser.js";
import { ConstModifierContext } from "./CNextParser.js";
import { VolatileModifierContext } from "./CNextParser.js";
import { OverflowModifierContext } from "./CNextParser.js";
import { AtomicModifierContext } from "./CNextParser.js";
import { ArrayDimensionContext } from "./CNextParser.js";
import { VariableDeclarationContext } from "./CNextParser.js";
import { ConstructorArgumentListContext } from "./CNextParser.js";
import { BlockContext } from "./CNextParser.js";
import { StatementContext } from "./CNextParser.js";
import { CriticalStatementContext } from "./CNextParser.js";
import { AssignmentStatementContext } from "./CNextParser.js";
import { AssignmentOperatorContext } from "./CNextParser.js";
import { AssignmentTargetContext } from "./CNextParser.js";
import { PostfixTargetOpContext } from "./CNextParser.js";
import { ExpressionStatementContext } from "./CNextParser.js";
import { IfStatementContext } from "./CNextParser.js";
import { WhileStatementContext } from "./CNextParser.js";
import { DoWhileStatementContext } from "./CNextParser.js";
import { ForStatementContext } from "./CNextParser.js";
import { ForInitContext } from "./CNextParser.js";
import { ForVarDeclContext } from "./CNextParser.js";
import { ForAssignmentContext } from "./CNextParser.js";
import { ForUpdateContext } from "./CNextParser.js";
import { ReturnStatementContext } from "./CNextParser.js";
import { SwitchStatementContext } from "./CNextParser.js";
import { SwitchCaseContext } from "./CNextParser.js";
import { CaseLabelContext } from "./CNextParser.js";
import { DefaultCaseContext } from "./CNextParser.js";
import { ExpressionContext } from "./CNextParser.js";
import { TernaryExpressionContext } from "./CNextParser.js";
import { OrExpressionContext } from "./CNextParser.js";
import { AndExpressionContext } from "./CNextParser.js";
import { EqualityExpressionContext } from "./CNextParser.js";
import { RelationalExpressionContext } from "./CNextParser.js";
import { BitwiseOrExpressionContext } from "./CNextParser.js";
import { BitwiseXorExpressionContext } from "./CNextParser.js";
import { BitwiseAndExpressionContext } from "./CNextParser.js";
import { ShiftExpressionContext } from "./CNextParser.js";
import { AdditiveExpressionContext } from "./CNextParser.js";
import { MultiplicativeExpressionContext } from "./CNextParser.js";
import { UnaryExpressionContext } from "./CNextParser.js";
import { PostfixExpressionContext } from "./CNextParser.js";
import { PostfixOpContext } from "./CNextParser.js";
import { PrimaryExpressionContext } from "./CNextParser.js";
import { SizeofExpressionContext } from "./CNextParser.js";
import { CastExpressionContext } from "./CNextParser.js";
import { StructInitializerContext } from "./CNextParser.js";
import { FieldInitializerListContext } from "./CNextParser.js";
import { FieldInitializerContext } from "./CNextParser.js";
import { ArrayInitializerContext } from "./CNextParser.js";
import { ArrayInitializerElementContext } from "./CNextParser.js";
import { ArgumentListContext } from "./CNextParser.js";
import { TypeContext } from "./CNextParser.js";
import { ScopedTypeContext } from "./CNextParser.js";
import { GlobalTypeContext } from "./CNextParser.js";
import { QualifiedTypeContext } from "./CNextParser.js";
import { PrimitiveTypeContext } from "./CNextParser.js";
import { UserTypeContext } from "./CNextParser.js";
import { TemplateTypeContext } from "./CNextParser.js";
import { TemplateArgumentListContext } from "./CNextParser.js";
import { TemplateArgumentContext } from "./CNextParser.js";
import { StringTypeContext } from "./CNextParser.js";
import { ArrayTypeContext } from "./CNextParser.js";
import { LiteralContext } from "./CNextParser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `CNextParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class CNextVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `CNextParser.program`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitProgram?: (ctx: ProgramContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.includeDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIncludeDirective?: (ctx: IncludeDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.preprocessorDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.defineDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefineDirective?: (ctx: DefineDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.conditionalDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionalDirective?: (ctx: ConditionalDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.pragmaDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPragmaDirective?: (ctx: PragmaDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.scopeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopeDeclaration?: (ctx: ScopeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.scopeMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopeMember?: (ctx: ScopeMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.visibilityModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVisibilityModifier?: (ctx: VisibilityModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.registerDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterDeclaration?: (ctx: RegisterDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.registerMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRegisterMember?: (ctx: RegisterMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.accessModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAccessModifier?: (ctx: AccessModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.structDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructDeclaration?: (ctx: StructDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.structMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructMember?: (ctx: StructMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.enumDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumDeclaration?: (ctx: EnumDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.enumMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumMember?: (ctx: EnumMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitmapDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapDeclaration?: (ctx: BitmapDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitmapType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapType?: (ctx: BitmapTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitmapMember`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitmapMember?: (ctx: BitmapMemberContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.functionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.parameterList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterList?: (ctx: ParameterListContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.parameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameter?: (ctx: ParameterContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.constModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstModifier?: (ctx: ConstModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.volatileModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVolatileModifier?: (ctx: VolatileModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.overflowModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOverflowModifier?: (ctx: OverflowModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.atomicModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAtomicModifier?: (ctx: AtomicModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.arrayDimension`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayDimension?: (ctx: ArrayDimensionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.variableDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVariableDeclaration?: (ctx: VariableDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.constructorArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.block`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlock?: (ctx: BlockContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.statement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatement?: (ctx: StatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.criticalStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCriticalStatement?: (ctx: CriticalStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.assignmentStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentStatement?: (ctx: AssignmentStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.assignmentOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentOperator?: (ctx: AssignmentOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.assignmentTarget`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentTarget?: (ctx: AssignmentTargetContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.postfixTargetOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixTargetOp?: (ctx: PostfixTargetOpContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.expressionStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpressionStatement?: (ctx: ExpressionStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.ifStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIfStatement?: (ctx: IfStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.whileStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitWhileStatement?: (ctx: WhileStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.doWhileStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDoWhileStatement?: (ctx: DoWhileStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.forStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForStatement?: (ctx: ForStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.forInit`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForInit?: (ctx: ForInitContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.forVarDecl`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForVarDecl?: (ctx: ForVarDeclContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.forAssignment`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForAssignment?: (ctx: ForAssignmentContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.forUpdate`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForUpdate?: (ctx: ForUpdateContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.returnStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitReturnStatement?: (ctx: ReturnStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.switchStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSwitchStatement?: (ctx: SwitchStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.switchCase`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSwitchCase?: (ctx: SwitchCaseContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.caseLabel`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaseLabel?: (ctx: CaseLabelContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.defaultCase`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDefaultCase?: (ctx: DefaultCaseContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.ternaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTernaryExpression?: (ctx: TernaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.orExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOrExpression?: (ctx: OrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.andExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAndExpression?: (ctx: AndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.equalityExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEqualityExpression?: (ctx: EqualityExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.relationalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRelationalExpression?: (ctx: RelationalExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.shiftExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitShiftExpression?: (ctx: ShiftExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.additiveExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAdditiveExpression?: (ctx: AdditiveExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.multiplicativeExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.unaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnaryExpression?: (ctx: UnaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.postfixExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixExpression?: (ctx: PostfixExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.postfixOp`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixOp?: (ctx: PostfixOpContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.primaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimaryExpression?: (ctx: PrimaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.sizeofExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSizeofExpression?: (ctx: SizeofExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.castExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCastExpression?: (ctx: CastExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.structInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStructInitializer?: (ctx: StructInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.fieldInitializerList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldInitializerList?: (ctx: FieldInitializerListContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.fieldInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFieldInitializer?: (ctx: FieldInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.arrayInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayInitializer?: (ctx: ArrayInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.arrayInitializerElement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.argumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArgumentList?: (ctx: ArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.type`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitType?: (ctx: TypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.scopedType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitScopedType?: (ctx: ScopedTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.globalType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitGlobalType?: (ctx: GlobalTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.qualifiedType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedType?: (ctx: QualifiedTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.primitiveType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimitiveType?: (ctx: PrimitiveTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.userType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUserType?: (ctx: UserTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.templateType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateType?: (ctx: TemplateTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.templateArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.templateArgument`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgument?: (ctx: TemplateArgumentContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.stringType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStringType?: (ctx: StringTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.arrayType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitArrayType?: (ctx: ArrayTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CNextParser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
}

