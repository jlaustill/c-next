// Generated from cNext.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeListener } from "antlr4ts/tree/ParseTreeListener";

import { ValueExprContext } from "./cNextParser";
import { AddExprContext } from "./cNextParser";
import { SubExprContext } from "./cNextParser";
import { MultExprContext } from "./cNextParser";
import { DivExprContext } from "./cNextParser";
import { ParenExprContext } from "./cNextParser";
import { SourceFileContext } from "./cNextParser";
import { MainSourceFileContext } from "./cNextParser";
import { ClassDeclarationContext } from "./cNextParser";
import { ClassMembersContext } from "./cNextParser";
import { StaticMemberContext } from "./cNextParser";
import { RegularMemberContext } from "./cNextParser";
import { ClassFunctionContext } from "./cNextParser";
import { FunctionDeclarationContext } from "./cNextParser";
import { ParameterListContext } from "./cNextParser";
import { ParameterContext } from "./cNextParser";
import { ReturnTypeContext } from "./cNextParser";
import { DeclarationContext } from "./cNextParser";
import { StatementContext } from "./cNextParser";
import { Type_specifierContext } from "./cNextParser";
import { ValueContext } from "./cNextParser";
import { ExpressionContext } from "./cNextParser";


/**
 * This interface defines a complete listener for a parse tree produced by
 * `cNextParser`.
 */
export interface cNextListener extends ParseTreeListener {
	/**
	 * Enter a parse tree produced by the `ValueExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterValueExpr?: (ctx: ValueExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ValueExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitValueExpr?: (ctx: ValueExprContext) => void;

	/**
	 * Enter a parse tree produced by the `AddExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterAddExpr?: (ctx: AddExprContext) => void;
	/**
	 * Exit a parse tree produced by the `AddExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitAddExpr?: (ctx: AddExprContext) => void;

	/**
	 * Enter a parse tree produced by the `SubExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterSubExpr?: (ctx: SubExprContext) => void;
	/**
	 * Exit a parse tree produced by the `SubExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitSubExpr?: (ctx: SubExprContext) => void;

	/**
	 * Enter a parse tree produced by the `MultExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterMultExpr?: (ctx: MultExprContext) => void;
	/**
	 * Exit a parse tree produced by the `MultExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitMultExpr?: (ctx: MultExprContext) => void;

	/**
	 * Enter a parse tree produced by the `DivExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterDivExpr?: (ctx: DivExprContext) => void;
	/**
	 * Exit a parse tree produced by the `DivExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitDivExpr?: (ctx: DivExprContext) => void;

	/**
	 * Enter a parse tree produced by the `ParenExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterParenExpr?: (ctx: ParenExprContext) => void;
	/**
	 * Exit a parse tree produced by the `ParenExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitParenExpr?: (ctx: ParenExprContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.sourceFile`.
	 * @param ctx the parse tree
	 */
	enterSourceFile?: (ctx: SourceFileContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.sourceFile`.
	 * @param ctx the parse tree
	 */
	exitSourceFile?: (ctx: SourceFileContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.mainSourceFile`.
	 * @param ctx the parse tree
	 */
	enterMainSourceFile?: (ctx: MainSourceFileContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.mainSourceFile`.
	 * @param ctx the parse tree
	 */
	exitMainSourceFile?: (ctx: MainSourceFileContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.classDeclaration`.
	 * @param ctx the parse tree
	 */
	enterClassDeclaration?: (ctx: ClassDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.classDeclaration`.
	 * @param ctx the parse tree
	 */
	exitClassDeclaration?: (ctx: ClassDeclarationContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.classMembers`.
	 * @param ctx the parse tree
	 */
	enterClassMembers?: (ctx: ClassMembersContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.classMembers`.
	 * @param ctx the parse tree
	 */
	exitClassMembers?: (ctx: ClassMembersContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.staticMember`.
	 * @param ctx the parse tree
	 */
	enterStaticMember?: (ctx: StaticMemberContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.staticMember`.
	 * @param ctx the parse tree
	 */
	exitStaticMember?: (ctx: StaticMemberContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.regularMember`.
	 * @param ctx the parse tree
	 */
	enterRegularMember?: (ctx: RegularMemberContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.regularMember`.
	 * @param ctx the parse tree
	 */
	exitRegularMember?: (ctx: RegularMemberContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.classFunction`.
	 * @param ctx the parse tree
	 */
	enterClassFunction?: (ctx: ClassFunctionContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.classFunction`.
	 * @param ctx the parse tree
	 */
	exitClassFunction?: (ctx: ClassFunctionContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.functionDeclaration`.
	 * @param ctx the parse tree
	 */
	enterFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.functionDeclaration`.
	 * @param ctx the parse tree
	 */
	exitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.parameterList`.
	 * @param ctx the parse tree
	 */
	enterParameterList?: (ctx: ParameterListContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.parameterList`.
	 * @param ctx the parse tree
	 */
	exitParameterList?: (ctx: ParameterListContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.parameter`.
	 * @param ctx the parse tree
	 */
	enterParameter?: (ctx: ParameterContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.parameter`.
	 * @param ctx the parse tree
	 */
	exitParameter?: (ctx: ParameterContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.returnType`.
	 * @param ctx the parse tree
	 */
	enterReturnType?: (ctx: ReturnTypeContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.returnType`.
	 * @param ctx the parse tree
	 */
	exitReturnType?: (ctx: ReturnTypeContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.declaration`.
	 * @param ctx the parse tree
	 */
	enterDeclaration?: (ctx: DeclarationContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.declaration`.
	 * @param ctx the parse tree
	 */
	exitDeclaration?: (ctx: DeclarationContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.statement`.
	 * @param ctx the parse tree
	 */
	enterStatement?: (ctx: StatementContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.statement`.
	 * @param ctx the parse tree
	 */
	exitStatement?: (ctx: StatementContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.type_specifier`.
	 * @param ctx the parse tree
	 */
	enterType_specifier?: (ctx: Type_specifierContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.type_specifier`.
	 * @param ctx the parse tree
	 */
	exitType_specifier?: (ctx: Type_specifierContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.value`.
	 * @param ctx the parse tree
	 */
	enterValue?: (ctx: ValueContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.value`.
	 * @param ctx the parse tree
	 */
	exitValue?: (ctx: ValueContext) => void;

	/**
	 * Enter a parse tree produced by `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	enterExpression?: (ctx: ExpressionContext) => void;
	/**
	 * Exit a parse tree produced by `cNextParser.expression`.
	 * @param ctx the parse tree
	 */
	exitExpression?: (ctx: ExpressionContext) => void;
}

