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

const isJestMockOf = (name) => (node) => {
  return (
    node.type === "ExpressionStatement" &&
    node.expression.type === "CallExpression" &&
    node.expression.callee.type === "MemberExpression" &&
    node.expression.callee.object.type === "Identifier" &&
    node.expression.callee.object.name === "jest" &&
    node.expression.callee.property.type === "Identifier" &&
    node.expression.callee.property.name === "mock" &&
    node.expression.arguments.length === 1 &&
    node.expression.arguments[0].type === "Literal" &&
    node.expression.arguments[0].value === name
  );
};

module.exports = {
  meta: {
    type: "problem",
    docs: {
      description:
        "disallow the use of unmocked node core modules in unit tests",
      category: "Unit Tests",
      recommended: true,
      url: "",
    },
    schema: [
      {
        type: "object",
        properties: {
          coreModuleNames: {
            type: "array",
            items: { type: "string" },
            default: ["fs"],
          },
          filePathPattern: {
            type: "string",
            default: ".*\\.test\\..*",
          },
        },
        additionalProperties: false,
      },
    ],
    fixable: "code",
  },
  create: (context) => {
    const {
      coreModuleNames = ["fs"],
      filePathPattern = /.*\.ttest\..*/,
    } = context.options[0];
    const fileName = context.getFilename();
    if (!fileName.match(RegExp(filePathPattern))) {
      // file does not match pattern
      return {}; // no linting
    }

    return {
      ImportDeclaration(node) {
        const moduleName = node.source.value;
        if (
          coreModuleNames.includes(moduleName) && // imports node core module
          node.parent.type === "Program" &&
          !node.parent.body.some(isJestMockOf(moduleName)) // does not mock it
        ) {
          context.report({
            node,
            message: `Use jest.mock('${moduleName}') to mock a node core module`,
            fix: (fixer) =>
              fixer.insertTextAfter(
                node,
                `
jest.mock('${moduleName}');`
              ),
          });
        }
      },
    };
  },
};
