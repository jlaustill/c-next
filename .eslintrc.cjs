module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: "./tsconfig.json",
  },
  plugins: ["@typescript-eslint", "import"],
  extends: [
    "airbnb-typescript/base",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  rules: {
    // Allow console for CLI tool
    "no-console": "off",
  },
  ignorePatterns: ["dist/", "node_modules/", "src/parser/", "*.js"],
};
