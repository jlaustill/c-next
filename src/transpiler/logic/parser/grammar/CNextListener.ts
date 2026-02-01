// Generated from grammar/CNext.g4 by ANTLR 4.13.1

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


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
import { MemberAccessContext } from "./CNextParser.js";
import { ArrayAccessContext } from "./CNextParser.js";
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
 * This interface defines a complete listener for a parse tree produced by
 * `CNextParser`.
 */
export class CNextListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `CNextParser.program`.
     * @param ctx the parse tree
     */
    enterProgram?: (ctx: ProgramContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.program`.
     * @param ctx the parse tree
     */
    exitProgram?: (ctx: ProgramContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.includeDirective`.
     * @param ctx the parse tree
     */
    enterIncludeDirective?: (ctx: IncludeDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.includeDirective`.
     * @param ctx the parse tree
     */
    exitIncludeDirective?: (ctx: IncludeDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.preprocessorDirective`.
     * @param ctx the parse tree
     */
    enterPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.preprocessorDirective`.
     * @param ctx the parse tree
     */
    exitPreprocessorDirective?: (ctx: PreprocessorDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.defineDirective`.
     * @param ctx the parse tree
     */
    enterDefineDirective?: (ctx: DefineDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.defineDirective`.
     * @param ctx the parse tree
     */
    exitDefineDirective?: (ctx: DefineDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.conditionalDirective`.
     * @param ctx the parse tree
     */
    enterConditionalDirective?: (ctx: ConditionalDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.conditionalDirective`.
     * @param ctx the parse tree
     */
    exitConditionalDirective?: (ctx: ConditionalDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.pragmaDirective`.
     * @param ctx the parse tree
     */
    enterPragmaDirective?: (ctx: PragmaDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.pragmaDirective`.
     * @param ctx the parse tree
     */
    exitPragmaDirective?: (ctx: PragmaDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.declaration`.
     * @param ctx the parse tree
     */
    enterDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.declaration`.
     * @param ctx the parse tree
     */
    exitDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.scopeDeclaration`.
     * @param ctx the parse tree
     */
    enterScopeDeclaration?: (ctx: ScopeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.scopeDeclaration`.
     * @param ctx the parse tree
     */
    exitScopeDeclaration?: (ctx: ScopeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.scopeMember`.
     * @param ctx the parse tree
     */
    enterScopeMember?: (ctx: ScopeMemberContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.scopeMember`.
     * @param ctx the parse tree
     */
    exitScopeMember?: (ctx: ScopeMemberContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.visibilityModifier`.
     * @param ctx the parse tree
     */
    enterVisibilityModifier?: (ctx: VisibilityModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.visibilityModifier`.
     * @param ctx the parse tree
     */
    exitVisibilityModifier?: (ctx: VisibilityModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.registerDeclaration`.
     * @param ctx the parse tree
     */
    enterRegisterDeclaration?: (ctx: RegisterDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.registerDeclaration`.
     * @param ctx the parse tree
     */
    exitRegisterDeclaration?: (ctx: RegisterDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.registerMember`.
     * @param ctx the parse tree
     */
    enterRegisterMember?: (ctx: RegisterMemberContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.registerMember`.
     * @param ctx the parse tree
     */
    exitRegisterMember?: (ctx: RegisterMemberContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.accessModifier`.
     * @param ctx the parse tree
     */
    enterAccessModifier?: (ctx: AccessModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.accessModifier`.
     * @param ctx the parse tree
     */
    exitAccessModifier?: (ctx: AccessModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.structDeclaration`.
     * @param ctx the parse tree
     */
    enterStructDeclaration?: (ctx: StructDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.structDeclaration`.
     * @param ctx the parse tree
     */
    exitStructDeclaration?: (ctx: StructDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.structMember`.
     * @param ctx the parse tree
     */
    enterStructMember?: (ctx: StructMemberContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.structMember`.
     * @param ctx the parse tree
     */
    exitStructMember?: (ctx: StructMemberContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.enumDeclaration`.
     * @param ctx the parse tree
     */
    enterEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.enumDeclaration`.
     * @param ctx the parse tree
     */
    exitEnumDeclaration?: (ctx: EnumDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.enumMember`.
     * @param ctx the parse tree
     */
    enterEnumMember?: (ctx: EnumMemberContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.enumMember`.
     * @param ctx the parse tree
     */
    exitEnumMember?: (ctx: EnumMemberContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitmapDeclaration`.
     * @param ctx the parse tree
     */
    enterBitmapDeclaration?: (ctx: BitmapDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitmapDeclaration`.
     * @param ctx the parse tree
     */
    exitBitmapDeclaration?: (ctx: BitmapDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitmapType`.
     * @param ctx the parse tree
     */
    enterBitmapType?: (ctx: BitmapTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitmapType`.
     * @param ctx the parse tree
     */
    exitBitmapType?: (ctx: BitmapTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitmapMember`.
     * @param ctx the parse tree
     */
    enterBitmapMember?: (ctx: BitmapMemberContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitmapMember`.
     * @param ctx the parse tree
     */
    exitBitmapMember?: (ctx: BitmapMemberContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.functionDeclaration`.
     * @param ctx the parse tree
     */
    enterFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.functionDeclaration`.
     * @param ctx the parse tree
     */
    exitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.parameterList`.
     * @param ctx the parse tree
     */
    enterParameterList?: (ctx: ParameterListContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.parameterList`.
     * @param ctx the parse tree
     */
    exitParameterList?: (ctx: ParameterListContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.parameter`.
     * @param ctx the parse tree
     */
    enterParameter?: (ctx: ParameterContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.parameter`.
     * @param ctx the parse tree
     */
    exitParameter?: (ctx: ParameterContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.constModifier`.
     * @param ctx the parse tree
     */
    enterConstModifier?: (ctx: ConstModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.constModifier`.
     * @param ctx the parse tree
     */
    exitConstModifier?: (ctx: ConstModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.volatileModifier`.
     * @param ctx the parse tree
     */
    enterVolatileModifier?: (ctx: VolatileModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.volatileModifier`.
     * @param ctx the parse tree
     */
    exitVolatileModifier?: (ctx: VolatileModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.overflowModifier`.
     * @param ctx the parse tree
     */
    enterOverflowModifier?: (ctx: OverflowModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.overflowModifier`.
     * @param ctx the parse tree
     */
    exitOverflowModifier?: (ctx: OverflowModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.atomicModifier`.
     * @param ctx the parse tree
     */
    enterAtomicModifier?: (ctx: AtomicModifierContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.atomicModifier`.
     * @param ctx the parse tree
     */
    exitAtomicModifier?: (ctx: AtomicModifierContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.arrayDimension`.
     * @param ctx the parse tree
     */
    enterArrayDimension?: (ctx: ArrayDimensionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.arrayDimension`.
     * @param ctx the parse tree
     */
    exitArrayDimension?: (ctx: ArrayDimensionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.variableDeclaration`.
     * @param ctx the parse tree
     */
    enterVariableDeclaration?: (ctx: VariableDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.variableDeclaration`.
     * @param ctx the parse tree
     */
    exitVariableDeclaration?: (ctx: VariableDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.constructorArgumentList`.
     * @param ctx the parse tree
     */
    enterConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.constructorArgumentList`.
     * @param ctx the parse tree
     */
    exitConstructorArgumentList?: (ctx: ConstructorArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.block`.
     * @param ctx the parse tree
     */
    enterBlock?: (ctx: BlockContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.block`.
     * @param ctx the parse tree
     */
    exitBlock?: (ctx: BlockContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.statement`.
     * @param ctx the parse tree
     */
    enterStatement?: (ctx: StatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.statement`.
     * @param ctx the parse tree
     */
    exitStatement?: (ctx: StatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.criticalStatement`.
     * @param ctx the parse tree
     */
    enterCriticalStatement?: (ctx: CriticalStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.criticalStatement`.
     * @param ctx the parse tree
     */
    exitCriticalStatement?: (ctx: CriticalStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.assignmentStatement`.
     * @param ctx the parse tree
     */
    enterAssignmentStatement?: (ctx: AssignmentStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.assignmentStatement`.
     * @param ctx the parse tree
     */
    exitAssignmentStatement?: (ctx: AssignmentStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.assignmentOperator`.
     * @param ctx the parse tree
     */
    enterAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.assignmentOperator`.
     * @param ctx the parse tree
     */
    exitAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.assignmentTarget`.
     * @param ctx the parse tree
     */
    enterAssignmentTarget?: (ctx: AssignmentTargetContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.assignmentTarget`.
     * @param ctx the parse tree
     */
    exitAssignmentTarget?: (ctx: AssignmentTargetContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.postfixTargetOp`.
     * @param ctx the parse tree
     */
    enterPostfixTargetOp?: (ctx: PostfixTargetOpContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.postfixTargetOp`.
     * @param ctx the parse tree
     */
    exitPostfixTargetOp?: (ctx: PostfixTargetOpContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.expressionStatement`.
     * @param ctx the parse tree
     */
    enterExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.expressionStatement`.
     * @param ctx the parse tree
     */
    exitExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.ifStatement`.
     * @param ctx the parse tree
     */
    enterIfStatement?: (ctx: IfStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.ifStatement`.
     * @param ctx the parse tree
     */
    exitIfStatement?: (ctx: IfStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.whileStatement`.
     * @param ctx the parse tree
     */
    enterWhileStatement?: (ctx: WhileStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.whileStatement`.
     * @param ctx the parse tree
     */
    exitWhileStatement?: (ctx: WhileStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.doWhileStatement`.
     * @param ctx the parse tree
     */
    enterDoWhileStatement?: (ctx: DoWhileStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.doWhileStatement`.
     * @param ctx the parse tree
     */
    exitDoWhileStatement?: (ctx: DoWhileStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.forStatement`.
     * @param ctx the parse tree
     */
    enterForStatement?: (ctx: ForStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.forStatement`.
     * @param ctx the parse tree
     */
    exitForStatement?: (ctx: ForStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.forInit`.
     * @param ctx the parse tree
     */
    enterForInit?: (ctx: ForInitContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.forInit`.
     * @param ctx the parse tree
     */
    exitForInit?: (ctx: ForInitContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.forVarDecl`.
     * @param ctx the parse tree
     */
    enterForVarDecl?: (ctx: ForVarDeclContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.forVarDecl`.
     * @param ctx the parse tree
     */
    exitForVarDecl?: (ctx: ForVarDeclContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.forAssignment`.
     * @param ctx the parse tree
     */
    enterForAssignment?: (ctx: ForAssignmentContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.forAssignment`.
     * @param ctx the parse tree
     */
    exitForAssignment?: (ctx: ForAssignmentContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.forUpdate`.
     * @param ctx the parse tree
     */
    enterForUpdate?: (ctx: ForUpdateContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.forUpdate`.
     * @param ctx the parse tree
     */
    exitForUpdate?: (ctx: ForUpdateContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.returnStatement`.
     * @param ctx the parse tree
     */
    enterReturnStatement?: (ctx: ReturnStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.returnStatement`.
     * @param ctx the parse tree
     */
    exitReturnStatement?: (ctx: ReturnStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.switchStatement`.
     * @param ctx the parse tree
     */
    enterSwitchStatement?: (ctx: SwitchStatementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.switchStatement`.
     * @param ctx the parse tree
     */
    exitSwitchStatement?: (ctx: SwitchStatementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.switchCase`.
     * @param ctx the parse tree
     */
    enterSwitchCase?: (ctx: SwitchCaseContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.switchCase`.
     * @param ctx the parse tree
     */
    exitSwitchCase?: (ctx: SwitchCaseContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.caseLabel`.
     * @param ctx the parse tree
     */
    enterCaseLabel?: (ctx: CaseLabelContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.caseLabel`.
     * @param ctx the parse tree
     */
    exitCaseLabel?: (ctx: CaseLabelContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.defaultCase`.
     * @param ctx the parse tree
     */
    enterDefaultCase?: (ctx: DefaultCaseContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.defaultCase`.
     * @param ctx the parse tree
     */
    exitDefaultCase?: (ctx: DefaultCaseContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.ternaryExpression`.
     * @param ctx the parse tree
     */
    enterTernaryExpression?: (ctx: TernaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.ternaryExpression`.
     * @param ctx the parse tree
     */
    exitTernaryExpression?: (ctx: TernaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.orExpression`.
     * @param ctx the parse tree
     */
    enterOrExpression?: (ctx: OrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.orExpression`.
     * @param ctx the parse tree
     */
    exitOrExpression?: (ctx: OrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.andExpression`.
     * @param ctx the parse tree
     */
    enterAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.andExpression`.
     * @param ctx the parse tree
     */
    exitAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.equalityExpression`.
     * @param ctx the parse tree
     */
    enterEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.equalityExpression`.
     * @param ctx the parse tree
     */
    exitEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.relationalExpression`.
     * @param ctx the parse tree
     */
    enterRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.relationalExpression`.
     * @param ctx the parse tree
     */
    exitRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitwiseOrExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseOrExpression?: (ctx: BitwiseOrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitwiseXorExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseXorExpression?: (ctx: BitwiseXorExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     */
    enterBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.bitwiseAndExpression`.
     * @param ctx the parse tree
     */
    exitBitwiseAndExpression?: (ctx: BitwiseAndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.shiftExpression`.
     * @param ctx the parse tree
     */
    enterShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.shiftExpression`.
     * @param ctx the parse tree
     */
    exitShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.additiveExpression`.
     * @param ctx the parse tree
     */
    enterAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.additiveExpression`.
     * @param ctx the parse tree
     */
    exitAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    enterMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    exitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.unaryExpression`.
     * @param ctx the parse tree
     */
    enterUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.unaryExpression`.
     * @param ctx the parse tree
     */
    exitUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.postfixExpression`.
     * @param ctx the parse tree
     */
    enterPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.postfixExpression`.
     * @param ctx the parse tree
     */
    exitPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.postfixOp`.
     * @param ctx the parse tree
     */
    enterPostfixOp?: (ctx: PostfixOpContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.postfixOp`.
     * @param ctx the parse tree
     */
    exitPostfixOp?: (ctx: PostfixOpContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.primaryExpression`.
     * @param ctx the parse tree
     */
    enterPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.primaryExpression`.
     * @param ctx the parse tree
     */
    exitPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.sizeofExpression`.
     * @param ctx the parse tree
     */
    enterSizeofExpression?: (ctx: SizeofExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.sizeofExpression`.
     * @param ctx the parse tree
     */
    exitSizeofExpression?: (ctx: SizeofExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.castExpression`.
     * @param ctx the parse tree
     */
    enterCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.castExpression`.
     * @param ctx the parse tree
     */
    exitCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.structInitializer`.
     * @param ctx the parse tree
     */
    enterStructInitializer?: (ctx: StructInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.structInitializer`.
     * @param ctx the parse tree
     */
    exitStructInitializer?: (ctx: StructInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.fieldInitializerList`.
     * @param ctx the parse tree
     */
    enterFieldInitializerList?: (ctx: FieldInitializerListContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.fieldInitializerList`.
     * @param ctx the parse tree
     */
    exitFieldInitializerList?: (ctx: FieldInitializerListContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.fieldInitializer`.
     * @param ctx the parse tree
     */
    enterFieldInitializer?: (ctx: FieldInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.fieldInitializer`.
     * @param ctx the parse tree
     */
    exitFieldInitializer?: (ctx: FieldInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.arrayInitializer`.
     * @param ctx the parse tree
     */
    enterArrayInitializer?: (ctx: ArrayInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.arrayInitializer`.
     * @param ctx the parse tree
     */
    exitArrayInitializer?: (ctx: ArrayInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.arrayInitializerElement`.
     * @param ctx the parse tree
     */
    enterArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.arrayInitializerElement`.
     * @param ctx the parse tree
     */
    exitArrayInitializerElement?: (ctx: ArrayInitializerElementContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.memberAccess`.
     * @param ctx the parse tree
     */
    enterMemberAccess?: (ctx: MemberAccessContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.memberAccess`.
     * @param ctx the parse tree
     */
    exitMemberAccess?: (ctx: MemberAccessContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.arrayAccess`.
     * @param ctx the parse tree
     */
    enterArrayAccess?: (ctx: ArrayAccessContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.arrayAccess`.
     * @param ctx the parse tree
     */
    exitArrayAccess?: (ctx: ArrayAccessContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.argumentList`.
     * @param ctx the parse tree
     */
    enterArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.argumentList`.
     * @param ctx the parse tree
     */
    exitArgumentList?: (ctx: ArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.type`.
     * @param ctx the parse tree
     */
    enterType?: (ctx: TypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.type`.
     * @param ctx the parse tree
     */
    exitType?: (ctx: TypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.scopedType`.
     * @param ctx the parse tree
     */
    enterScopedType?: (ctx: ScopedTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.scopedType`.
     * @param ctx the parse tree
     */
    exitScopedType?: (ctx: ScopedTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.globalType`.
     * @param ctx the parse tree
     */
    enterGlobalType?: (ctx: GlobalTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.globalType`.
     * @param ctx the parse tree
     */
    exitGlobalType?: (ctx: GlobalTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.qualifiedType`.
     * @param ctx the parse tree
     */
    enterQualifiedType?: (ctx: QualifiedTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.qualifiedType`.
     * @param ctx the parse tree
     */
    exitQualifiedType?: (ctx: QualifiedTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.primitiveType`.
     * @param ctx the parse tree
     */
    enterPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.primitiveType`.
     * @param ctx the parse tree
     */
    exitPrimitiveType?: (ctx: PrimitiveTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.userType`.
     * @param ctx the parse tree
     */
    enterUserType?: (ctx: UserTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.userType`.
     * @param ctx the parse tree
     */
    exitUserType?: (ctx: UserTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.templateType`.
     * @param ctx the parse tree
     */
    enterTemplateType?: (ctx: TemplateTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.templateType`.
     * @param ctx the parse tree
     */
    exitTemplateType?: (ctx: TemplateTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.templateArgumentList`.
     * @param ctx the parse tree
     */
    enterTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.templateArgumentList`.
     * @param ctx the parse tree
     */
    exitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.templateArgument`.
     * @param ctx the parse tree
     */
    enterTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.templateArgument`.
     * @param ctx the parse tree
     */
    exitTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.stringType`.
     * @param ctx the parse tree
     */
    enterStringType?: (ctx: StringTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.stringType`.
     * @param ctx the parse tree
     */
    exitStringType?: (ctx: StringTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.arrayType`.
     * @param ctx the parse tree
     */
    enterArrayType?: (ctx: ArrayTypeContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.arrayType`.
     * @param ctx the parse tree
     */
    exitArrayType?: (ctx: ArrayTypeContext) => void;
    /**
     * Enter a parse tree produced by `CNextParser.literal`.
     * @param ctx the parse tree
     */
    enterLiteral?: (ctx: LiteralContext) => void;
    /**
     * Exit a parse tree produced by `CNextParser.literal`.
     * @param ctx the parse tree
     */
    exitLiteral?: (ctx: LiteralContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

