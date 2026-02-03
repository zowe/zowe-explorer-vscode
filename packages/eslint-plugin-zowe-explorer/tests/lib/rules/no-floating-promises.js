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
