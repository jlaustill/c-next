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
    // Allow console for VS Code extension logging
    "no-console": "off",
  },
  ignorePatterns: ["dist/", "node_modules/", "*.js"],
};
