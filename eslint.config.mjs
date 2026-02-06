/**
 * This program and the accompanying materials are made available under the terms of the
 * Eclipse Public License v2.0 which accompanies this distribution, and is available at
 * https://www.eclipse.org/legal/epl-v20.html
 *
 * SPDX-License-Identifier: EPL-2.0
 *
 * Copyright Contributors to the Zowe Project.
 *
 */

import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import { configs as tseslintConfigs } from "typescript-eslint";
import prettierConfig from "eslint-config-prettier";
import zoweExplorerPlugin from "eslint-plugin-zowe-explorer";

export default defineConfig(
  // Base ESLint recommended rules
  eslint.configs.recommended,

  // TypeScript ESLint recommended rules
  tseslintConfigs.recommendedTypeChecked,

  // Prettier config (disables conflicting rules)
  prettierConfig,

  // Global configuration
  {
    languageOptions: {
      ecmaVersion: 6,
      sourceType: "module",
      parserOptions: {
        project: ["**/tsconfig.json", "**/tsconfig-tests.json"],
      },
    },
    plugins: {
      "zowe-explorer": zoweExplorerPlugin,
    },
    rules: {
      "@typescript-eslint/await-thenable": "off",
      "@typescript-eslint/consistent-type-assertions": "warn",
      "@typescript-eslint/explicit-function-return-type": [
        "error",
        {
          // We only disallow the rules that provide value (i.e. that found some errors while configuring)
          // Documentation: https://typescript-eslint.io/rules/explicit-function-return-type
          allowHigherOrderFunctions: false,
          allowFunctionsWithoutTypeParameters: false,

          // Disabling (i.e. setting to `false`) the following rule will force us to unnecessarily type built-in functions
          // For example, to find the index of a profile in a profiles array we will have to go:
          //     FROM: profiles.findIndex((profile) => profile.name === "my_profile"))
          //     TO:   profiles.findIndex((profile): boolean => profile.name === "my_profile"))
          allowTypedFunctionExpressions: true,
        },
      ],
      "@typescript-eslint/explicit-member-accessibility": "error",

      // New rules after eslint 9.x upgrade
      "@typescript-eslint/no-namespace": "off",
      "@typescript-eslint/no-deprecated": "error",
      "@typescript-eslint/no-floating-promises": "off",
      "zowe-explorer/no-floating-promises": "error",

      // There are several errors falling under these rules; resolve
      "@typescript-eslint/no-unsafe-assignment": "off",
      "@typescript-eslint/no-unsafe-argument": "off",
      "@typescript-eslint/no-unsafe-call": "off",
      "@typescript-eslint/no-unsafe-member-access": "off",

      "@typescript-eslint/no-shadow": "error",
      "@typescript-eslint/no-unused-expressions": "error",
      "@typescript-eslint/no-var-requires": "warn",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "array-callback-return": "error",
      "constructor-super": "error",
      curly: "warn",
      "getter-return": "error",
      "max-len": [
        "warn",
        {
          code: 150,
        },
      ],
      "no-console": "error",
      "no-const-assign": "error",
      "no-dupe-keys": "error",
      "no-duplicate-case": "error",
      "no-duplicate-imports": "error",
      "no-extra-bind": "warn",
      "no-extra-semi": "error",
      "no-implicit-globals": "error",
      "no-irregular-whitespace": "warn",
      "no-magic-numbers": [
        "warn",
        {
          ignore: [-2, -1, 0, 1, 2, 3, 4],
        },
      ],
      "no-multiple-empty-lines": "warn",
      "no-return-await": "off",
      "no-sequences": "warn",
      "no-shadow": "off",
      "no-sparse-arrays": "warn",
      "no-unreachable": "error",
      "no-unsafe-negation": "error",
      "no-unused-expressions": "off",
      "no-unused-vars": "off",
      "prefer-object-spread": "warn",
      "space-in-parens": "warn",
      "zowe-explorer/no-unmocked-core-modules": [
        "error",
        {
          coreModuleNames: ["fs"],
          filePathPattern: ".*\\.unit\\.test\\..*",
        },
      ],
    },
  },
  globalIgnores([
    "**/scripts/**",
    "**/__mocks__/**",
    "**/lib/**",
    "**/webpack.config.js",
    "**/*wdio.conf.ts",
    "**/features/**",
    "**/samples/__integration__/**",
    "**/out/**",
    "**/results/**",
    "**/src/webviews/**", // TODO: Remove this once we are ready to fix webviews linting errors
    "**/.wdio-vscode-service/**",
    "**/testProfileData.example.ts",
  ]),

  // Override for test files
  {
    files: ["**/__tests__/**"],
    rules: {
      "no-magic-numbers": "off",
      "@typescript-eslint/require-await": "warn",
      "@typescript-eslint/no-misused-promises": "warn",

      "@typescript-eslint/no-unsafe-return": "off",
      "@typescript-eslint/restrict-plus-operands": "warn",
      "@typescript-eslint/restrict-template-expressions": "warn",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/unbound-method": "off",
      // "@typescript-eslint/no-floating-promises": "warn",
      "zowe-explorer/no-floating-promises": "warn",
      curly: "off",

      // New excluded rules to resolve errors
      "@typescript-eslint/no-deprecated": "off",
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-base-to-string": "off",
      "@typescript-eslint/no-var-requires": "off",
      "@typescript-eslint/no-require-imports": "off",
    },
  }
);
