// Generated from cNext.g4 by ANTLR 4.9.0-SNAPSHOT


import { ParseTreeVisitor } from "antlr4ts/tree/ParseTreeVisitor";

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
 * This interface defines a complete generic visitor for a parse tree produced
 * by `cNextParser`.
 *
 * @param <Result> The return type of the visit operation. Use `void` for
 * operations with no return type.
 */
export interface cNextVisitor<Result> extends ParseTreeVisitor<Result> {
	/**
	 * Visit a parse tree produced by the `ValueExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitValueExpr?: (ctx: ValueExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `AddExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitAddExpr?: (ctx: AddExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `SubExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSubExpr?: (ctx: SubExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `MultExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMultExpr?: (ctx: MultExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `DivExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDivExpr?: (ctx: DivExprContext) => Result;

	/**
	 * Visit a parse tree produced by the `ParenExpr`
	 * labeled alternative in `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParenExpr?: (ctx: ParenExprContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.sourceFile`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitSourceFile?: (ctx: SourceFileContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.mainSourceFile`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitMainSourceFile?: (ctx: MainSourceFileContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.classDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClassDeclaration?: (ctx: ClassDeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.classMembers`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClassMembers?: (ctx: ClassMembersContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.staticMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStaticMember?: (ctx: StaticMemberContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.regularMember`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitRegularMember?: (ctx: RegularMemberContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.classFunction`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitClassFunction?: (ctx: ClassFunctionContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.functionDeclaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitFunctionDeclaration?: (ctx: FunctionDeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.parameterList`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameterList?: (ctx: ParameterListContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.parameter`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitParameter?: (ctx: ParameterContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.returnType`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitReturnType?: (ctx: ReturnTypeContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.declaration`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitDeclaration?: (ctx: DeclarationContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.statement`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitStatement?: (ctx: StatementContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.type_specifier`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitType_specifier?: (ctx: Type_specifierContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.value`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitValue?: (ctx: ValueContext) => Result;

	/**
	 * Visit a parse tree produced by `cNextParser.expression`.
	 * @param ctx the parse tree
	 * @return the visitor result
	 */
	visitExpression?: (ctx: ExpressionContext) => Result;
}

