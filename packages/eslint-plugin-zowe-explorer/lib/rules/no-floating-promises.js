/**
 * Based on the @typescript-eslint/no-floating-promises rule, but with one key
 * difference. We permit floating Thenable objects that don't implement a
 * .catch function and have no risk of an uncaught promise exception.
 */
const rewire = require("rewire");
const tsutils = require("tsutils");
const oldRule = rewire("@typescript-eslint/eslint-plugin/dist/rules/no-floating-promises");
const oldIsPromiseLike = oldRule.__get__("isPromiseLike");
oldRule.__set__("isPromiseLike", (checker, node) => {
    const type = checker.getTypeAtLocation(node);
    for (const ty of tsutils.unionTypeParts(checker.getApparentType(type))) {
        if (ty.getProperty("catch") !== undefined) {
            return oldIsPromiseLike(checker, node);
        }
    }
    return false;
});
module.exports = oldRule.default;
