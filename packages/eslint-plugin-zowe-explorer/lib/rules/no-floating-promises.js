/**
 * Based on the @typescript-eslint/no-floating-promises rule, but with one key
 * difference. We permit floating Thenable objects that don't implement a
 * .catch function and have no risk of an uncaught promise exception.
 * 
 * This rule wraps the standard @typescript-eslint/no-floating-promises rule
 * and filters out violations for thenables without a catch method.
 */
const tsutils = require("ts-api-utils");
const { ESLintUtils } = require("@typescript-eslint/utils");

module.exports = ESLintUtils.RuleCreator.withoutDocs({
  meta: {
    type: "problem",
    docs: {
      description: "Require Promise-like statements to be handled appropriately, excluding thenables without catch",
      recommended: "recommended",
      requiresTypeChecking: true,
    },
    hasSuggestions: true,
    messages: {
      floating: 'Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler.',
      floatingFixAwait: 'Add await operator.',
      floatingFixVoid: 'Add void operator to ignore.',
      floatingPromiseArray: "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar.",
      floatingPromiseArrayVoid: "An array of Promises may be unintentional. Consider handling the promises' fulfillment or rejection with Promise.all or similar, or explicitly marking the expression as ignored with the `void` operator.",
      floatingUselessRejectionHandler: 'Promises must be awaited, end with a call to .catch, or end with a call to .then with a rejection handler. A rejection handler that is not a function will be ignored.',
      floatingUselessRejectionHandlerVoid: 'Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator. A rejection handler that is not a function will be ignored.',
      floatingVoid: 'Promises must be awaited, end with a call to .catch, end with a call to .then with a rejection handler or be explicitly marked as ignored with the `void` operator.',
    },
    schema: [
      {
        type: 'object',
        additionalProperties: false,
        properties: {
          checkThenables: {
            type: 'boolean',
            description: 'Whether to check all "Thenable"s, not just the built-in Promise type.',
          },
          ignoreIIFE: {
            type: 'boolean',
            description: 'Whether to ignore async IIFEs (Immediately Invoked Function Expressions).',
          },
          ignoreVoid: {
            type: 'boolean',
            description: 'Whether to ignore `void` expressions.',
          },
        },
      },
    ],
  },
  defaultOptions: [
    {
      checkThenables: false,
      ignoreIIFE: false,
      ignoreVoid: true,
    },
  ],
  create(context, [options]) {
    const services = ESLintUtils.getParserServices(context);
    const checker = services.program.getTypeChecker();

    /**
     * Check if a type has a catch method (indicating it's a rejectable promise)
     */
    function hasCatchMethod(type) {
      for (const ty of tsutils.unionTypeParts(checker.getApparentType(type))) {
        if (ty.getProperty("catch") !== undefined) {
          return true;
        }
      }
      return false;
    }

    /**
     * Check if a node's type is promise-like AND has a catch method
     */
    function isRejectablePromiseLike(node) {
      const type = checker.getTypeAtLocation(node);

      // Only consider it a floating promise if it has a catch method
      if (!hasCatchMethod(type)) {
        return false;
      }

      // Check if it's actually promise-like
      const typeParts = tsutils.unionTypeParts(checker.getApparentType(type));

      // Check for built-in Promise
      for (const typePart of typeParts) {
        const symbol = typePart.getSymbol();
        if (symbol?.getName() === 'Promise') {
          return true;
        }
      }

      // If checkThenables is enabled, check for thenable with then method
      if (options.checkThenables) {
        for (const ty of typeParts) {
          const then = ty.getProperty('then');
          if (then != null) {
            return true;
          }
        }
      }

      return false;
    }

    return {
      ExpressionStatement(node) {
        // Ignore async IIFEs if configured
        if (options.ignoreIIFE &&
          node.expression.type === 'CallExpression' &&
          (node.expression.callee.type === 'ArrowFunctionExpression' ||
            node.expression.callee.type === 'FunctionExpression')) {
          return;
        }

        // Ignore void expressions if configured
        if (options.ignoreVoid &&
          node.expression.type === 'UnaryExpression' &&
          node.expression.operator === 'void') {
          return;
        }

        // Skip chain expressions
        let expression = node.expression;
        while (expression.type === 'ChainExpression') {
          expression = expression.expression;
        }

        // Check if it's an unhandled promise
        if (expression.type === 'AwaitExpression') {
          return; // await handles the promise
        }

        // Check if it's a call expression with .catch() or .then()
        if (expression.type === 'CallExpression' &&
          expression.callee.type === 'MemberExpression') {
          const propertyName = expression.callee.property.type === 'Identifier'
            ? expression.callee.property.name
            : null;

          if (propertyName === 'catch' ||
            (propertyName === 'then' && expression.arguments.length >= 2)) {
            return; // Promise is handled
          }
        }

        const tsNode = services.esTreeNodeToTSNodeMap.get(expression);
        if (isRejectablePromiseLike(tsNode)) {
          context.report({
            node,
            messageId: options.ignoreVoid ? 'floatingVoid' : 'floating',
            suggest: options.ignoreVoid ? [
              {
                messageId: 'floatingFixVoid',
                fix(fixer) {
                  return fixer.insertTextBefore(node, 'void ');
                },
              },
              {
                messageId: 'floatingFixAwait',
                fix(fixer) {
                  return fixer.insertTextBefore(expression, 'await ');
                },
              },
            ] : [
              {
                messageId: 'floatingFixAwait',
                fix(fixer) {
                  return fixer.insertTextBefore(expression, 'await ');
                },
              },
            ],
          });
        }
      },
    };
  },
});
