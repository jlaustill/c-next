// Generated from grammar/CPP14Parser.g4 by ANTLR 4.13.1

import { AbstractParseTreeVisitor } from "antlr4ng";


import { TranslationUnitContext } from "./CPP14Parser.js";
import { PrimaryExpressionContext } from "./CPP14Parser.js";
import { IdExpressionContext } from "./CPP14Parser.js";
import { UnqualifiedIdContext } from "./CPP14Parser.js";
import { QualifiedIdContext } from "./CPP14Parser.js";
import { NestedNameSpecifierContext } from "./CPP14Parser.js";
import { LambdaExpressionContext } from "./CPP14Parser.js";
import { LambdaIntroducerContext } from "./CPP14Parser.js";
import { LambdaCaptureContext } from "./CPP14Parser.js";
import { CaptureDefaultContext } from "./CPP14Parser.js";
import { CaptureListContext } from "./CPP14Parser.js";
import { CaptureContext } from "./CPP14Parser.js";
import { SimpleCaptureContext } from "./CPP14Parser.js";
import { InitcaptureContext } from "./CPP14Parser.js";
import { LambdaDeclaratorContext } from "./CPP14Parser.js";
import { PostfixExpressionContext } from "./CPP14Parser.js";
import { TypeIdOfTheTypeIdContext } from "./CPP14Parser.js";
import { ExpressionListContext } from "./CPP14Parser.js";
import { PseudoDestructorNameContext } from "./CPP14Parser.js";
import { UnaryExpressionContext } from "./CPP14Parser.js";
import { UnaryOperatorContext } from "./CPP14Parser.js";
import { NewExpression_Context } from "./CPP14Parser.js";
import { NewPlacementContext } from "./CPP14Parser.js";
import { NewTypeIdContext } from "./CPP14Parser.js";
import { NewDeclarator_Context } from "./CPP14Parser.js";
import { NoPointerNewDeclaratorContext } from "./CPP14Parser.js";
import { NewInitializer_Context } from "./CPP14Parser.js";
import { DeleteExpressionContext } from "./CPP14Parser.js";
import { NoExceptExpressionContext } from "./CPP14Parser.js";
import { CastExpressionContext } from "./CPP14Parser.js";
import { PointerMemberExpressionContext } from "./CPP14Parser.js";
import { MultiplicativeExpressionContext } from "./CPP14Parser.js";
import { AdditiveExpressionContext } from "./CPP14Parser.js";
import { ShiftExpressionContext } from "./CPP14Parser.js";
import { ShiftOperatorContext } from "./CPP14Parser.js";
import { RelationalExpressionContext } from "./CPP14Parser.js";
import { EqualityExpressionContext } from "./CPP14Parser.js";
import { AndExpressionContext } from "./CPP14Parser.js";
import { ExclusiveOrExpressionContext } from "./CPP14Parser.js";
import { InclusiveOrExpressionContext } from "./CPP14Parser.js";
import { LogicalAndExpressionContext } from "./CPP14Parser.js";
import { LogicalOrExpressionContext } from "./CPP14Parser.js";
import { ConditionalExpressionContext } from "./CPP14Parser.js";
import { AssignmentExpressionContext } from "./CPP14Parser.js";
import { AssignmentOperatorContext } from "./CPP14Parser.js";
import { ExpressionContext } from "./CPP14Parser.js";
import { ConstantExpressionContext } from "./CPP14Parser.js";
import { StatementContext } from "./CPP14Parser.js";
import { LabeledStatementContext } from "./CPP14Parser.js";
import { ExpressionStatementContext } from "./CPP14Parser.js";
import { CompoundStatementContext } from "./CPP14Parser.js";
import { StatementSeqContext } from "./CPP14Parser.js";
import { SelectionStatementContext } from "./CPP14Parser.js";
import { ConditionContext } from "./CPP14Parser.js";
import { IterationStatementContext } from "./CPP14Parser.js";
import { ForInitStatementContext } from "./CPP14Parser.js";
import { ForRangeDeclarationContext } from "./CPP14Parser.js";
import { ForRangeInitializerContext } from "./CPP14Parser.js";
import { JumpStatementContext } from "./CPP14Parser.js";
import { DeclarationStatementContext } from "./CPP14Parser.js";
import { DeclarationseqContext } from "./CPP14Parser.js";
import { DeclarationContext } from "./CPP14Parser.js";
import { BlockDeclarationContext } from "./CPP14Parser.js";
import { AliasDeclarationContext } from "./CPP14Parser.js";
import { SimpleDeclarationContext } from "./CPP14Parser.js";
import { StaticAssertDeclarationContext } from "./CPP14Parser.js";
import { EmptyDeclaration_Context } from "./CPP14Parser.js";
import { AttributeDeclarationContext } from "./CPP14Parser.js";
import { DeclSpecifierContext } from "./CPP14Parser.js";
import { DeclSpecifierSeqContext } from "./CPP14Parser.js";
import { StorageClassSpecifierContext } from "./CPP14Parser.js";
import { FunctionSpecifierContext } from "./CPP14Parser.js";
import { TypedefNameContext } from "./CPP14Parser.js";
import { TypeSpecifierContext } from "./CPP14Parser.js";
import { TrailingTypeSpecifierContext } from "./CPP14Parser.js";
import { TypeSpecifierSeqContext } from "./CPP14Parser.js";
import { TrailingTypeSpecifierSeqContext } from "./CPP14Parser.js";
import { SimpleTypeLengthModifierContext } from "./CPP14Parser.js";
import { SimpleTypeSignednessModifierContext } from "./CPP14Parser.js";
import { SimpleTypeSpecifierContext } from "./CPP14Parser.js";
import { TheTypeNameContext } from "./CPP14Parser.js";
import { DecltypeSpecifierContext } from "./CPP14Parser.js";
import { ElaboratedTypeSpecifierContext } from "./CPP14Parser.js";
import { EnumNameContext } from "./CPP14Parser.js";
import { EnumSpecifierContext } from "./CPP14Parser.js";
import { EnumHeadContext } from "./CPP14Parser.js";
import { OpaqueEnumDeclarationContext } from "./CPP14Parser.js";
import { EnumkeyContext } from "./CPP14Parser.js";
import { EnumbaseContext } from "./CPP14Parser.js";
import { EnumeratorListContext } from "./CPP14Parser.js";
import { EnumeratorDefinitionContext } from "./CPP14Parser.js";
import { EnumeratorContext } from "./CPP14Parser.js";
import { NamespaceNameContext } from "./CPP14Parser.js";
import { OriginalNamespaceNameContext } from "./CPP14Parser.js";
import { NamespaceDefinitionContext } from "./CPP14Parser.js";
import { NamespaceAliasContext } from "./CPP14Parser.js";
import { NamespaceAliasDefinitionContext } from "./CPP14Parser.js";
import { QualifiednamespacespecifierContext } from "./CPP14Parser.js";
import { UsingDeclarationContext } from "./CPP14Parser.js";
import { UsingDirectiveContext } from "./CPP14Parser.js";
import { AsmDefinitionContext } from "./CPP14Parser.js";
import { LinkageSpecificationContext } from "./CPP14Parser.js";
import { AttributeSpecifierSeqContext } from "./CPP14Parser.js";
import { AttributeSpecifierContext } from "./CPP14Parser.js";
import { AlignmentspecifierContext } from "./CPP14Parser.js";
import { AttributeListContext } from "./CPP14Parser.js";
import { AttributeContext } from "./CPP14Parser.js";
import { AttributeNamespaceContext } from "./CPP14Parser.js";
import { AttributeArgumentClauseContext } from "./CPP14Parser.js";
import { BalancedTokenSeqContext } from "./CPP14Parser.js";
import { BalancedtokenContext } from "./CPP14Parser.js";
import { InitDeclaratorListContext } from "./CPP14Parser.js";
import { InitDeclaratorContext } from "./CPP14Parser.js";
import { DeclaratorContext } from "./CPP14Parser.js";
import { PointerDeclaratorContext } from "./CPP14Parser.js";
import { NoPointerDeclaratorContext } from "./CPP14Parser.js";
import { ParametersAndQualifiersContext } from "./CPP14Parser.js";
import { TrailingReturnTypeContext } from "./CPP14Parser.js";
import { PointerOperatorContext } from "./CPP14Parser.js";
import { CvqualifierseqContext } from "./CPP14Parser.js";
import { CvQualifierContext } from "./CPP14Parser.js";
import { RefqualifierContext } from "./CPP14Parser.js";
import { DeclaratoridContext } from "./CPP14Parser.js";
import { TheTypeIdContext } from "./CPP14Parser.js";
import { AbstractDeclaratorContext } from "./CPP14Parser.js";
import { PointerAbstractDeclaratorContext } from "./CPP14Parser.js";
import { NoPointerAbstractDeclaratorContext } from "./CPP14Parser.js";
import { AbstractPackDeclaratorContext } from "./CPP14Parser.js";
import { NoPointerAbstractPackDeclaratorContext } from "./CPP14Parser.js";
import { ParameterDeclarationClauseContext } from "./CPP14Parser.js";
import { ParameterDeclarationListContext } from "./CPP14Parser.js";
import { ParameterDeclarationContext } from "./CPP14Parser.js";
import { FunctionDefinitionContext } from "./CPP14Parser.js";
import { FunctionBodyContext } from "./CPP14Parser.js";
import { InitializerContext } from "./CPP14Parser.js";
import { BraceOrEqualInitializerContext } from "./CPP14Parser.js";
import { InitializerClauseContext } from "./CPP14Parser.js";
import { InitializerListContext } from "./CPP14Parser.js";
import { BracedInitListContext } from "./CPP14Parser.js";
import { ClassNameContext } from "./CPP14Parser.js";
import { ClassSpecifierContext } from "./CPP14Parser.js";
import { ClassHeadContext } from "./CPP14Parser.js";
import { ClassHeadNameContext } from "./CPP14Parser.js";
import { ClassVirtSpecifierContext } from "./CPP14Parser.js";
import { ClassKeyContext } from "./CPP14Parser.js";
import { MemberSpecificationContext } from "./CPP14Parser.js";
import { MemberdeclarationContext } from "./CPP14Parser.js";
import { MemberDeclaratorListContext } from "./CPP14Parser.js";
import { MemberDeclaratorContext } from "./CPP14Parser.js";
import { VirtualSpecifierSeqContext } from "./CPP14Parser.js";
import { VirtualSpecifierContext } from "./CPP14Parser.js";
import { PureSpecifierContext } from "./CPP14Parser.js";
import { BaseClauseContext } from "./CPP14Parser.js";
import { BaseSpecifierListContext } from "./CPP14Parser.js";
import { BaseSpecifierContext } from "./CPP14Parser.js";
import { ClassOrDeclTypeContext } from "./CPP14Parser.js";
import { BaseTypeSpecifierContext } from "./CPP14Parser.js";
import { AccessSpecifierContext } from "./CPP14Parser.js";
import { ConversionFunctionIdContext } from "./CPP14Parser.js";
import { ConversionTypeIdContext } from "./CPP14Parser.js";
import { ConversionDeclaratorContext } from "./CPP14Parser.js";
import { ConstructorInitializerContext } from "./CPP14Parser.js";
import { MemInitializerListContext } from "./CPP14Parser.js";
import { MemInitializerContext } from "./CPP14Parser.js";
import { MeminitializeridContext } from "./CPP14Parser.js";
import { OperatorFunctionIdContext } from "./CPP14Parser.js";
import { LiteralOperatorIdContext } from "./CPP14Parser.js";
import { TemplateDeclarationContext } from "./CPP14Parser.js";
import { TemplateparameterListContext } from "./CPP14Parser.js";
import { TemplateParameterContext } from "./CPP14Parser.js";
import { TypeParameterContext } from "./CPP14Parser.js";
import { SimpleTemplateIdContext } from "./CPP14Parser.js";
import { TemplateIdContext } from "./CPP14Parser.js";
import { TemplateNameContext } from "./CPP14Parser.js";
import { TemplateArgumentListContext } from "./CPP14Parser.js";
import { TemplateArgumentContext } from "./CPP14Parser.js";
import { TypeNameSpecifierContext } from "./CPP14Parser.js";
import { ExplicitInstantiationContext } from "./CPP14Parser.js";
import { ExplicitSpecializationContext } from "./CPP14Parser.js";
import { TryBlockContext } from "./CPP14Parser.js";
import { FunctionTryBlockContext } from "./CPP14Parser.js";
import { HandlerSeqContext } from "./CPP14Parser.js";
import { HandlerContext } from "./CPP14Parser.js";
import { ExceptionDeclarationContext } from "./CPP14Parser.js";
import { ThrowExpressionContext } from "./CPP14Parser.js";
import { ExceptionSpecificationContext } from "./CPP14Parser.js";
import { DynamicExceptionSpecificationContext } from "./CPP14Parser.js";
import { TypeIdListContext } from "./CPP14Parser.js";
import { NoeExceptSpecificationContext } from "./CPP14Parser.js";
import { TheOperatorContext } from "./CPP14Parser.js";
import { LiteralContext } from "./CPP14Parser.js";


/**
 * This interface defines a complete generic visitor for a parse tree produced
 * by `CPP14Parser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export class CPP14ParserVisitor<Result> extends AbstractParseTreeVisitor<Result> {
    /**
     * Visit a parse tree produced by `CPP14Parser.translationUnit`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTranslationUnit?: (ctx: TranslationUnitContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.primaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPrimaryExpression?: (ctx: PrimaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.idExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIdExpression?: (ctx: IdExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.unqualifiedId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnqualifiedId?: (ctx: UnqualifiedIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.qualifiedId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiedId?: (ctx: QualifiedIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.nestedNameSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNestedNameSpecifier?: (ctx: NestedNameSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.lambdaExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaExpression?: (ctx: LambdaExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.lambdaIntroducer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaIntroducer?: (ctx: LambdaIntroducerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.lambdaCapture`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaCapture?: (ctx: LambdaCaptureContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.captureDefault`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaptureDefault?: (ctx: CaptureDefaultContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.captureList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCaptureList?: (ctx: CaptureListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.capture`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCapture?: (ctx: CaptureContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleCapture`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleCapture?: (ctx: SimpleCaptureContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initcapture`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitcapture?: (ctx: InitcaptureContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.lambdaDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLambdaDeclarator?: (ctx: LambdaDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.postfixExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPostfixExpression?: (ctx: PostfixExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeIdOfTheTypeId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeIdOfTheTypeId?: (ctx: TypeIdOfTheTypeIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.expressionList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpressionList?: (ctx: ExpressionListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pseudoDestructorName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPseudoDestructorName?: (ctx: PseudoDestructorNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.unaryExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnaryExpression?: (ctx: UnaryExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.unaryOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUnaryOperator?: (ctx: UnaryOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.newExpression_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNewExpression_?: (ctx: NewExpression_Context) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.newPlacement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNewPlacement?: (ctx: NewPlacementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.newTypeId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNewTypeId?: (ctx: NewTypeIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.newDeclarator_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNewDeclarator_?: (ctx: NewDeclarator_Context) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noPointerNewDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoPointerNewDeclarator?: (ctx: NoPointerNewDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.newInitializer_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNewInitializer_?: (ctx: NewInitializer_Context) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.deleteExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeleteExpression?: (ctx: DeleteExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noExceptExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoExceptExpression?: (ctx: NoExceptExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.castExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCastExpression?: (ctx: CastExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pointerMemberExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPointerMemberExpression?: (ctx: PointerMemberExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.multiplicativeExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.additiveExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAdditiveExpression?: (ctx: AdditiveExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.shiftExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitShiftExpression?: (ctx: ShiftExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.shiftOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitShiftOperator?: (ctx: ShiftOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.relationalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRelationalExpression?: (ctx: RelationalExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.equalityExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEqualityExpression?: (ctx: EqualityExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.andExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAndExpression?: (ctx: AndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.exclusiveOrExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExclusiveOrExpression?: (ctx: ExclusiveOrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.inclusiveOrExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInclusiveOrExpression?: (ctx: InclusiveOrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.logicalAndExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.logicalOrExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.conditionalExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConditionalExpression?: (ctx: ConditionalExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.assignmentExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentExpression?: (ctx: AssignmentExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.assignmentOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAssignmentOperator?: (ctx: AssignmentOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.expression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpression?: (ctx: ExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.constantExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstantExpression?: (ctx: ConstantExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.statement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatement?: (ctx: StatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.labeledStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLabeledStatement?: (ctx: LabeledStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.expressionStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExpressionStatement?: (ctx: ExpressionStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.compoundStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCompoundStatement?: (ctx: CompoundStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.statementSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStatementSeq?: (ctx: StatementSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.selectionStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSelectionStatement?: (ctx: SelectionStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.condition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCondition?: (ctx: ConditionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.iterationStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitIterationStatement?: (ctx: IterationStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.forInitStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForInitStatement?: (ctx: ForInitStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.forRangeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForRangeDeclaration?: (ctx: ForRangeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.forRangeInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitForRangeInitializer?: (ctx: ForRangeInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.jumpStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitJumpStatement?: (ctx: JumpStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declarationStatement`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclarationStatement?: (ctx: DeclarationStatementContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declarationseq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclarationseq?: (ctx: DeclarationseqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaration?: (ctx: DeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.blockDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBlockDeclaration?: (ctx: BlockDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.aliasDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAliasDeclaration?: (ctx: AliasDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleDeclaration?: (ctx: SimpleDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.staticAssertDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStaticAssertDeclaration?: (ctx: StaticAssertDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.emptyDeclaration_`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEmptyDeclaration_?: (ctx: EmptyDeclaration_Context) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeDeclaration?: (ctx: AttributeDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclSpecifier?: (ctx: DeclSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declSpecifierSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclSpecifierSeq?: (ctx: DeclSpecifierSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.storageClassSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitStorageClassSpecifier?: (ctx: StorageClassSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.functionSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionSpecifier?: (ctx: FunctionSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typedefName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypedefName?: (ctx: TypedefNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeSpecifier?: (ctx: TypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.trailingTypeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTrailingTypeSpecifier?: (ctx: TrailingTypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeSpecifierSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeSpecifierSeq?: (ctx: TypeSpecifierSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.trailingTypeSpecifierSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTrailingTypeSpecifierSeq?: (ctx: TrailingTypeSpecifierSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleTypeLengthModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleTypeLengthModifier?: (ctx: SimpleTypeLengthModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleTypeSignednessModifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleTypeSignednessModifier?: (ctx: SimpleTypeSignednessModifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleTypeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleTypeSpecifier?: (ctx: SimpleTypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.theTypeName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTheTypeName?: (ctx: TheTypeNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.decltypeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDecltypeSpecifier?: (ctx: DecltypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.elaboratedTypeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitElaboratedTypeSpecifier?: (ctx: ElaboratedTypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumName?: (ctx: EnumNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumSpecifier?: (ctx: EnumSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumHead`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumHead?: (ctx: EnumHeadContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.opaqueEnumDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOpaqueEnumDeclaration?: (ctx: OpaqueEnumDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumkey`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumkey?: (ctx: EnumkeyContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumbase`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumbase?: (ctx: EnumbaseContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumeratorList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumeratorList?: (ctx: EnumeratorListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumeratorDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumeratorDefinition?: (ctx: EnumeratorDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.enumerator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitEnumerator?: (ctx: EnumeratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.namespaceName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceName?: (ctx: NamespaceNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.originalNamespaceName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOriginalNamespaceName?: (ctx: OriginalNamespaceNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.namespaceDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceDefinition?: (ctx: NamespaceDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.namespaceAlias`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceAlias?: (ctx: NamespaceAliasContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.namespaceAliasDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNamespaceAliasDefinition?: (ctx: NamespaceAliasDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.qualifiednamespacespecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitQualifiednamespacespecifier?: (ctx: QualifiednamespacespecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.usingDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsingDeclaration?: (ctx: UsingDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.usingDirective`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitUsingDirective?: (ctx: UsingDirectiveContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.asmDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAsmDefinition?: (ctx: AsmDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.linkageSpecification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLinkageSpecification?: (ctx: LinkageSpecificationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeSpecifierSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeSpecifierSeq?: (ctx: AttributeSpecifierSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeSpecifier?: (ctx: AttributeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.alignmentspecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAlignmentspecifier?: (ctx: AlignmentspecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeList?: (ctx: AttributeListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attribute`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttribute?: (ctx: AttributeContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeNamespace`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeNamespace?: (ctx: AttributeNamespaceContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.attributeArgumentClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAttributeArgumentClause?: (ctx: AttributeArgumentClauseContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.balancedTokenSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBalancedTokenSeq?: (ctx: BalancedTokenSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.balancedtoken`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBalancedtoken?: (ctx: BalancedtokenContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initDeclaratorList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitDeclaratorList?: (ctx: InitDeclaratorListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitDeclarator?: (ctx: InitDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclarator?: (ctx: DeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pointerDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPointerDeclarator?: (ctx: PointerDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noPointerDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoPointerDeclarator?: (ctx: NoPointerDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.parametersAndQualifiers`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParametersAndQualifiers?: (ctx: ParametersAndQualifiersContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.trailingReturnType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTrailingReturnType?: (ctx: TrailingReturnTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pointerOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPointerOperator?: (ctx: PointerOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.cvqualifierseq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCvqualifierseq?: (ctx: CvqualifierseqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.cvQualifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitCvQualifier?: (ctx: CvQualifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.refqualifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitRefqualifier?: (ctx: RefqualifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.declaratorid`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDeclaratorid?: (ctx: DeclaratoridContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.theTypeId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTheTypeId?: (ctx: TheTypeIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.abstractDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAbstractDeclarator?: (ctx: AbstractDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pointerAbstractDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPointerAbstractDeclarator?: (ctx: PointerAbstractDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noPointerAbstractDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoPointerAbstractDeclarator?: (ctx: NoPointerAbstractDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.abstractPackDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAbstractPackDeclarator?: (ctx: AbstractPackDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noPointerAbstractPackDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoPointerAbstractPackDeclarator?: (ctx: NoPointerAbstractPackDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.parameterDeclarationClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterDeclarationClause?: (ctx: ParameterDeclarationClauseContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.parameterDeclarationList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterDeclarationList?: (ctx: ParameterDeclarationListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.parameterDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitParameterDeclaration?: (ctx: ParameterDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.functionDefinition`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionDefinition?: (ctx: FunctionDefinitionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.functionBody`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionBody?: (ctx: FunctionBodyContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitializer?: (ctx: InitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.braceOrEqualInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBraceOrEqualInitializer?: (ctx: BraceOrEqualInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initializerClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitializerClause?: (ctx: InitializerClauseContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.initializerList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitInitializerList?: (ctx: InitializerListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.bracedInitList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBracedInitList?: (ctx: BracedInitListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.className`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassName?: (ctx: ClassNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassSpecifier?: (ctx: ClassSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classHead`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassHead?: (ctx: ClassHeadContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classHeadName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassHeadName?: (ctx: ClassHeadNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classVirtSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassVirtSpecifier?: (ctx: ClassVirtSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classKey`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassKey?: (ctx: ClassKeyContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memberSpecification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberSpecification?: (ctx: MemberSpecificationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memberdeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberdeclaration?: (ctx: MemberdeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memberDeclaratorList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberDeclaratorList?: (ctx: MemberDeclaratorListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memberDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemberDeclarator?: (ctx: MemberDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.virtualSpecifierSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVirtualSpecifierSeq?: (ctx: VirtualSpecifierSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.virtualSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitVirtualSpecifier?: (ctx: VirtualSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.pureSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitPureSpecifier?: (ctx: PureSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.baseClause`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBaseClause?: (ctx: BaseClauseContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.baseSpecifierList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBaseSpecifierList?: (ctx: BaseSpecifierListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.baseSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBaseSpecifier?: (ctx: BaseSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.classOrDeclType`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitClassOrDeclType?: (ctx: ClassOrDeclTypeContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.baseTypeSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitBaseTypeSpecifier?: (ctx: BaseTypeSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.accessSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitAccessSpecifier?: (ctx: AccessSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.conversionFunctionId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConversionFunctionId?: (ctx: ConversionFunctionIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.conversionTypeId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConversionTypeId?: (ctx: ConversionTypeIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.conversionDeclarator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConversionDeclarator?: (ctx: ConversionDeclaratorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.constructorInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitConstructorInitializer?: (ctx: ConstructorInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memInitializerList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemInitializerList?: (ctx: MemInitializerListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.memInitializer`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMemInitializer?: (ctx: MemInitializerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.meminitializerid`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitMeminitializerid?: (ctx: MeminitializeridContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.operatorFunctionId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitOperatorFunctionId?: (ctx: OperatorFunctionIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.literalOperatorId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteralOperatorId?: (ctx: LiteralOperatorIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateDeclaration?: (ctx: TemplateDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateparameterList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateparameterList?: (ctx: TemplateparameterListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateParameter?: (ctx: TemplateParameterContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeParameter`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeParameter?: (ctx: TypeParameterContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.simpleTemplateId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitSimpleTemplateId?: (ctx: SimpleTemplateIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateId`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateId?: (ctx: TemplateIdContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateName`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateName?: (ctx: TemplateNameContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateArgumentList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.templateArgument`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTemplateArgument?: (ctx: TemplateArgumentContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeNameSpecifier`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeNameSpecifier?: (ctx: TypeNameSpecifierContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.explicitInstantiation`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExplicitInstantiation?: (ctx: ExplicitInstantiationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.explicitSpecialization`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExplicitSpecialization?: (ctx: ExplicitSpecializationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.tryBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTryBlock?: (ctx: TryBlockContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.functionTryBlock`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitFunctionTryBlock?: (ctx: FunctionTryBlockContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.handlerSeq`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitHandlerSeq?: (ctx: HandlerSeqContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.handler`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitHandler?: (ctx: HandlerContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.exceptionDeclaration`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExceptionDeclaration?: (ctx: ExceptionDeclarationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.throwExpression`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitThrowExpression?: (ctx: ThrowExpressionContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.exceptionSpecification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitExceptionSpecification?: (ctx: ExceptionSpecificationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.dynamicExceptionSpecification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitDynamicExceptionSpecification?: (ctx: DynamicExceptionSpecificationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.typeIdList`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTypeIdList?: (ctx: TypeIdListContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.noeExceptSpecification`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitNoeExceptSpecification?: (ctx: NoeExceptSpecificationContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.theOperator`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitTheOperator?: (ctx: TheOperatorContext) => Result;
    /**
     * Visit a parse tree produced by `CPP14Parser.literal`.
     * @param ctx the parse tree
     * @return the visitor result
     */
    visitLiteral?: (ctx: LiteralContext) => Result;
}

