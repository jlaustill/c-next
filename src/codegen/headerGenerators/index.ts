/**
 * Header Type Generators
 *
 * Pure functions for generating C type definitions in headers.
 * Each generator takes a type name and IHeaderTypeInput, returning a C declaration string.
 */

import generateEnumHeader from "./generateEnumHeader";
import generateStructHeader from "./generateStructHeader";
import generateBitmapHeader from "./generateBitmapHeader";
import typeUtils from "./mapType";

export default {
  generateEnumHeader,
  generateStructHeader,
  generateBitmapHeader,
  ...typeUtils,
};
