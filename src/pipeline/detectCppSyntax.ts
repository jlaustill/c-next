/**
 * Issue #208: Detect if header content contains C++ syntax requiring C++14 parser
 *
 * This heuristic determines whether to parse a .h file with the C or C++ parser.
 * Previously, the pipeline would parse ALL .h files with BOTH parsers and merge,
 * which was wasteful and led to issues with C++-specific features like typed enums.
 *
 * C++ indicators:
 * - Typed enums: enum Name : type { ... }
 * - Class/struct inheritance: class Foo : public Bar
 * - Namespaces: namespace Foo { ... }
 * - Templates: template<...>
 * - Access specifiers: public:, private:, protected:
 */

/**
 * Detect if header content contains C++ syntax requiring C++14 parser
 * @param content Raw header file content
 * @returns true if C++ parser should be used, false for C parser
 */
function detectCppSyntax(content: string): boolean {
  // Typed enums: enum Name : type { (C++14 feature, key for Issue #208)
  if (/enum\s+\w+\s*:\s*\w+\s*\{/.test(content)) return true;

  // Class/struct with inheritance: class Foo : public/private/protected Bar
  if (/\b(class|struct)\s+\w+\s*:\s*(public|private|protected)/.test(content))
    return true;

  // namespace keyword: namespace Foo {
  if (/\bnamespace\s+\w+/.test(content)) return true;

  // template declarations: template<...>
  if (/\btemplate\s*</.test(content)) return true;

  // Access specifiers at line start (class members)
  if (/^\s*(public|private|protected)\s*:/m.test(content)) return true;

  // Default to C parser for pure C headers
  return false;
}

export default detectCppSyntax;
