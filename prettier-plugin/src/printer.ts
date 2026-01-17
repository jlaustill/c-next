/**
 * Printer for Prettier C-Next Plugin
 *
 * Converts AST nodes back to formatted source code using Prettier's Doc IR.
 *
 * Formatting style (opinionated):
 * - 4-space indentation
 * - Same-line braces: `void foo() {`
 * - Spaced assignment: `x <- 5`
 */

import { Doc, doc } from "prettier";
import * as AST from "./nodes";

const { group, indent, join, line, hardline, softline } = doc.builders;

type PrintFn = (path: AstPath) => Doc;
type AstPath = {
  getValue: () => AST.ASTNode;
  call: <T>(callback: (path: AstPath) => T, ...names: (string | number)[]) => T;
  map: <T>(callback: (path: AstPath) => T, name: string) => T[];
};
type PrinterOptions = {
  originalText?: string;
  [key: string]: unknown;
};

function print(path: AstPath, options: PrinterOptions, print: PrintFn): Doc {
  const node = path.getValue();

  switch (node.type) {
    case "Program":
      return printProgram(path, print);
    case "IncludeDirective":
      return printIncludeDirective(node);
    case "DefineFlag":
      return printDefineFlag(node);
    case "DefineWithValue":
    case "DefineFunction":
      return node.raw;
    case "IfdefDirective":
      return `#ifdef ${node.name}`;
    case "IfndefDirective":
      return `#ifndef ${node.name}`;
    case "ElseDirective":
      return "#else";
    case "EndifDirective":
      return "#endif";
    case "PragmaTarget":
      return `#pragma target ${node.target}`;
    case "ScopeDeclaration":
      return printScopeDeclaration(path, print);
    case "ScopeMember":
      return printScopeMember(path, print);
    case "RegisterDeclaration":
      return printRegisterDeclaration(path, print);
    case "RegisterMember":
      return printRegisterMember(path, print);
    case "StructDeclaration":
      return printStructDeclaration(path, print);
    case "StructMember":
      return printStructMember(path, print);
    case "EnumDeclaration":
      return printEnumDeclaration(path, print);
    case "EnumMember":
      return printEnumMember(path, print);
    case "BitmapDeclaration":
      return printBitmapDeclaration(path, print);
    case "BitmapMember":
      return printBitmapMember(node);
    case "FunctionDeclaration":
      return printFunctionDeclaration(path, print);
    case "Parameter":
      return printParameter(path, print);
    case "VariableDeclaration":
      return printVariableDeclaration(path, print);
    case "Block":
      return printBlock(path, print, options);
    case "AssignmentStatement":
      return printAssignmentStatement(path, print);
    case "ExpressionStatement":
      return printExpressionStatement(path, print);
    case "IfStatement":
      return printIfStatement(path, print);
    case "WhileStatement":
      return printWhileStatement(path, print);
    case "DoWhileStatement":
      return printDoWhileStatement(path, print);
    case "ForStatement":
      return printForStatement(path, print);
    case "ForVarDecl":
      return printForVarDecl(path, print);
    case "ForAssignment":
    case "ForUpdate":
      return printForAssignment(path, print);
    case "SwitchStatement":
      return printSwitchStatement(path, print);
    case "SwitchCase":
      return printSwitchCase(path, print);
    case "DefaultCase":
      return printDefaultCase(path, print);
    case "ReturnStatement":
      return printReturnStatement(path, print);
    case "CriticalStatement":
      return printCriticalStatement(path, print);
    case "TernaryExpression":
      return printTernaryExpression(path, print);
    case "BinaryExpression":
      return printBinaryExpression(path, print);
    case "UnaryExpression":
      return printUnaryExpression(path, print);
    case "CallExpression":
      return printCallExpression(path, print);
    case "MemberAccess":
      return printMemberAccess(path, print);
    case "ArrayAccess":
      return printArrayAccess(path, print);
    case "ThisAccess":
      return printThisAccess(path, print);
    case "GlobalAccess":
      return printGlobalAccess(path, print);
    case "CastExpression":
      return printCastExpression(path, print);
    case "SizeofExpression":
      return printSizeofExpression(path, print);
    case "StructInitializer":
      return printStructInitializer(path, print);
    case "FieldInitializer":
      return printFieldInitializer(path, print);
    case "ArrayInitializer":
      return printArrayInitializer(path, print);
    case "Identifier":
      return node.name;
    case "ParenExpression":
      return ["(", path.call(print, "expression"), ")"];
    case "Literal":
      return node.value;
    case "PrimitiveType":
      return node.name;
    case "StringType":
      return node.capacity !== null ? `string<${node.capacity}>` : "string";
    case "ScopedType":
      return `this.${node.name}`;
    case "QualifiedType":
      return `${node.scope}.${node.name}`;
    case "UserType":
      return node.name;
    case "ArrayType":
      return printArrayType(path, print);
    case "VoidType":
      return "void";
    case "Comment":
      return node.value;
    default:
      throw new Error(`Unknown node type: ${(node as AST.ASTNode).type}`);
  }
}

// ============================================================================
// Program
// ============================================================================

function printProgram(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.Program;
  const parts: Doc[] = [];

  // Note: Comments are handled by Prettier's comment attachment system
  // We tell Prettier all comments are "block comments" so they get separate lines

  // Print includes
  if (node.includes.length > 0) {
    parts.push(join(hardline, path.map(print, "includes")));
    parts.push(hardline);
  }

  // Print preprocessor directives
  if (node.preprocessor.length > 0) {
    if (parts.length > 0) parts.push(hardline);
    parts.push(join(hardline, path.map(print, "preprocessor")));
    parts.push(hardline);
  }

  // Print declarations with blank lines between them
  if (node.declarations.length > 0) {
    if (parts.length > 0) parts.push(hardline);
    parts.push(join([hardline, hardline], path.map(print, "declarations")));
  }

  // Ensure file ends with newline
  parts.push(hardline);

  return parts;
}

function printIncludeDirective(node: AST.IncludeDirective): Doc {
  if (node.isSystem) {
    return `#include <${node.path}>`;
  }
  return `#include "${node.path}"`;
}

function printDefineFlag(node: AST.DefineFlag): Doc {
  return `#define ${node.name}`;
}

// ============================================================================
// Declarations
// ============================================================================

function printScopeDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ScopeDeclaration;

  return group([
    `scope ${node.name} {`,
    indent([hardline, join(hardline, path.map(print, "members"))]),
    hardline,
    "}",
  ]);
}

function printScopeMember(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ScopeMember;
  const parts: Doc[] = [];

  if (node.visibility) {
    parts.push(node.visibility, " ");
  }

  parts.push(path.call(print, "declaration"));

  return parts;
}

function printRegisterDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.RegisterDeclaration;

  return group([
    "register ",
    node.name,
    " @ ",
    path.call(print, "address"),
    " {",
    indent([hardline, join(hardline, path.map(print, "members"))]),
    hardline,
    "}",
  ]);
}

function printRegisterMember(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.RegisterMember;

  return [
    node.name,
    ": ",
    path.call(print, "dataType"),
    " ",
    node.access,
    " @ ",
    path.call(print, "offset"),
    ",",
  ];
}

function printStructDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.StructDeclaration;

  return group([
    `struct ${node.name} {`,
    indent([hardline, join(hardline, path.map(print, "members"))]),
    hardline,
    "}",
  ]);
}

function printStructMember(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.StructMember;
  const parts: Doc[] = [path.call(print, "dataType"), " ", node.name];

  for (let i = 0; i < node.dimensions.length; i++) {
    // null dimension = empty [], non-null = [expr]
    if (node.dimensions[i] === null) {
      parts.push("[]");
    } else {
      parts.push("[", path.call(print, "dimensions", i), "]");
    }
  }

  parts.push(";");
  return parts;
}

function printEnumDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.EnumDeclaration;

  return group([
    `enum ${node.name} {`,
    indent([hardline, join([",", hardline], path.map(print, "members"))]),
    hardline,
    "}",
  ]);
}

function printEnumMember(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.EnumMember;

  if (node.value) {
    return [node.name, " <- ", path.call(print, "value")];
  }
  return node.name;
}

function printBitmapDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.BitmapDeclaration;

  return group([
    node.bitmapType,
    " ",
    node.name,
    " {",
    indent([hardline, join([",", hardline], path.map(print, "members"))]),
    hardline,
    "}",
  ]);
}

function printBitmapMember(node: AST.BitmapMember): Doc {
  if (node.width !== null) {
    return `${node.name}[${node.width}]`;
  }
  return node.name;
}

function printFunctionDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.FunctionDeclaration;

  const params =
    node.parameters.length > 0 ? join(", ", path.map(print, "parameters")) : "";

  return group([
    path.call(print, "returnType"),
    " ",
    node.name,
    "(",
    params,
    ") ",
    path.call(print, "body"),
  ]);
}

function printParameter(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.Parameter;
  const parts: Doc[] = [];

  if (node.isConst) {
    parts.push("const ");
  }

  parts.push(path.call(print, "dataType"), " ", node.name);

  for (let i = 0; i < node.dimensions.length; i++) {
    // null dimension = empty [], non-null = [expr]
    if (node.dimensions[i] === null) {
      parts.push("[]");
    } else {
      parts.push("[", path.call(print, "dimensions", i), "]");
    }
  }

  return parts;
}

function printVariableDeclaration(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.VariableDeclaration;
  const parts: Doc[] = [];

  if (node.isAtomic) parts.push("atomic ");
  if (node.isVolatile) parts.push("volatile ");
  if (node.isConst) parts.push("const ");
  if (node.overflow) parts.push(node.overflow, " ");

  parts.push(path.call(print, "dataType"), " ", node.name);

  for (let i = 0; i < node.dimensions.length; i++) {
    // null dimension = empty [], non-null = [expr]
    if (node.dimensions[i] === null) {
      parts.push("[]");
    } else {
      parts.push("[", path.call(print, "dimensions", i), "]");
    }
  }

  if (node.initializer) {
    parts.push(" <- ", path.call(print, "initializer"));
  }

  parts.push(";");
  return parts;
}

// ============================================================================
// Statements
// ============================================================================

function printBlock(
  path: AstPath,
  print: PrintFn,
  options: PrinterOptions,
): Doc {
  const node = path.getValue() as AST.Block;

  if (node.statements.length === 0) {
    return "{}";
  }

  // Build statements with blank line preservation
  const stmtDocs = path.map(print, "statements");
  const parts: Doc[] = [];

  for (let i = 0; i < stmtDocs.length; i++) {
    if (i > 0) {
      // Check if there was a blank line between this statement and the previous one
      const prevStmt = node.statements[i - 1];
      const currStmt = node.statements[i];

      if (
        options.originalText &&
        hasBlankLineBetween(options.originalText, prevStmt.end, currStmt.start)
      ) {
        // Preserve blank line
        parts.push(hardline, hardline);
      } else {
        parts.push(hardline);
      }
    }
    parts.push(stmtDocs[i]);
  }

  return group(["{", indent([hardline, parts]), hardline, "}"]);
}

/**
 * Check if there's a blank line (2+ newlines) between two positions in the source
 */
function hasBlankLineBetween(
  text: string,
  startPos: number,
  endPos: number,
): boolean {
  const between = text.slice(startPos + 1, endPos);
  // Count newlines - if there are 2 or more, there's at least one blank line
  const newlineCount = (between.match(/\n/g) || []).length;
  return newlineCount >= 2;
}

function printAssignmentStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.AssignmentStatement;

  return [
    path.call(print, "target"),
    " ",
    node.operator,
    " ",
    path.call(print, "value"),
    ";",
  ];
}

function printExpressionStatement(path: AstPath, print: PrintFn): Doc {
  return [path.call(print, "expression"), ";"];
}

function printIfStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.IfStatement;
  const parts: Doc[] = ["if (", path.call(print, "condition"), ") "];

  // Handle consequent - preserve original brace style
  if (node.consequent.type === "Block") {
    parts.push(path.call(print, "consequent"));
  } else {
    // Single statement - don't add braces
    parts.push(path.call(print, "consequent"));
  }

  // Handle alternate (else)
  if (node.alternate) {
    parts.push(" else ");
    if (node.alternate.type === "IfStatement") {
      // else if
      parts.push(path.call(print, "alternate"));
    } else if (node.alternate.type === "Block") {
      parts.push(path.call(print, "alternate"));
    } else {
      // Single statement - don't add braces
      parts.push(path.call(print, "alternate"));
    }
  }

  return group(parts);
}

function printWhileStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.WhileStatement;
  const parts: Doc[] = ["while (", path.call(print, "condition"), ") "];

  // Preserve original brace style
  parts.push(path.call(print, "body"));

  return group(parts);
}

function printDoWhileStatement(path: AstPath, print: PrintFn): Doc {
  return group([
    "do ",
    path.call(print, "body"),
    " while (",
    path.call(print, "condition"),
    ");",
  ]);
}

function printForStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ForStatement;
  const parts: Doc[] = ["for ("];

  if (node.init) {
    parts.push(path.call(print, "init"));
  }
  parts.push("; ");

  if (node.condition) {
    parts.push(path.call(print, "condition"));
  }
  parts.push("; ");

  if (node.update) {
    parts.push(path.call(print, "update"));
  }
  parts.push(") ");

  // Preserve original brace style
  parts.push(path.call(print, "body"));

  return group(parts);
}

function printForVarDecl(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ForVarDecl;
  const parts: Doc[] = [];

  if (node.isAtomic) parts.push("atomic ");
  if (node.isVolatile) parts.push("volatile ");
  if (node.overflow) parts.push(node.overflow, " ");

  parts.push(path.call(print, "dataType"), " ", node.name);

  for (let i = 0; i < node.dimensions.length; i++) {
    // null dimension = empty [], non-null = [expr]
    if (node.dimensions[i] === null) {
      parts.push("[]");
    } else {
      parts.push("[", path.call(print, "dimensions", i), "]");
    }
  }

  if (node.initializer) {
    parts.push(" <- ", path.call(print, "initializer"));
  }

  return parts;
}

function printForAssignment(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ForAssignment | AST.ForUpdate;

  return [
    path.call(print, "target"),
    " ",
    node.operator,
    " ",
    path.call(print, "value"),
  ];
}

function printSwitchStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.SwitchStatement;
  const parts: Doc[] = [
    "switch (",
    path.call(print, "expression"),
    ") {",
    indent([hardline, join(hardline, path.map(print, "cases"))]),
  ];

  if (node.defaultCase) {
    parts.push(hardline, indent(path.call(print, "defaultCase")));
  }

  parts.push(hardline, "}");
  return group(parts);
}

function printSwitchCase(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.SwitchCase;

  return group([
    "case ",
    join(" || ", path.map(print, "labels")),
    " ",
    path.call(print, "body"),
  ]);
}

function printDefaultCase(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.DefaultCase;

  if (node.count !== null) {
    return group([
      "default(",
      String(node.count),
      ") ",
      path.call(print, "body"),
    ]);
  }
  return group(["default ", path.call(print, "body")]);
}

function printReturnStatement(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ReturnStatement;

  if (node.value) {
    return ["return ", path.call(print, "value"), ";"];
  }
  return "return;";
}

function printCriticalStatement(path: AstPath, print: PrintFn): Doc {
  return group(["critical ", path.call(print, "body")]);
}

// ============================================================================
// Expressions
// ============================================================================

function printTernaryExpression(path: AstPath, print: PrintFn): Doc {
  return group([
    "(",
    path.call(print, "condition"),
    ") ? ",
    path.call(print, "consequent"),
    " : ",
    path.call(print, "alternate"),
  ]);
}

function printBinaryExpression(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.BinaryExpression;

  return group([
    path.call(print, "left"),
    " ",
    node.operator,
    " ",
    path.call(print, "right"),
  ]);
}

function printUnaryExpression(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.UnaryExpression;

  return [node.operator, path.call(print, "operand")];
}

function printCallExpression(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.CallExpression;

  return group([
    path.call(print, "callee"),
    "(",
    join(", ", path.map(print, "arguments")),
    ")",
  ]);
}

function printMemberAccess(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.MemberAccess;

  return [path.call(print, "object"), ".", node.property];
}

function printArrayAccess(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ArrayAccess;

  if (node.width) {
    return [
      path.call(print, "object"),
      "[",
      path.call(print, "index"),
      ", ",
      path.call(print, "width"),
      "]",
    ];
  }
  return [path.call(print, "object"), "[", path.call(print, "index"), "]"];
}

function printThisAccess(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ThisAccess;
  const parts: Doc[] = ["this.", node.path.join(".")];

  if (node.index) {
    parts.push("[", path.call(print, "index"));
    if (node.width) {
      parts.push(", ", path.call(print, "width"));
    }
    parts.push("]");
  }

  return parts;
}

function printGlobalAccess(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.GlobalAccess;
  const parts: Doc[] = ["global.", node.path.join(".")];

  if (node.index) {
    parts.push("[", path.call(print, "index"));
    if (node.width) {
      parts.push(", ", path.call(print, "width"));
    }
    parts.push("]");
  }

  return parts;
}

function printCastExpression(path: AstPath, print: PrintFn): Doc {
  return [
    "(",
    path.call(print, "targetType"),
    ")",
    path.call(print, "expression"),
  ];
}

function printSizeofExpression(path: AstPath, print: PrintFn): Doc {
  return ["sizeof(", path.call(print, "operand"), ")"];
}

function printStructInitializer(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.StructInitializer;
  const parts: Doc[] = [];

  if (node.structName) {
    parts.push(node.structName, " ");
  }

  parts.push(
    "{",
    indent([softline, join([",", line], path.map(print, "fields"))]),
    softline,
    "}",
  );

  return group(parts);
}

function printFieldInitializer(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.FieldInitializer;

  return [node.name, ": ", path.call(print, "value")];
}

function printArrayInitializer(path: AstPath, print: PrintFn): Doc {
  const node = path.getValue() as AST.ArrayInitializer;

  if (node.fillValue) {
    return ["[", path.call(print, "fillValue"), "*]"];
  }

  return group([
    "[",
    indent([softline, join([",", line], path.map(print, "elements"))]),
    softline,
    "]",
  ]);
}

function printArrayType(path: AstPath, print: PrintFn): Doc {
  return [path.call(print, "elementType"), "[", path.call(print, "size"), "]"];
}

export default print;
