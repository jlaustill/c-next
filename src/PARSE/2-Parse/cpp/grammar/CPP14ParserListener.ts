// Generated from grammar/CPP14Parser.g4 by ANTLR 4.13.1

import { ErrorNode, ParseTreeListener, ParserRuleContext, TerminalNode } from "antlr4ng";


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
 * This interface defines a complete listener for a parse tree produced by
 * `CPP14Parser`.
 */
export class CPP14ParserListener implements ParseTreeListener {
    /**
     * Enter a parse tree produced by `CPP14Parser.translationUnit`.
     * @param ctx the parse tree
     */
    enterTranslationUnit?: (ctx: TranslationUnitContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.translationUnit`.
     * @param ctx the parse tree
     */
    exitTranslationUnit?: (ctx: TranslationUnitContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.primaryExpression`.
     * @param ctx the parse tree
     */
    enterPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.primaryExpression`.
     * @param ctx the parse tree
     */
    exitPrimaryExpression?: (ctx: PrimaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.idExpression`.
     * @param ctx the parse tree
     */
    enterIdExpression?: (ctx: IdExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.idExpression`.
     * @param ctx the parse tree
     */
    exitIdExpression?: (ctx: IdExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.unqualifiedId`.
     * @param ctx the parse tree
     */
    enterUnqualifiedId?: (ctx: UnqualifiedIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.unqualifiedId`.
     * @param ctx the parse tree
     */
    exitUnqualifiedId?: (ctx: UnqualifiedIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.qualifiedId`.
     * @param ctx the parse tree
     */
    enterQualifiedId?: (ctx: QualifiedIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.qualifiedId`.
     * @param ctx the parse tree
     */
    exitQualifiedId?: (ctx: QualifiedIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.nestedNameSpecifier`.
     * @param ctx the parse tree
     */
    enterNestedNameSpecifier?: (ctx: NestedNameSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.nestedNameSpecifier`.
     * @param ctx the parse tree
     */
    exitNestedNameSpecifier?: (ctx: NestedNameSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.lambdaExpression`.
     * @param ctx the parse tree
     */
    enterLambdaExpression?: (ctx: LambdaExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.lambdaExpression`.
     * @param ctx the parse tree
     */
    exitLambdaExpression?: (ctx: LambdaExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.lambdaIntroducer`.
     * @param ctx the parse tree
     */
    enterLambdaIntroducer?: (ctx: LambdaIntroducerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.lambdaIntroducer`.
     * @param ctx the parse tree
     */
    exitLambdaIntroducer?: (ctx: LambdaIntroducerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.lambdaCapture`.
     * @param ctx the parse tree
     */
    enterLambdaCapture?: (ctx: LambdaCaptureContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.lambdaCapture`.
     * @param ctx the parse tree
     */
    exitLambdaCapture?: (ctx: LambdaCaptureContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.captureDefault`.
     * @param ctx the parse tree
     */
    enterCaptureDefault?: (ctx: CaptureDefaultContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.captureDefault`.
     * @param ctx the parse tree
     */
    exitCaptureDefault?: (ctx: CaptureDefaultContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.captureList`.
     * @param ctx the parse tree
     */
    enterCaptureList?: (ctx: CaptureListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.captureList`.
     * @param ctx the parse tree
     */
    exitCaptureList?: (ctx: CaptureListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.capture`.
     * @param ctx the parse tree
     */
    enterCapture?: (ctx: CaptureContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.capture`.
     * @param ctx the parse tree
     */
    exitCapture?: (ctx: CaptureContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleCapture`.
     * @param ctx the parse tree
     */
    enterSimpleCapture?: (ctx: SimpleCaptureContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleCapture`.
     * @param ctx the parse tree
     */
    exitSimpleCapture?: (ctx: SimpleCaptureContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initcapture`.
     * @param ctx the parse tree
     */
    enterInitcapture?: (ctx: InitcaptureContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initcapture`.
     * @param ctx the parse tree
     */
    exitInitcapture?: (ctx: InitcaptureContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.lambdaDeclarator`.
     * @param ctx the parse tree
     */
    enterLambdaDeclarator?: (ctx: LambdaDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.lambdaDeclarator`.
     * @param ctx the parse tree
     */
    exitLambdaDeclarator?: (ctx: LambdaDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.postfixExpression`.
     * @param ctx the parse tree
     */
    enterPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.postfixExpression`.
     * @param ctx the parse tree
     */
    exitPostfixExpression?: (ctx: PostfixExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeIdOfTheTypeId`.
     * @param ctx the parse tree
     */
    enterTypeIdOfTheTypeId?: (ctx: TypeIdOfTheTypeIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeIdOfTheTypeId`.
     * @param ctx the parse tree
     */
    exitTypeIdOfTheTypeId?: (ctx: TypeIdOfTheTypeIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.expressionList`.
     * @param ctx the parse tree
     */
    enterExpressionList?: (ctx: ExpressionListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.expressionList`.
     * @param ctx the parse tree
     */
    exitExpressionList?: (ctx: ExpressionListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pseudoDestructorName`.
     * @param ctx the parse tree
     */
    enterPseudoDestructorName?: (ctx: PseudoDestructorNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pseudoDestructorName`.
     * @param ctx the parse tree
     */
    exitPseudoDestructorName?: (ctx: PseudoDestructorNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.unaryExpression`.
     * @param ctx the parse tree
     */
    enterUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.unaryExpression`.
     * @param ctx the parse tree
     */
    exitUnaryExpression?: (ctx: UnaryExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.unaryOperator`.
     * @param ctx the parse tree
     */
    enterUnaryOperator?: (ctx: UnaryOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.unaryOperator`.
     * @param ctx the parse tree
     */
    exitUnaryOperator?: (ctx: UnaryOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.newExpression_`.
     * @param ctx the parse tree
     */
    enterNewExpression_?: (ctx: NewExpression_Context) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.newExpression_`.
     * @param ctx the parse tree
     */
    exitNewExpression_?: (ctx: NewExpression_Context) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.newPlacement`.
     * @param ctx the parse tree
     */
    enterNewPlacement?: (ctx: NewPlacementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.newPlacement`.
     * @param ctx the parse tree
     */
    exitNewPlacement?: (ctx: NewPlacementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.newTypeId`.
     * @param ctx the parse tree
     */
    enterNewTypeId?: (ctx: NewTypeIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.newTypeId`.
     * @param ctx the parse tree
     */
    exitNewTypeId?: (ctx: NewTypeIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.newDeclarator_`.
     * @param ctx the parse tree
     */
    enterNewDeclarator_?: (ctx: NewDeclarator_Context) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.newDeclarator_`.
     * @param ctx the parse tree
     */
    exitNewDeclarator_?: (ctx: NewDeclarator_Context) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noPointerNewDeclarator`.
     * @param ctx the parse tree
     */
    enterNoPointerNewDeclarator?: (ctx: NoPointerNewDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noPointerNewDeclarator`.
     * @param ctx the parse tree
     */
    exitNoPointerNewDeclarator?: (ctx: NoPointerNewDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.newInitializer_`.
     * @param ctx the parse tree
     */
    enterNewInitializer_?: (ctx: NewInitializer_Context) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.newInitializer_`.
     * @param ctx the parse tree
     */
    exitNewInitializer_?: (ctx: NewInitializer_Context) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.deleteExpression`.
     * @param ctx the parse tree
     */
    enterDeleteExpression?: (ctx: DeleteExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.deleteExpression`.
     * @param ctx the parse tree
     */
    exitDeleteExpression?: (ctx: DeleteExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noExceptExpression`.
     * @param ctx the parse tree
     */
    enterNoExceptExpression?: (ctx: NoExceptExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noExceptExpression`.
     * @param ctx the parse tree
     */
    exitNoExceptExpression?: (ctx: NoExceptExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.castExpression`.
     * @param ctx the parse tree
     */
    enterCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.castExpression`.
     * @param ctx the parse tree
     */
    exitCastExpression?: (ctx: CastExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pointerMemberExpression`.
     * @param ctx the parse tree
     */
    enterPointerMemberExpression?: (ctx: PointerMemberExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pointerMemberExpression`.
     * @param ctx the parse tree
     */
    exitPointerMemberExpression?: (ctx: PointerMemberExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    enterMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.multiplicativeExpression`.
     * @param ctx the parse tree
     */
    exitMultiplicativeExpression?: (ctx: MultiplicativeExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.additiveExpression`.
     * @param ctx the parse tree
     */
    enterAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.additiveExpression`.
     * @param ctx the parse tree
     */
    exitAdditiveExpression?: (ctx: AdditiveExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.shiftExpression`.
     * @param ctx the parse tree
     */
    enterShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.shiftExpression`.
     * @param ctx the parse tree
     */
    exitShiftExpression?: (ctx: ShiftExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.shiftOperator`.
     * @param ctx the parse tree
     */
    enterShiftOperator?: (ctx: ShiftOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.shiftOperator`.
     * @param ctx the parse tree
     */
    exitShiftOperator?: (ctx: ShiftOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.relationalExpression`.
     * @param ctx the parse tree
     */
    enterRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.relationalExpression`.
     * @param ctx the parse tree
     */
    exitRelationalExpression?: (ctx: RelationalExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.equalityExpression`.
     * @param ctx the parse tree
     */
    enterEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.equalityExpression`.
     * @param ctx the parse tree
     */
    exitEqualityExpression?: (ctx: EqualityExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.andExpression`.
     * @param ctx the parse tree
     */
    enterAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.andExpression`.
     * @param ctx the parse tree
     */
    exitAndExpression?: (ctx: AndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.exclusiveOrExpression`.
     * @param ctx the parse tree
     */
    enterExclusiveOrExpression?: (ctx: ExclusiveOrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.exclusiveOrExpression`.
     * @param ctx the parse tree
     */
    exitExclusiveOrExpression?: (ctx: ExclusiveOrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.inclusiveOrExpression`.
     * @param ctx the parse tree
     */
    enterInclusiveOrExpression?: (ctx: InclusiveOrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.inclusiveOrExpression`.
     * @param ctx the parse tree
     */
    exitInclusiveOrExpression?: (ctx: InclusiveOrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.logicalAndExpression`.
     * @param ctx the parse tree
     */
    enterLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.logicalAndExpression`.
     * @param ctx the parse tree
     */
    exitLogicalAndExpression?: (ctx: LogicalAndExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.logicalOrExpression`.
     * @param ctx the parse tree
     */
    enterLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.logicalOrExpression`.
     * @param ctx the parse tree
     */
    exitLogicalOrExpression?: (ctx: LogicalOrExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.conditionalExpression`.
     * @param ctx the parse tree
     */
    enterConditionalExpression?: (ctx: ConditionalExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.conditionalExpression`.
     * @param ctx the parse tree
     */
    exitConditionalExpression?: (ctx: ConditionalExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.assignmentExpression`.
     * @param ctx the parse tree
     */
    enterAssignmentExpression?: (ctx: AssignmentExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.assignmentExpression`.
     * @param ctx the parse tree
     */
    exitAssignmentExpression?: (ctx: AssignmentExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.assignmentOperator`.
     * @param ctx the parse tree
     */
    enterAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.assignmentOperator`.
     * @param ctx the parse tree
     */
    exitAssignmentOperator?: (ctx: AssignmentOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.expression`.
     * @param ctx the parse tree
     */
    enterExpression?: (ctx: ExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.expression`.
     * @param ctx the parse tree
     */
    exitExpression?: (ctx: ExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.constantExpression`.
     * @param ctx the parse tree
     */
    enterConstantExpression?: (ctx: ConstantExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.constantExpression`.
     * @param ctx the parse tree
     */
    exitConstantExpression?: (ctx: ConstantExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.statement`.
     * @param ctx the parse tree
     */
    enterStatement?: (ctx: StatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.statement`.
     * @param ctx the parse tree
     */
    exitStatement?: (ctx: StatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.labeledStatement`.
     * @param ctx the parse tree
     */
    enterLabeledStatement?: (ctx: LabeledStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.labeledStatement`.
     * @param ctx the parse tree
     */
    exitLabeledStatement?: (ctx: LabeledStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.expressionStatement`.
     * @param ctx the parse tree
     */
    enterExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.expressionStatement`.
     * @param ctx the parse tree
     */
    exitExpressionStatement?: (ctx: ExpressionStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.compoundStatement`.
     * @param ctx the parse tree
     */
    enterCompoundStatement?: (ctx: CompoundStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.compoundStatement`.
     * @param ctx the parse tree
     */
    exitCompoundStatement?: (ctx: CompoundStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.statementSeq`.
     * @param ctx the parse tree
     */
    enterStatementSeq?: (ctx: StatementSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.statementSeq`.
     * @param ctx the parse tree
     */
    exitStatementSeq?: (ctx: StatementSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.selectionStatement`.
     * @param ctx the parse tree
     */
    enterSelectionStatement?: (ctx: SelectionStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.selectionStatement`.
     * @param ctx the parse tree
     */
    exitSelectionStatement?: (ctx: SelectionStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.condition`.
     * @param ctx the parse tree
     */
    enterCondition?: (ctx: ConditionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.condition`.
     * @param ctx the parse tree
     */
    exitCondition?: (ctx: ConditionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.iterationStatement`.
     * @param ctx the parse tree
     */
    enterIterationStatement?: (ctx: IterationStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.iterationStatement`.
     * @param ctx the parse tree
     */
    exitIterationStatement?: (ctx: IterationStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.forInitStatement`.
     * @param ctx the parse tree
     */
    enterForInitStatement?: (ctx: ForInitStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.forInitStatement`.
     * @param ctx the parse tree
     */
    exitForInitStatement?: (ctx: ForInitStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.forRangeDeclaration`.
     * @param ctx the parse tree
     */
    enterForRangeDeclaration?: (ctx: ForRangeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.forRangeDeclaration`.
     * @param ctx the parse tree
     */
    exitForRangeDeclaration?: (ctx: ForRangeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.forRangeInitializer`.
     * @param ctx the parse tree
     */
    enterForRangeInitializer?: (ctx: ForRangeInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.forRangeInitializer`.
     * @param ctx the parse tree
     */
    exitForRangeInitializer?: (ctx: ForRangeInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.jumpStatement`.
     * @param ctx the parse tree
     */
    enterJumpStatement?: (ctx: JumpStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.jumpStatement`.
     * @param ctx the parse tree
     */
    exitJumpStatement?: (ctx: JumpStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declarationStatement`.
     * @param ctx the parse tree
     */
    enterDeclarationStatement?: (ctx: DeclarationStatementContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declarationStatement`.
     * @param ctx the parse tree
     */
    exitDeclarationStatement?: (ctx: DeclarationStatementContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declarationseq`.
     * @param ctx the parse tree
     */
    enterDeclarationseq?: (ctx: DeclarationseqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declarationseq`.
     * @param ctx the parse tree
     */
    exitDeclarationseq?: (ctx: DeclarationseqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declaration`.
     * @param ctx the parse tree
     */
    enterDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declaration`.
     * @param ctx the parse tree
     */
    exitDeclaration?: (ctx: DeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.blockDeclaration`.
     * @param ctx the parse tree
     */
    enterBlockDeclaration?: (ctx: BlockDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.blockDeclaration`.
     * @param ctx the parse tree
     */
    exitBlockDeclaration?: (ctx: BlockDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.aliasDeclaration`.
     * @param ctx the parse tree
     */
    enterAliasDeclaration?: (ctx: AliasDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.aliasDeclaration`.
     * @param ctx the parse tree
     */
    exitAliasDeclaration?: (ctx: AliasDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleDeclaration`.
     * @param ctx the parse tree
     */
    enterSimpleDeclaration?: (ctx: SimpleDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleDeclaration`.
     * @param ctx the parse tree
     */
    exitSimpleDeclaration?: (ctx: SimpleDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.staticAssertDeclaration`.
     * @param ctx the parse tree
     */
    enterStaticAssertDeclaration?: (ctx: StaticAssertDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.staticAssertDeclaration`.
     * @param ctx the parse tree
     */
    exitStaticAssertDeclaration?: (ctx: StaticAssertDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.emptyDeclaration_`.
     * @param ctx the parse tree
     */
    enterEmptyDeclaration_?: (ctx: EmptyDeclaration_Context) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.emptyDeclaration_`.
     * @param ctx the parse tree
     */
    exitEmptyDeclaration_?: (ctx: EmptyDeclaration_Context) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeDeclaration`.
     * @param ctx the parse tree
     */
    enterAttributeDeclaration?: (ctx: AttributeDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeDeclaration`.
     * @param ctx the parse tree
     */
    exitAttributeDeclaration?: (ctx: AttributeDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declSpecifier`.
     * @param ctx the parse tree
     */
    enterDeclSpecifier?: (ctx: DeclSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declSpecifier`.
     * @param ctx the parse tree
     */
    exitDeclSpecifier?: (ctx: DeclSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declSpecifierSeq`.
     * @param ctx the parse tree
     */
    enterDeclSpecifierSeq?: (ctx: DeclSpecifierSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declSpecifierSeq`.
     * @param ctx the parse tree
     */
    exitDeclSpecifierSeq?: (ctx: DeclSpecifierSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.storageClassSpecifier`.
     * @param ctx the parse tree
     */
    enterStorageClassSpecifier?: (ctx: StorageClassSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.storageClassSpecifier`.
     * @param ctx the parse tree
     */
    exitStorageClassSpecifier?: (ctx: StorageClassSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.functionSpecifier`.
     * @param ctx the parse tree
     */
    enterFunctionSpecifier?: (ctx: FunctionSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.functionSpecifier`.
     * @param ctx the parse tree
     */
    exitFunctionSpecifier?: (ctx: FunctionSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typedefName`.
     * @param ctx the parse tree
     */
    enterTypedefName?: (ctx: TypedefNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typedefName`.
     * @param ctx the parse tree
     */
    exitTypedefName?: (ctx: TypedefNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeSpecifier`.
     * @param ctx the parse tree
     */
    enterTypeSpecifier?: (ctx: TypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeSpecifier`.
     * @param ctx the parse tree
     */
    exitTypeSpecifier?: (ctx: TypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.trailingTypeSpecifier`.
     * @param ctx the parse tree
     */
    enterTrailingTypeSpecifier?: (ctx: TrailingTypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.trailingTypeSpecifier`.
     * @param ctx the parse tree
     */
    exitTrailingTypeSpecifier?: (ctx: TrailingTypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeSpecifierSeq`.
     * @param ctx the parse tree
     */
    enterTypeSpecifierSeq?: (ctx: TypeSpecifierSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeSpecifierSeq`.
     * @param ctx the parse tree
     */
    exitTypeSpecifierSeq?: (ctx: TypeSpecifierSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.trailingTypeSpecifierSeq`.
     * @param ctx the parse tree
     */
    enterTrailingTypeSpecifierSeq?: (ctx: TrailingTypeSpecifierSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.trailingTypeSpecifierSeq`.
     * @param ctx the parse tree
     */
    exitTrailingTypeSpecifierSeq?: (ctx: TrailingTypeSpecifierSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleTypeLengthModifier`.
     * @param ctx the parse tree
     */
    enterSimpleTypeLengthModifier?: (ctx: SimpleTypeLengthModifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleTypeLengthModifier`.
     * @param ctx the parse tree
     */
    exitSimpleTypeLengthModifier?: (ctx: SimpleTypeLengthModifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleTypeSignednessModifier`.
     * @param ctx the parse tree
     */
    enterSimpleTypeSignednessModifier?: (ctx: SimpleTypeSignednessModifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleTypeSignednessModifier`.
     * @param ctx the parse tree
     */
    exitSimpleTypeSignednessModifier?: (ctx: SimpleTypeSignednessModifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleTypeSpecifier`.
     * @param ctx the parse tree
     */
    enterSimpleTypeSpecifier?: (ctx: SimpleTypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleTypeSpecifier`.
     * @param ctx the parse tree
     */
    exitSimpleTypeSpecifier?: (ctx: SimpleTypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.theTypeName`.
     * @param ctx the parse tree
     */
    enterTheTypeName?: (ctx: TheTypeNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.theTypeName`.
     * @param ctx the parse tree
     */
    exitTheTypeName?: (ctx: TheTypeNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.decltypeSpecifier`.
     * @param ctx the parse tree
     */
    enterDecltypeSpecifier?: (ctx: DecltypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.decltypeSpecifier`.
     * @param ctx the parse tree
     */
    exitDecltypeSpecifier?: (ctx: DecltypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.elaboratedTypeSpecifier`.
     * @param ctx the parse tree
     */
    enterElaboratedTypeSpecifier?: (ctx: ElaboratedTypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.elaboratedTypeSpecifier`.
     * @param ctx the parse tree
     */
    exitElaboratedTypeSpecifier?: (ctx: ElaboratedTypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumName`.
     * @param ctx the parse tree
     */
    enterEnumName?: (ctx: EnumNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumName`.
     * @param ctx the parse tree
     */
    exitEnumName?: (ctx: EnumNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumSpecifier`.
     * @param ctx the parse tree
     */
    enterEnumSpecifier?: (ctx: EnumSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumSpecifier`.
     * @param ctx the parse tree
     */
    exitEnumSpecifier?: (ctx: EnumSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumHead`.
     * @param ctx the parse tree
     */
    enterEnumHead?: (ctx: EnumHeadContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumHead`.
     * @param ctx the parse tree
     */
    exitEnumHead?: (ctx: EnumHeadContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.opaqueEnumDeclaration`.
     * @param ctx the parse tree
     */
    enterOpaqueEnumDeclaration?: (ctx: OpaqueEnumDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.opaqueEnumDeclaration`.
     * @param ctx the parse tree
     */
    exitOpaqueEnumDeclaration?: (ctx: OpaqueEnumDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumkey`.
     * @param ctx the parse tree
     */
    enterEnumkey?: (ctx: EnumkeyContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumkey`.
     * @param ctx the parse tree
     */
    exitEnumkey?: (ctx: EnumkeyContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumbase`.
     * @param ctx the parse tree
     */
    enterEnumbase?: (ctx: EnumbaseContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumbase`.
     * @param ctx the parse tree
     */
    exitEnumbase?: (ctx: EnumbaseContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumeratorList`.
     * @param ctx the parse tree
     */
    enterEnumeratorList?: (ctx: EnumeratorListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumeratorList`.
     * @param ctx the parse tree
     */
    exitEnumeratorList?: (ctx: EnumeratorListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumeratorDefinition`.
     * @param ctx the parse tree
     */
    enterEnumeratorDefinition?: (ctx: EnumeratorDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumeratorDefinition`.
     * @param ctx the parse tree
     */
    exitEnumeratorDefinition?: (ctx: EnumeratorDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.enumerator`.
     * @param ctx the parse tree
     */
    enterEnumerator?: (ctx: EnumeratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.enumerator`.
     * @param ctx the parse tree
     */
    exitEnumerator?: (ctx: EnumeratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.namespaceName`.
     * @param ctx the parse tree
     */
    enterNamespaceName?: (ctx: NamespaceNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.namespaceName`.
     * @param ctx the parse tree
     */
    exitNamespaceName?: (ctx: NamespaceNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.originalNamespaceName`.
     * @param ctx the parse tree
     */
    enterOriginalNamespaceName?: (ctx: OriginalNamespaceNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.originalNamespaceName`.
     * @param ctx the parse tree
     */
    exitOriginalNamespaceName?: (ctx: OriginalNamespaceNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.namespaceDefinition`.
     * @param ctx the parse tree
     */
    enterNamespaceDefinition?: (ctx: NamespaceDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.namespaceDefinition`.
     * @param ctx the parse tree
     */
    exitNamespaceDefinition?: (ctx: NamespaceDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.namespaceAlias`.
     * @param ctx the parse tree
     */
    enterNamespaceAlias?: (ctx: NamespaceAliasContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.namespaceAlias`.
     * @param ctx the parse tree
     */
    exitNamespaceAlias?: (ctx: NamespaceAliasContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.namespaceAliasDefinition`.
     * @param ctx the parse tree
     */
    enterNamespaceAliasDefinition?: (ctx: NamespaceAliasDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.namespaceAliasDefinition`.
     * @param ctx the parse tree
     */
    exitNamespaceAliasDefinition?: (ctx: NamespaceAliasDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.qualifiednamespacespecifier`.
     * @param ctx the parse tree
     */
    enterQualifiednamespacespecifier?: (ctx: QualifiednamespacespecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.qualifiednamespacespecifier`.
     * @param ctx the parse tree
     */
    exitQualifiednamespacespecifier?: (ctx: QualifiednamespacespecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.usingDeclaration`.
     * @param ctx the parse tree
     */
    enterUsingDeclaration?: (ctx: UsingDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.usingDeclaration`.
     * @param ctx the parse tree
     */
    exitUsingDeclaration?: (ctx: UsingDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.usingDirective`.
     * @param ctx the parse tree
     */
    enterUsingDirective?: (ctx: UsingDirectiveContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.usingDirective`.
     * @param ctx the parse tree
     */
    exitUsingDirective?: (ctx: UsingDirectiveContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.asmDefinition`.
     * @param ctx the parse tree
     */
    enterAsmDefinition?: (ctx: AsmDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.asmDefinition`.
     * @param ctx the parse tree
     */
    exitAsmDefinition?: (ctx: AsmDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.linkageSpecification`.
     * @param ctx the parse tree
     */
    enterLinkageSpecification?: (ctx: LinkageSpecificationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.linkageSpecification`.
     * @param ctx the parse tree
     */
    exitLinkageSpecification?: (ctx: LinkageSpecificationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeSpecifierSeq`.
     * @param ctx the parse tree
     */
    enterAttributeSpecifierSeq?: (ctx: AttributeSpecifierSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeSpecifierSeq`.
     * @param ctx the parse tree
     */
    exitAttributeSpecifierSeq?: (ctx: AttributeSpecifierSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeSpecifier`.
     * @param ctx the parse tree
     */
    enterAttributeSpecifier?: (ctx: AttributeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeSpecifier`.
     * @param ctx the parse tree
     */
    exitAttributeSpecifier?: (ctx: AttributeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.alignmentspecifier`.
     * @param ctx the parse tree
     */
    enterAlignmentspecifier?: (ctx: AlignmentspecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.alignmentspecifier`.
     * @param ctx the parse tree
     */
    exitAlignmentspecifier?: (ctx: AlignmentspecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeList`.
     * @param ctx the parse tree
     */
    enterAttributeList?: (ctx: AttributeListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeList`.
     * @param ctx the parse tree
     */
    exitAttributeList?: (ctx: AttributeListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attribute`.
     * @param ctx the parse tree
     */
    enterAttribute?: (ctx: AttributeContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attribute`.
     * @param ctx the parse tree
     */
    exitAttribute?: (ctx: AttributeContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeNamespace`.
     * @param ctx the parse tree
     */
    enterAttributeNamespace?: (ctx: AttributeNamespaceContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeNamespace`.
     * @param ctx the parse tree
     */
    exitAttributeNamespace?: (ctx: AttributeNamespaceContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.attributeArgumentClause`.
     * @param ctx the parse tree
     */
    enterAttributeArgumentClause?: (ctx: AttributeArgumentClauseContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.attributeArgumentClause`.
     * @param ctx the parse tree
     */
    exitAttributeArgumentClause?: (ctx: AttributeArgumentClauseContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.balancedTokenSeq`.
     * @param ctx the parse tree
     */
    enterBalancedTokenSeq?: (ctx: BalancedTokenSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.balancedTokenSeq`.
     * @param ctx the parse tree
     */
    exitBalancedTokenSeq?: (ctx: BalancedTokenSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.balancedtoken`.
     * @param ctx the parse tree
     */
    enterBalancedtoken?: (ctx: BalancedtokenContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.balancedtoken`.
     * @param ctx the parse tree
     */
    exitBalancedtoken?: (ctx: BalancedtokenContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initDeclaratorList`.
     * @param ctx the parse tree
     */
    enterInitDeclaratorList?: (ctx: InitDeclaratorListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initDeclaratorList`.
     * @param ctx the parse tree
     */
    exitInitDeclaratorList?: (ctx: InitDeclaratorListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initDeclarator`.
     * @param ctx the parse tree
     */
    enterInitDeclarator?: (ctx: InitDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initDeclarator`.
     * @param ctx the parse tree
     */
    exitInitDeclarator?: (ctx: InitDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declarator`.
     * @param ctx the parse tree
     */
    enterDeclarator?: (ctx: DeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declarator`.
     * @param ctx the parse tree
     */
    exitDeclarator?: (ctx: DeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pointerDeclarator`.
     * @param ctx the parse tree
     */
    enterPointerDeclarator?: (ctx: PointerDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pointerDeclarator`.
     * @param ctx the parse tree
     */
    exitPointerDeclarator?: (ctx: PointerDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noPointerDeclarator`.
     * @param ctx the parse tree
     */
    enterNoPointerDeclarator?: (ctx: NoPointerDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noPointerDeclarator`.
     * @param ctx the parse tree
     */
    exitNoPointerDeclarator?: (ctx: NoPointerDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.parametersAndQualifiers`.
     * @param ctx the parse tree
     */
    enterParametersAndQualifiers?: (ctx: ParametersAndQualifiersContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.parametersAndQualifiers`.
     * @param ctx the parse tree
     */
    exitParametersAndQualifiers?: (ctx: ParametersAndQualifiersContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.trailingReturnType`.
     * @param ctx the parse tree
     */
    enterTrailingReturnType?: (ctx: TrailingReturnTypeContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.trailingReturnType`.
     * @param ctx the parse tree
     */
    exitTrailingReturnType?: (ctx: TrailingReturnTypeContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pointerOperator`.
     * @param ctx the parse tree
     */
    enterPointerOperator?: (ctx: PointerOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pointerOperator`.
     * @param ctx the parse tree
     */
    exitPointerOperator?: (ctx: PointerOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.cvqualifierseq`.
     * @param ctx the parse tree
     */
    enterCvqualifierseq?: (ctx: CvqualifierseqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.cvqualifierseq`.
     * @param ctx the parse tree
     */
    exitCvqualifierseq?: (ctx: CvqualifierseqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.cvQualifier`.
     * @param ctx the parse tree
     */
    enterCvQualifier?: (ctx: CvQualifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.cvQualifier`.
     * @param ctx the parse tree
     */
    exitCvQualifier?: (ctx: CvQualifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.refqualifier`.
     * @param ctx the parse tree
     */
    enterRefqualifier?: (ctx: RefqualifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.refqualifier`.
     * @param ctx the parse tree
     */
    exitRefqualifier?: (ctx: RefqualifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.declaratorid`.
     * @param ctx the parse tree
     */
    enterDeclaratorid?: (ctx: DeclaratoridContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.declaratorid`.
     * @param ctx the parse tree
     */
    exitDeclaratorid?: (ctx: DeclaratoridContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.theTypeId`.
     * @param ctx the parse tree
     */
    enterTheTypeId?: (ctx: TheTypeIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.theTypeId`.
     * @param ctx the parse tree
     */
    exitTheTypeId?: (ctx: TheTypeIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.abstractDeclarator`.
     * @param ctx the parse tree
     */
    enterAbstractDeclarator?: (ctx: AbstractDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.abstractDeclarator`.
     * @param ctx the parse tree
     */
    exitAbstractDeclarator?: (ctx: AbstractDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pointerAbstractDeclarator`.
     * @param ctx the parse tree
     */
    enterPointerAbstractDeclarator?: (ctx: PointerAbstractDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pointerAbstractDeclarator`.
     * @param ctx the parse tree
     */
    exitPointerAbstractDeclarator?: (ctx: PointerAbstractDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noPointerAbstractDeclarator`.
     * @param ctx the parse tree
     */
    enterNoPointerAbstractDeclarator?: (ctx: NoPointerAbstractDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noPointerAbstractDeclarator`.
     * @param ctx the parse tree
     */
    exitNoPointerAbstractDeclarator?: (ctx: NoPointerAbstractDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.abstractPackDeclarator`.
     * @param ctx the parse tree
     */
    enterAbstractPackDeclarator?: (ctx: AbstractPackDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.abstractPackDeclarator`.
     * @param ctx the parse tree
     */
    exitAbstractPackDeclarator?: (ctx: AbstractPackDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noPointerAbstractPackDeclarator`.
     * @param ctx the parse tree
     */
    enterNoPointerAbstractPackDeclarator?: (ctx: NoPointerAbstractPackDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noPointerAbstractPackDeclarator`.
     * @param ctx the parse tree
     */
    exitNoPointerAbstractPackDeclarator?: (ctx: NoPointerAbstractPackDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.parameterDeclarationClause`.
     * @param ctx the parse tree
     */
    enterParameterDeclarationClause?: (ctx: ParameterDeclarationClauseContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.parameterDeclarationClause`.
     * @param ctx the parse tree
     */
    exitParameterDeclarationClause?: (ctx: ParameterDeclarationClauseContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.parameterDeclarationList`.
     * @param ctx the parse tree
     */
    enterParameterDeclarationList?: (ctx: ParameterDeclarationListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.parameterDeclarationList`.
     * @param ctx the parse tree
     */
    exitParameterDeclarationList?: (ctx: ParameterDeclarationListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.parameterDeclaration`.
     * @param ctx the parse tree
     */
    enterParameterDeclaration?: (ctx: ParameterDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.parameterDeclaration`.
     * @param ctx the parse tree
     */
    exitParameterDeclaration?: (ctx: ParameterDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.functionDefinition`.
     * @param ctx the parse tree
     */
    enterFunctionDefinition?: (ctx: FunctionDefinitionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.functionDefinition`.
     * @param ctx the parse tree
     */
    exitFunctionDefinition?: (ctx: FunctionDefinitionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.functionBody`.
     * @param ctx the parse tree
     */
    enterFunctionBody?: (ctx: FunctionBodyContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.functionBody`.
     * @param ctx the parse tree
     */
    exitFunctionBody?: (ctx: FunctionBodyContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initializer`.
     * @param ctx the parse tree
     */
    enterInitializer?: (ctx: InitializerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initializer`.
     * @param ctx the parse tree
     */
    exitInitializer?: (ctx: InitializerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.braceOrEqualInitializer`.
     * @param ctx the parse tree
     */
    enterBraceOrEqualInitializer?: (ctx: BraceOrEqualInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.braceOrEqualInitializer`.
     * @param ctx the parse tree
     */
    exitBraceOrEqualInitializer?: (ctx: BraceOrEqualInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initializerClause`.
     * @param ctx the parse tree
     */
    enterInitializerClause?: (ctx: InitializerClauseContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initializerClause`.
     * @param ctx the parse tree
     */
    exitInitializerClause?: (ctx: InitializerClauseContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.initializerList`.
     * @param ctx the parse tree
     */
    enterInitializerList?: (ctx: InitializerListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.initializerList`.
     * @param ctx the parse tree
     */
    exitInitializerList?: (ctx: InitializerListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.bracedInitList`.
     * @param ctx the parse tree
     */
    enterBracedInitList?: (ctx: BracedInitListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.bracedInitList`.
     * @param ctx the parse tree
     */
    exitBracedInitList?: (ctx: BracedInitListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.className`.
     * @param ctx the parse tree
     */
    enterClassName?: (ctx: ClassNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.className`.
     * @param ctx the parse tree
     */
    exitClassName?: (ctx: ClassNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classSpecifier`.
     * @param ctx the parse tree
     */
    enterClassSpecifier?: (ctx: ClassSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classSpecifier`.
     * @param ctx the parse tree
     */
    exitClassSpecifier?: (ctx: ClassSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classHead`.
     * @param ctx the parse tree
     */
    enterClassHead?: (ctx: ClassHeadContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classHead`.
     * @param ctx the parse tree
     */
    exitClassHead?: (ctx: ClassHeadContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classHeadName`.
     * @param ctx the parse tree
     */
    enterClassHeadName?: (ctx: ClassHeadNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classHeadName`.
     * @param ctx the parse tree
     */
    exitClassHeadName?: (ctx: ClassHeadNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classVirtSpecifier`.
     * @param ctx the parse tree
     */
    enterClassVirtSpecifier?: (ctx: ClassVirtSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classVirtSpecifier`.
     * @param ctx the parse tree
     */
    exitClassVirtSpecifier?: (ctx: ClassVirtSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classKey`.
     * @param ctx the parse tree
     */
    enterClassKey?: (ctx: ClassKeyContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classKey`.
     * @param ctx the parse tree
     */
    exitClassKey?: (ctx: ClassKeyContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memberSpecification`.
     * @param ctx the parse tree
     */
    enterMemberSpecification?: (ctx: MemberSpecificationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memberSpecification`.
     * @param ctx the parse tree
     */
    exitMemberSpecification?: (ctx: MemberSpecificationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memberdeclaration`.
     * @param ctx the parse tree
     */
    enterMemberdeclaration?: (ctx: MemberdeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memberdeclaration`.
     * @param ctx the parse tree
     */
    exitMemberdeclaration?: (ctx: MemberdeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memberDeclaratorList`.
     * @param ctx the parse tree
     */
    enterMemberDeclaratorList?: (ctx: MemberDeclaratorListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memberDeclaratorList`.
     * @param ctx the parse tree
     */
    exitMemberDeclaratorList?: (ctx: MemberDeclaratorListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memberDeclarator`.
     * @param ctx the parse tree
     */
    enterMemberDeclarator?: (ctx: MemberDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memberDeclarator`.
     * @param ctx the parse tree
     */
    exitMemberDeclarator?: (ctx: MemberDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.virtualSpecifierSeq`.
     * @param ctx the parse tree
     */
    enterVirtualSpecifierSeq?: (ctx: VirtualSpecifierSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.virtualSpecifierSeq`.
     * @param ctx the parse tree
     */
    exitVirtualSpecifierSeq?: (ctx: VirtualSpecifierSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.virtualSpecifier`.
     * @param ctx the parse tree
     */
    enterVirtualSpecifier?: (ctx: VirtualSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.virtualSpecifier`.
     * @param ctx the parse tree
     */
    exitVirtualSpecifier?: (ctx: VirtualSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.pureSpecifier`.
     * @param ctx the parse tree
     */
    enterPureSpecifier?: (ctx: PureSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.pureSpecifier`.
     * @param ctx the parse tree
     */
    exitPureSpecifier?: (ctx: PureSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.baseClause`.
     * @param ctx the parse tree
     */
    enterBaseClause?: (ctx: BaseClauseContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.baseClause`.
     * @param ctx the parse tree
     */
    exitBaseClause?: (ctx: BaseClauseContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.baseSpecifierList`.
     * @param ctx the parse tree
     */
    enterBaseSpecifierList?: (ctx: BaseSpecifierListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.baseSpecifierList`.
     * @param ctx the parse tree
     */
    exitBaseSpecifierList?: (ctx: BaseSpecifierListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.baseSpecifier`.
     * @param ctx the parse tree
     */
    enterBaseSpecifier?: (ctx: BaseSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.baseSpecifier`.
     * @param ctx the parse tree
     */
    exitBaseSpecifier?: (ctx: BaseSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.classOrDeclType`.
     * @param ctx the parse tree
     */
    enterClassOrDeclType?: (ctx: ClassOrDeclTypeContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.classOrDeclType`.
     * @param ctx the parse tree
     */
    exitClassOrDeclType?: (ctx: ClassOrDeclTypeContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.baseTypeSpecifier`.
     * @param ctx the parse tree
     */
    enterBaseTypeSpecifier?: (ctx: BaseTypeSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.baseTypeSpecifier`.
     * @param ctx the parse tree
     */
    exitBaseTypeSpecifier?: (ctx: BaseTypeSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.accessSpecifier`.
     * @param ctx the parse tree
     */
    enterAccessSpecifier?: (ctx: AccessSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.accessSpecifier`.
     * @param ctx the parse tree
     */
    exitAccessSpecifier?: (ctx: AccessSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.conversionFunctionId`.
     * @param ctx the parse tree
     */
    enterConversionFunctionId?: (ctx: ConversionFunctionIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.conversionFunctionId`.
     * @param ctx the parse tree
     */
    exitConversionFunctionId?: (ctx: ConversionFunctionIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.conversionTypeId`.
     * @param ctx the parse tree
     */
    enterConversionTypeId?: (ctx: ConversionTypeIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.conversionTypeId`.
     * @param ctx the parse tree
     */
    exitConversionTypeId?: (ctx: ConversionTypeIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.conversionDeclarator`.
     * @param ctx the parse tree
     */
    enterConversionDeclarator?: (ctx: ConversionDeclaratorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.conversionDeclarator`.
     * @param ctx the parse tree
     */
    exitConversionDeclarator?: (ctx: ConversionDeclaratorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.constructorInitializer`.
     * @param ctx the parse tree
     */
    enterConstructorInitializer?: (ctx: ConstructorInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.constructorInitializer`.
     * @param ctx the parse tree
     */
    exitConstructorInitializer?: (ctx: ConstructorInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memInitializerList`.
     * @param ctx the parse tree
     */
    enterMemInitializerList?: (ctx: MemInitializerListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memInitializerList`.
     * @param ctx the parse tree
     */
    exitMemInitializerList?: (ctx: MemInitializerListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.memInitializer`.
     * @param ctx the parse tree
     */
    enterMemInitializer?: (ctx: MemInitializerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.memInitializer`.
     * @param ctx the parse tree
     */
    exitMemInitializer?: (ctx: MemInitializerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.meminitializerid`.
     * @param ctx the parse tree
     */
    enterMeminitializerid?: (ctx: MeminitializeridContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.meminitializerid`.
     * @param ctx the parse tree
     */
    exitMeminitializerid?: (ctx: MeminitializeridContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.operatorFunctionId`.
     * @param ctx the parse tree
     */
    enterOperatorFunctionId?: (ctx: OperatorFunctionIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.operatorFunctionId`.
     * @param ctx the parse tree
     */
    exitOperatorFunctionId?: (ctx: OperatorFunctionIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.literalOperatorId`.
     * @param ctx the parse tree
     */
    enterLiteralOperatorId?: (ctx: LiteralOperatorIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.literalOperatorId`.
     * @param ctx the parse tree
     */
    exitLiteralOperatorId?: (ctx: LiteralOperatorIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateDeclaration`.
     * @param ctx the parse tree
     */
    enterTemplateDeclaration?: (ctx: TemplateDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateDeclaration`.
     * @param ctx the parse tree
     */
    exitTemplateDeclaration?: (ctx: TemplateDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateparameterList`.
     * @param ctx the parse tree
     */
    enterTemplateparameterList?: (ctx: TemplateparameterListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateparameterList`.
     * @param ctx the parse tree
     */
    exitTemplateparameterList?: (ctx: TemplateparameterListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateParameter`.
     * @param ctx the parse tree
     */
    enterTemplateParameter?: (ctx: TemplateParameterContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateParameter`.
     * @param ctx the parse tree
     */
    exitTemplateParameter?: (ctx: TemplateParameterContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeParameter`.
     * @param ctx the parse tree
     */
    enterTypeParameter?: (ctx: TypeParameterContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeParameter`.
     * @param ctx the parse tree
     */
    exitTypeParameter?: (ctx: TypeParameterContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.simpleTemplateId`.
     * @param ctx the parse tree
     */
    enterSimpleTemplateId?: (ctx: SimpleTemplateIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.simpleTemplateId`.
     * @param ctx the parse tree
     */
    exitSimpleTemplateId?: (ctx: SimpleTemplateIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateId`.
     * @param ctx the parse tree
     */
    enterTemplateId?: (ctx: TemplateIdContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateId`.
     * @param ctx the parse tree
     */
    exitTemplateId?: (ctx: TemplateIdContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateName`.
     * @param ctx the parse tree
     */
    enterTemplateName?: (ctx: TemplateNameContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateName`.
     * @param ctx the parse tree
     */
    exitTemplateName?: (ctx: TemplateNameContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateArgumentList`.
     * @param ctx the parse tree
     */
    enterTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateArgumentList`.
     * @param ctx the parse tree
     */
    exitTemplateArgumentList?: (ctx: TemplateArgumentListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.templateArgument`.
     * @param ctx the parse tree
     */
    enterTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.templateArgument`.
     * @param ctx the parse tree
     */
    exitTemplateArgument?: (ctx: TemplateArgumentContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeNameSpecifier`.
     * @param ctx the parse tree
     */
    enterTypeNameSpecifier?: (ctx: TypeNameSpecifierContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeNameSpecifier`.
     * @param ctx the parse tree
     */
    exitTypeNameSpecifier?: (ctx: TypeNameSpecifierContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.explicitInstantiation`.
     * @param ctx the parse tree
     */
    enterExplicitInstantiation?: (ctx: ExplicitInstantiationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.explicitInstantiation`.
     * @param ctx the parse tree
     */
    exitExplicitInstantiation?: (ctx: ExplicitInstantiationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.explicitSpecialization`.
     * @param ctx the parse tree
     */
    enterExplicitSpecialization?: (ctx: ExplicitSpecializationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.explicitSpecialization`.
     * @param ctx the parse tree
     */
    exitExplicitSpecialization?: (ctx: ExplicitSpecializationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.tryBlock`.
     * @param ctx the parse tree
     */
    enterTryBlock?: (ctx: TryBlockContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.tryBlock`.
     * @param ctx the parse tree
     */
    exitTryBlock?: (ctx: TryBlockContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.functionTryBlock`.
     * @param ctx the parse tree
     */
    enterFunctionTryBlock?: (ctx: FunctionTryBlockContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.functionTryBlock`.
     * @param ctx the parse tree
     */
    exitFunctionTryBlock?: (ctx: FunctionTryBlockContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.handlerSeq`.
     * @param ctx the parse tree
     */
    enterHandlerSeq?: (ctx: HandlerSeqContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.handlerSeq`.
     * @param ctx the parse tree
     */
    exitHandlerSeq?: (ctx: HandlerSeqContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.handler`.
     * @param ctx the parse tree
     */
    enterHandler?: (ctx: HandlerContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.handler`.
     * @param ctx the parse tree
     */
    exitHandler?: (ctx: HandlerContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.exceptionDeclaration`.
     * @param ctx the parse tree
     */
    enterExceptionDeclaration?: (ctx: ExceptionDeclarationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.exceptionDeclaration`.
     * @param ctx the parse tree
     */
    exitExceptionDeclaration?: (ctx: ExceptionDeclarationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.throwExpression`.
     * @param ctx the parse tree
     */
    enterThrowExpression?: (ctx: ThrowExpressionContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.throwExpression`.
     * @param ctx the parse tree
     */
    exitThrowExpression?: (ctx: ThrowExpressionContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.exceptionSpecification`.
     * @param ctx the parse tree
     */
    enterExceptionSpecification?: (ctx: ExceptionSpecificationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.exceptionSpecification`.
     * @param ctx the parse tree
     */
    exitExceptionSpecification?: (ctx: ExceptionSpecificationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.dynamicExceptionSpecification`.
     * @param ctx the parse tree
     */
    enterDynamicExceptionSpecification?: (ctx: DynamicExceptionSpecificationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.dynamicExceptionSpecification`.
     * @param ctx the parse tree
     */
    exitDynamicExceptionSpecification?: (ctx: DynamicExceptionSpecificationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.typeIdList`.
     * @param ctx the parse tree
     */
    enterTypeIdList?: (ctx: TypeIdListContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.typeIdList`.
     * @param ctx the parse tree
     */
    exitTypeIdList?: (ctx: TypeIdListContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.noeExceptSpecification`.
     * @param ctx the parse tree
     */
    enterNoeExceptSpecification?: (ctx: NoeExceptSpecificationContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.noeExceptSpecification`.
     * @param ctx the parse tree
     */
    exitNoeExceptSpecification?: (ctx: NoeExceptSpecificationContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.theOperator`.
     * @param ctx the parse tree
     */
    enterTheOperator?: (ctx: TheOperatorContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.theOperator`.
     * @param ctx the parse tree
     */
    exitTheOperator?: (ctx: TheOperatorContext) => void;
    /**
     * Enter a parse tree produced by `CPP14Parser.literal`.
     * @param ctx the parse tree
     */
    enterLiteral?: (ctx: LiteralContext) => void;
    /**
     * Exit a parse tree produced by `CPP14Parser.literal`.
     * @param ctx the parse tree
     */
    exitLiteral?: (ctx: LiteralContext) => void;

    visitTerminal(node: TerminalNode): void {}
    visitErrorNode(node: ErrorNode): void {}
    enterEveryRule(node: ParserRuleContext): void {}
    exitEveryRule(node: ParserRuleContext): void {}
}

