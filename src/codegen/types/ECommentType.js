"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * Comment type enumeration (ADR-043)
 */
var ECommentType;
(function (ECommentType) {
  ECommentType["Line"] = "line";
  ECommentType["Block"] = "block";
  ECommentType["Doc"] = "doc";
})(ECommentType || (ECommentType = {}));
exports.default = ECommentType;
