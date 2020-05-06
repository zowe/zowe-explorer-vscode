module.exports = {
  root: true,
  parser: "@typescript-eslint/parser",
  plugins: ["@typescript-eslint", "zowe-explorer"],
  env: { node: true, es6: true },
  rules: {
    "zowe-explorer/no-unmocked-core-modules": [
      "error",
      { coreModuleNames: ["fs"], filePathPattern: ".*\\.unit\\.test\\..*" },
    ],
  },
  parserOptions: {
    sourceType: "module",
  },
};
