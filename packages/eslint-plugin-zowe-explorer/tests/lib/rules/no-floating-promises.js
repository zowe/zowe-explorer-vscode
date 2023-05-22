"use strict";

const rule = require("../../../lib/rules/no-floating-promises");
const { ESLintUtils } = require("@typescript-eslint/utils");

const ruleTester = new ESLintUtils.RuleTester({
  parser: "@typescript-eslint/parser",
  parserOptions: {
    ecmaVersion: 2015,
    project: "./tsconfig.eslint.json",
    sourceType: "module",
    tsconfigRootDir: __dirname + "/.."
  }
});

ruleTester.run("no-floating-promises", rule, {
  valid: [
    {
      code: "await Promise.resolve(true);",
    },
    {
      code: "import * as vscode from 'vscode';\nvscode.window.showInformationMessage('hello');",
    }
  ],

  invalid: [
    {
      code: "Promise.resolve(true);",
      options: [{ ignoreVoid: false }],
      errors: [
        {
          line: 1,
          messageId: "floating",
          suggestions: [
            {
              messageId: "floatingFixAwait",
              output: "await Promise.resolve(true);"
            }
          ]
        }
      ],
    }
  ],
});
